"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ProductOption } from "@/lib/product-catalog/merge";
import { createProductLayoutsAction } from "@/app/warehouse/actions/product-layout";
import {
  findNearestValidFloorPlanPosition,
  getWarehouseFloorPlan,
  PRODUCT_CHIP_HEIGHT,
  PRODUCT_CHIP_WIDTH,
} from "@/lib/warehouse/floor-plans";

type AddedProduct = ProductOption & {
  x: number;
  y: number;
  color: string;
};

function createProductPositions(
  count: number,
  anchor: { x: number; y: number },
  branchId: number,
  zone: string,
): Array<{ x: number; y: number }> {
  const columns = Math.min(3, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const horizontalStep = PRODUCT_CHIP_WIDTH + 12;
  const verticalStep = PRODUCT_CHIP_HEIGHT + 8;
  const startX = anchor.x - ((columns - 1) * horizontalStep) / 2;
  const startY = anchor.y - ((rows - 1) * verticalStep) / 2;
  const floorPlan = getWarehouseFloorPlan(branchId, zone);

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const position = {
      x: startX + column * horizontalStep,
      y: startY + row * verticalStep,
    };
    return floorPlan ? findNearestValidFloorPlanPosition(floorPlan, position) : position;
  });
}

export function AddProductDialog({
  products,
  onAdded,
  branchId,
  zone,
  getPosition,
  open: openProp,
  onOpenChange,
}: {
  products: ProductOption[];
  onAdded: (products: AddedProduct[]) => void;
  branchId: number;
  zone: string;
  getPosition?: () => { x: number; y: number };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedIds = useMemo(
    () => new Set(selectedProducts.map((product) => product.productId)),
    [selectedProducts],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return products.filter((product) => (
      !selectedIds.has(product.productId)
      && product.name.toLocaleLowerCase("vi").includes(normalizedQuery)
    ));
  }, [products, query, selectedIds]);

  const open = openProp ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setSelectedProducts([]);
      setErrorMessage(null);
    }
    if (openProp === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const selectProduct = (product: ProductOption) => {
    setSelectedProducts((current) => (
      current.some((item) => item.productId === product.productId)
        ? current
        : [...current, product]
    ));
    setQuery("");
    setErrorMessage(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeProduct = (productId: number) => {
    setSelectedProducts((current) => current.filter((product) => product.productId !== productId));
    setErrorMessage(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const addSelectedProducts = () => {
    if (selectedProducts.length === 0) return;
    startTransition(async () => {
      setErrorMessage(null);
      const anchor = getPosition?.() ?? { x: 400, y: 250 };
      const positions = createProductPositions(selectedProducts.length, anchor, branchId, zone);
      const result = await createProductLayoutsAction({
        branchId,
        zone,
        products: selectedProducts.map((product, index) => ({
          productId: product.productId,
          ...positions[index],
        })),
      });

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      const layoutByProductId = new Map(result.data.map((layout) => [layout.productId, layout]));
      const addedProducts = selectedProducts.flatMap((product) => {
        const layout = layoutByProductId.get(product.productId);
        return layout ? [{ ...product, ...layout }] : [];
      });
      onAdded(addedProducts);
      setOpen(false);
    });
  };

  return (
    <div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 p-3 pt-16 sm:p-20"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="flex max-h-[calc(100dvh-5rem)] w-full max-w-lg flex-col rounded-xl bg-white p-4 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Thêm nhiều sản phẩm</h2>
                <p className="mt-0.5 text-xs text-slate-500">Tìm và chọn lần lượt các sản phẩm cần đưa lên sơ đồ.</p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              className="mt-3 flex max-h-32 min-h-11 flex-wrap items-center gap-1.5 overflow-y-auto rounded-md border bg-white px-2 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
              onClick={() => inputRef.current?.focus()}
            >
              {selectedProducts.map((product) => (
                <span
                  key={product.productId}
                  className="flex max-w-full items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900"
                >
                  <span className="max-w-64 truncate" title={product.name}>{product.name}</span>
                  <button
                    type="button"
                    aria-label={`Bỏ chọn ${product.name}`}
                    className="shrink-0 rounded px-0.5 text-blue-700 hover:bg-blue-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeProduct(product.productId);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                autoFocus
                value={query}
                disabled={pending}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && query.length === 0 && selectedProducts.length > 0) {
                    removeProduct(selectedProducts[selectedProducts.length - 1].productId);
                  }
                  if (event.key === "Enter" && filtered[0]) {
                    event.preventDefault();
                    selectProduct(filtered[0]);
                  }
                }}
                placeholder={selectedProducts.length === 0 ? "Gõ tên sản phẩm..." : "Tìm thêm sản phẩm..."}
                className="min-w-36 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              {filtered.map((product) => (
                <button
                  key={product.productId}
                  type="button"
                  disabled={pending}
                  onClick={() => selectProduct(product)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50"
                >
                  <span aria-hidden="true">📦</span>
                  <span className="min-w-0 flex-1 truncate" title={product.name}>{product.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">SL: {product.quantity}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="p-3 text-center text-sm text-slate-500">
                  {products.length === selectedProducts.length ? "Đã chọn hết sản phẩm có thể thêm." : "Không còn sản phẩm phù hợp."}
                </p>
              )}
            </div>

            {errorMessage && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
              <span className="text-sm text-slate-500">{selectedProducts.length} sản phẩm đã chọn</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={pending || selectedProducts.length === 0}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={addSelectedProducts}
                >
                  {pending ? "Đang thêm..." : `Thêm ${selectedProducts.length} sản phẩm`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
