import type { ExternalProduct, ProductCatalogService } from "@/lib/product-catalog/contracts";

export class FakeProductCatalogService implements ProductCatalogService {
  private readonly products: ExternalProduct[];

  public constructor(products: ExternalProduct[] = []) {
    this.products = products.map((product) => ({ ...product }));
  }

  public async listProducts(): Promise<ExternalProduct[]> {
    return this.products.map((product) => ({ ...product }));
  }

  public async getProductById(productId: number): Promise<ExternalProduct | null> {
    const product = this.products.find((candidate) => candidate.id === productId);
    return product ? { ...product } : null;
  }
}
