import { listProductLayouts } from "@/lib/product-layout/repository";
import { getKiotVietConfig } from "@/lib/kiotviet/config";
import { KiotVietHttpClient } from "@/lib/kiotviet/http-client";
import { KiotVietProductCatalogService } from "@/lib/kiotviet/product-catalog";
import { KiotVietTokenProvider } from "@/lib/kiotviet/token-provider";
import { mergeCatalogAndLayouts, type WarehouseInitialData } from "@/lib/product-catalog/merge";

export type WarehouseDataResult =
  | { ok: true; data: WarehouseInitialData }
  | { ok: false; message: string };

export async function loadWarehouseInitialData(): Promise<WarehouseDataResult> {
  try {
    const config = getKiotVietConfig();
    const tokenProvider = new KiotVietTokenProvider(config);
    const client = new KiotVietHttpClient(config, tokenProvider);
    const catalogService = new KiotVietProductCatalogService(
      client,
      process.env.KIOTVIET_PRODUCTS_PATH ?? "/products",
      Number(process.env.KIOTVIET_PAGE_SIZE ?? 100),
    );
    const [products, layouts] = await Promise.all([
      catalogService.listProducts(),
      listProductLayouts(),
    ]);
    return { ok: true, data: mergeCatalogAndLayouts(products, layouts) };
  } catch (error) {
    console.error("Failed to load warehouse data", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ok: false,
      message: "Không thể tải dữ liệu kho. Hãy kiểm tra cấu hình KiotViet và cơ sở dữ liệu.",
    };
  }
}
