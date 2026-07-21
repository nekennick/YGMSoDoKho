import { z } from "zod";
import type { ExternalProduct, ProductCatalogService } from "@/lib/product-catalog/contracts";
import { externalProductSchema } from "@/lib/product-catalog/contracts";
import { KiotVietHttpClient } from "@/lib/kiotviet/http-client";

const productPageSchema = z.union([
  z.array(z.unknown()),
  z.object({ data: z.array(z.unknown()).optional(), items: z.array(z.unknown()).optional(), results: z.array(z.unknown()).optional(), total: z.number().int().nonnegative().optional() }),
]);

type ProductPage = z.infer<typeof productPageSchema>;

type CachedCatalog = {
  products: ExternalProduct[];
  expiresAt: number;
};

function productFromUnknown(value: unknown): ExternalProduct | null {
  const result = externalProductSchema.safeParse(value);
  return result.success ? result.data : null;
}

function pageItems(page: ProductPage): unknown[] {
  if (Array.isArray(page)) return page;
  return page.data ?? page.items ?? page.results ?? [];
}

function pageTotal(page: ProductPage): number | undefined {
  return Array.isArray(page) ? undefined : page.total;
}

export class KiotVietProductCatalogService implements ProductCatalogService {
  private cachedCatalog: CachedCatalog | null = null;
  private loadPromise: Promise<ExternalProduct[]> | null = null;

  public constructor(
    private readonly client: KiotVietHttpClient,
    private readonly productsPath = "/products",
    private readonly pageSize = 100,
    private readonly cacheTtlMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly maxPages = 1000,
  ) {}

  public async listProducts(): Promise<ExternalProduct[]> {
    if (this.cachedCatalog && this.cachedCatalog.expiresAt > this.now()) {
      return this.cachedCatalog.products.map((product) => ({ ...product }));
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadAllPages().finally(() => { this.loadPromise = null; });
    }
    return (await this.loadPromise).map((product) => ({ ...product }));
  }

  public async getProductById(productId: number): Promise<ExternalProduct | null> {
    const products = await this.listProducts();
    return products.find((product) => product.id === productId) ?? null;
  }

  public invalidateCache(): void {
    this.cachedCatalog = null;
  }

  private async loadAllPages(): Promise<ExternalProduct[]> {
    const productsById = new Map<number, ExternalProduct>();
    let currentItem = 0;
    for (let page = 1; page <= this.maxPages; page += 1) {
      const response = await this.client.get(
        `${this.productsPath}?currentItem=${currentItem}&pageSize=${this.pageSize}`,
        productPageSchema,
      );
      const items = pageItems(response);
      for (const item of items) {
        const product = productFromUnknown(item);
        if (product) productsById.set(product.id, product);
      }
      const total = pageTotal(response);
      if (items.length === 0 || (total !== undefined && productsById.size >= total) || items.length < this.pageSize) break;
      if (page === this.maxPages) throw new Error("KiotViet pagination exceeded the safety limit");
      currentItem += items.length;
    }
    const products = [...productsById.values()];
    this.cachedCatalog = { products, expiresAt: this.now() + this.cacheTtlMs };
    return products;
  }
}
