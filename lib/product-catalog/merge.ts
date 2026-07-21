import type { ExternalProduct } from "@/lib/product-catalog/contracts";
import type { ProductLayoutRecord } from "@/lib/product-layout/types";

export type CanvasProduct = {
  productId: number;
  name: string;
  x: number;
  y: number;
  color: string;
  quantity: number;
  groupId?: string | null;
};

export type ProductOption = {
  productId: number;
  name: string;
  quantity: number;
};

export type WarehouseInitialData = {
  canvasProducts: CanvasProduct[];
  availableProducts: ProductOption[];
  orphanLayoutProductIds: number[];
};

export function mergeCatalogAndLayouts(
  products: readonly ExternalProduct[],
  layouts: readonly ProductLayoutRecord[],
): WarehouseInitialData {
  const layoutByProductId = new Map(layouts.map((layout) => [layout.productId, layout]));
  const knownProductIds = new Set<number>();
  const canvasProducts: CanvasProduct[] = [];
  const availableProducts: ProductOption[] = [];

  for (const product of products) {
    if (knownProductIds.has(product.id)) continue;
    knownProductIds.add(product.id);

    if (!product.isActive) continue;

    const layout = layoutByProductId.get(product.id);
    if (layout) {
      canvasProducts.push({
        productId: product.id,
        name: product.name,
        x: layout.x,
        y: layout.y,
        color: layout.color,
        quantity: product.quantity,
        groupId: layout.groupId,
      });
    } else {
      availableProducts.push({ productId: product.id, name: product.name, quantity: product.quantity });
    }
  }

  const orphanLayoutProductIds = layouts
    .filter((layout) => !knownProductIds.has(layout.productId))
    .map((layout) => layout.productId);

  return { canvasProducts, availableProducts, orphanLayoutProductIds };
}
