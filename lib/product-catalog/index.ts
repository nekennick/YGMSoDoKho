export type {
  ExternalProduct,
  ProductCatalogService,
} from "@/lib/product-catalog/contracts";
export { externalProductSchema } from "@/lib/product-catalog/contracts";
export { FakeProductCatalogService } from "@/lib/product-catalog/fake";
export {
  mergeCatalogAndLayouts,
  type CanvasProduct,
  type ProductOption,
  type WarehouseInitialData,
} from "@/lib/product-catalog/merge";
