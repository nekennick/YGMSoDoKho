"use client";

import { useRef } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";

export function CanvasViewport({ products }: { products: CanvasProduct[] }) {
  const { spacePressed } = useKeyboard();
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  return (
    <TransformWrapper
      ref={transformRef}
      minScale={0.2}
      maxScale={5}
      initialScale={1}
      wheel={{ disabled: true }}
      panning={{ disabled: !spacePressed, excluded: ["product-chip"] }}
      doubleClick={{ disabled: true }}
    >
      {({ resetTransform, zoomIn, zoomOut, instance }) => (
        <div
          className={`relative h-full overflow-hidden bg-slate-50 ${spacePressed ? "cursor-grab" : "cursor-default"}`}
          onWheel={(event) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            if (event.deltaY < 0) {
              zoomIn(0.15);
            } else {
              zoomOut(0.15);
            }
          }}
          onMouseDown={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            instance.setup.panning.disabled = false;
          }}
          onMouseUp={(event) => {
            if (event.button === 1) instance.setup.panning.disabled = !spacePressed;
          }}
        >
          <div className="absolute left-3 top-3 z-10 rounded-md border bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
            {Math.round(instance.transformState.scale * 100)}%
            <button className="ml-2 underline" onClick={() => resetTransform()}>Reset</button>
          </div>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div className="relative h-[10000px] w-[10000px]">
              {products.map((product) => (
                <div
                  key={product.productId}
                  className="product-chip absolute min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-white shadow-sm"
                  style={{ left: product.x, top: product.y, backgroundColor: product.color }}
                >
                  <span aria-hidden="true">📦 </span>{product.name}
                </div>
              ))}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
