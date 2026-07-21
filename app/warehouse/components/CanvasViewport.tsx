"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";
import { updateProductPositionAction } from "@/app/warehouse/actions/product-layout";
import { deleteProductLayoutAction } from "@/app/warehouse/actions/product-layout";

function TrashDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: "trash-zone" });
  return <div ref={setNodeRef} className={`touch-trash-zone fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition ${isOver ? "bg-red-600 text-white scale-110" : "bg-slate-900/90 text-white"}`}>🗑️ {isOver ? "Thả để xóa" : "Kéo vào đây để xóa"}</div>;
}

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
      <span aria-hidden="true">📦 </span>{product.name}<span className="ml-2 text-xs font-normal text-white/80">({product.quantity})</span>
    </div>
  );
}

export function CanvasViewport({ products, branchId, onProductsChange, onRequestAdd }: { products: CanvasProduct[]; branchId: number; onProductsChange: (products: CanvasProduct[]) => void; onRequestAdd: () => void }) {
  const { spacePressed } = useKeyboard();
  const [dragging, setDragging] = useState(false);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== "Delete" && event.key !== "Backspace") || activeProductId === null) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      event.preventDefault();
      const product = products.find((item) => item.productId === activeProductId);
      if (!product) return;
      void deleteProductLayoutAction({ productId: activeProductId, branchId }).then((result) => {
        if (result.ok) onProductsChange(products.filter((item) => item.productId !== activeProductId));
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProductId, branchId, onProductsChange, products]);

  return (
    <DndContext id="warehouse-canvas" onDragStart={() => setDragging(true)} onDragCancel={() => setDragging(false)} onDragEnd={async (event: DragEndEvent) => {
      setDragging(false);
      if (!event.active || (event.delta.x === 0 && event.delta.y === 0)) return;
      const productId = Number(event.active.id);
      const previous = products.find((product) => product.productId === productId);
      if (!previous) return;
      const scale = transformRef.current?.instance.transformState.scale ?? 1;
      const next = { ...previous, x: previous.x + event.delta.x / scale, y: previous.y + event.delta.y / scale };
      onProductsChange(products.map((product) => product.productId === productId ? next : product));
      if (event.over?.id === "trash-zone") {
        const result = await deleteProductLayoutAction({ productId, branchId });
        if (result.ok) onProductsChange(products.filter((item) => item.productId !== productId));
        return;
      }
      const result = await updateProductPositionAction({ productId, branchId, x: next.x, y: next.y });
      if (!result.ok) {
        onProductsChange(products.map((product) => product.productId === productId ? previous : product));
      }
    }}>
    <TransformWrapper
      ref={transformRef}
      minScale={0.2}
      maxScale={5}
      initialScale={1}
      centerOnInit
      centerZoomedOut
      limitToBounds={false}
      wheel={{ disabled: false, activationKeys: ["Control"], step: 0.1, smoothStep: 0.01 }}
      panning={{ disabled: !spacePressed, excluded: ["product-chip"] }}
      doubleClick={{ disabled: true }}
    >
      {({ resetTransform, instance }) => (
        <div
          className={`relative h-full overflow-hidden bg-slate-50 ${spacePressed ? "cursor-grab" : "cursor-default"}`}
          onMouseDown={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            instance.setup.panning.disabled = false;
          }}
          onMouseUp={(event) => {
            if (event.button === 1) instance.setup.panning.disabled = !spacePressed;
          }}
          onContextMenu={(event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (!target?.closest(".product-chip")) {
              event.preventDefault();
              onRequestAdd();
            }
          }}
        >
          <div className="absolute left-3 top-3 z-10 rounded-md border bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
            {Math.round(instance.transformState.scale * 100)}%
            <button className="ml-2 underline" onClick={() => resetTransform()}>Reset</button>
          </div>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div className="relative h-[10000px] w-[10000px]">
              {products.map((product) => <div key={product.productId} onFocus={() => setActiveProductId(product.productId)}><DraggableProduct product={product} scale={instance.transformState.scale} /></div>)}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
    {dragging && <TrashDropZone />}
    </DndContext>
  );
}
