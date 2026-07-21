"use client";

import { useRef } from "react";
import { DndContext, type DragEndEvent, useDraggable } from "@dnd-kit/core";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";
import { updateProductPositionAction } from "@/app/warehouse/actions/product-layout";

function DraggableProduct({ product, scale }: { product: CanvasProduct; scale: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: product.productId });
  const deltaX = (transform?.x ?? 0) / scale;
  const deltaY = (transform?.y ?? 0) / scale;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="product-chip absolute min-w-48 touch-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-white shadow-sm"
      style={{
        left: product.x,
        top: product.y,
        backgroundColor: product.color,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
        zIndex: isDragging ? 20 : 1,
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <span aria-hidden="true">📦 </span>{product.name}
    </div>
  );
}

export function CanvasViewport({ products, onProductsChange }: { products: CanvasProduct[]; onProductsChange: (products: CanvasProduct[]) => void }) {
  const { spacePressed } = useKeyboard();
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  return (
    <DndContext onDragEnd={async (event: DragEndEvent) => {
      if (!event.active || (event.delta.x === 0 && event.delta.y === 0)) return;
      const productId = Number(event.active.id);
      const previous = products.find((product) => product.productId === productId);
      if (!previous) return;
      const scale = transformRef.current?.instance.transformState.scale ?? 1;
      const next = { ...previous, x: previous.x + event.delta.x / scale, y: previous.y + event.delta.y / scale };
      onProductsChange(products.map((product) => product.productId === productId ? next : product));
      const result = await updateProductPositionAction({ productId, x: next.x, y: next.y });
      if (!result.ok) {
        onProductsChange(products.map((product) => product.productId === productId ? previous : product));
      }
    }}>
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
              {products.map((product) => <DraggableProduct key={product.productId} product={product} scale={instance.transformState.scale} />)}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
    </DndContext>
  );
}
