import { listProductLayouts } from "@/lib/product-layout/repository";
import { getProductCatalogService } from "@/lib/warehouse/catalog-service";
import { mergeCatalogAndLayouts, type WarehouseInitialData } from "@/lib/product-catalog/merge";

export type WarehouseDataResult =
  | { ok: true; data: WarehouseInitialData }
  | { ok: false; code: "CONFIG" | "DATABASE" | "KIOTVIET" | "UNKNOWN"; message: string };

export async function loadWarehouseInitialData(branchId: number): Promise<WarehouseDataResult> {
  let catalogService: ReturnType<typeof getProductCatalogService>;
  try {
    catalogService = getProductCatalogService(branchId);
  } catch (error) {
    console.error("Warehouse KiotViet configuration error", { name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false, code: "CONFIG", message: "Thiếu hoặc sai biến môi trường KiotViet trên Vercel." };
  }
  try {
    const [catalogResult, layoutResult] = await Promise.allSettled([catalogService.listProducts(), listProductLayouts(branchId)]);
    if (catalogResult.status === "rejected") throw Object.assign(catalogResult.reason, { source: "KIOTVIET" });
    if (layoutResult.status === "rejected") throw Object.assign(layoutResult.reason, { source: "DATABASE" });
    const products = catalogResult.value;
    const layouts = layoutResult.value;
    return { ok: true, data: mergeCatalogAndLayouts(products, layouts) };
  } catch (error) {
    const source = error && typeof error === "object" && "source" in error ? error.source : "UNKNOWN";
    console.error("Failed to load warehouse data", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
      source,
    });
    return {
      ok: false,
      code: source === "DATABASE" || source === "KIOTVIET" ? source : "UNKNOWN",
      message: source === "DATABASE" ? "Không kết nối được cơ sở dữ liệu của kho trên Vercel." : source === "KIOTVIET" ? "Không kết nối được KiotViet trên Vercel." : "Không thể tải dữ liệu kho. Hãy kiểm tra cấu hình Vercel.",
    };
  }
}
