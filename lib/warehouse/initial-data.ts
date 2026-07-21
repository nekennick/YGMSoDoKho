import { listProductLayouts } from "@/lib/product-layout/repository";
import { getProductCatalogService } from "@/lib/warehouse/catalog-service";
import { mergeCatalogAndLayouts, type WarehouseInitialData } from "@/lib/product-catalog/merge";

export type WarehouseDataResult =
  | { ok: true; data: WarehouseInitialData }
  | { ok: false; message: string };

export async function loadWarehouseInitialData(): Promise<WarehouseDataResult> {
  try {
    const catalogService = getProductCatalogService();
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
