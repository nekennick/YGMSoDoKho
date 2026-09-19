import { listProductLayoutsByBranch } from "@/lib/product-layout/repository";
import { getProductCatalogService } from "@/lib/warehouse/catalog-service";
import { mergeCatalogAndLayouts, type WarehouseInitialData } from "@/lib/product-catalog/merge";
import { findNearestValidFloorPlanPosition, getWarehouseFloorPlan, isPositionInsideFloorPlan } from "@/lib/warehouse/floor-plans";
import { WAREHOUSES } from "@/lib/warehouse/branches";
import { findWarehouseZoneMarker } from "@/lib/warehouse/zone-marker-repository";
import { DEFAULT_DRY_ZONE_MARKER, DRY_ZONE_MARKER_KEY, DRY_ZONE_MARKER_PRODUCT_ID } from "@/lib/warehouse/zone-markers";

export type WarehouseDataResult =
  | { ok: true; data: WarehouseInitialData }
  | { ok: false; code: "CONFIG" | "DATABASE" | "KIOTVIET" | "UNKNOWN"; message: string };

export async function loadWarehouseInitialData(branchId: number, zone: string): Promise<WarehouseDataResult> {
  let catalogService: ReturnType<typeof getProductCatalogService>;
  try {
    catalogService = getProductCatalogService(branchId);
  } catch (error) {
    console.error("Warehouse KiotViet configuration error", { name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false, code: "CONFIG", message: "Thiếu hoặc sai biến môi trường KiotViet trên Vercel." };
  }
  try {
    const [catalogResult, layoutResult, zoneMarkerResult] = await Promise.allSettled([
      catalogService.listProducts(),
      listProductLayoutsByBranch(branchId),
      branchId === WAREHOUSES.caoLanh.id
        ? findWarehouseZoneMarker(branchId, "dry", DRY_ZONE_MARKER_KEY)
        : Promise.resolve(null),
    ]);
    if (catalogResult.status === "rejected") throw Object.assign(catalogResult.reason, { source: "KIOTVIET" });
    if (layoutResult.status === "rejected") throw Object.assign(layoutResult.reason, { source: "DATABASE" });
    const products = catalogResult.value;
    const branchLayouts = layoutResult.value.filter((layout) => layout.productId !== DRY_ZONE_MARKER_PRODUCT_ID);
    const visibleZones = branchId === WAREHOUSES.caoLanh.id ? new Set(["cold", "dry"]) : new Set([zone]);
    const visibleLayouts = branchLayouts
      .filter((layout) => visibleZones.has(layout.zone))
      .map((layout) => {
        const floorPlan = getWarehouseFloorPlan(branchId, layout.zone);
        if (!floorPlan || isPositionInsideFloorPlan(floorPlan, layout)) return layout;
        const safePosition = findNearestValidFloorPlanPosition(floorPlan, layout);
        return { ...layout, x: safePosition.x, y: safePosition.y };
      });
    const unavailableProductIds = new Set(branchLayouts.map((layout) => layout.productId));
    const data = mergeCatalogAndLayouts(products, visibleLayouts, unavailableProductIds);
    const zoneByProductId = new Map(visibleLayouts.map((layout) => [layout.productId, layout.zone]));
    const dryZoneMarker = branchId === WAREHOUSES.caoLanh.id
      ? (zoneMarkerResult.status === "fulfilled" ? zoneMarkerResult.value ?? DEFAULT_DRY_ZONE_MARKER : DEFAULT_DRY_ZONE_MARKER)
      : null;
    return {
      ok: true,
      data: {
        ...data,
        canvasProducts: data.canvasProducts.map((product) => ({
          ...product,
          zone: zoneByProductId.get(product.productId) ?? zone,
        })),
        dryZoneMarker,
      },
    };
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
