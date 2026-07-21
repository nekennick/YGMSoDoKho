"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";
import { updateProductPositionAction, updateProductPositionsAction, setProductLayoutsGroupAction } from "@/app/warehouse/actions/product-layout";
import { deleteProductLayoutAction } from "@/app/warehouse/actions/product-layout";

function TrashDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: "trash-zone" });
  return <div ref={setNodeRef} className={`touch-trash-zone fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition ${isOver ? "bg-red-600 text-white scale-110" : "bg-slate-900/90 text-white"}`}>🗑️ {isOver ? "Thả để xóa" : "Kéo vào đây để xóa"}</div>;
}

function DraggableProduct({ product, scale, selected, onSelect, onContextMenu }: { product: CanvasProduct; scale: number; selected: boolean; onSelect: (shift: boolean) => void; onContextMenu: (event: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: product.productId });
  const deltaX = (transform?.x ?? 0) / scale;
  const deltaY = (transform?.y ?? 0) / scale;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(event) => onSelect(event.shiftKey)}
      onContextMenu={onContextMenu}
      data-product-id={product.productId}
      className={`product-chip absolute min-w-48 touch-none rounded-lg border px-3 py-2 text-sm font-medium text-white shadow-sm transition-[filter,box-shadow] ${selected ? "border-yellow-300 brightness-125 saturate-150 ring-4 ring-yellow-300/80 ring-offset-2 ring-offset-slate-50" : "border-slate-200"}`}
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{ productId: number; x: number; y: number; selectedIds: number[] } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!selectionStart.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setSelectionBox({ x: Math.min(selectionStart.current.x, x), y: Math.min(selectionStart.current.y, y), width: Math.abs(x - selectionStart.current.x), height: Math.abs(y - selectionStart.current.y) });
    };
    const onUp = (event: PointerEvent) => {
      if (selectionStart.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const endX = event.clientX - rect.left;
        const endY = event.clientY - rect.top;
        const left = Math.min(selectionStart.current.x, endX);
        const top = Math.min(selectionStart.current.y, endY);
        const right = Math.max(selectionStart.current.x, endX);
        const bottom = Math.max(selectionStart.current.y, endY);
        const ids = Array.from(canvasRef.current.querySelectorAll<HTMLElement>(".product-chip")).filter((node) => { const item = node.getBoundingClientRect(); const x = item.left - rect.left; const y = item.top - rect.top; return x < right && x + item.width > left && y < bottom && y + item.height > top; }).map((node) => Number(node.dataset.productId)).filter(Number.isFinite);
        if (ids.length) setSelectedIds(ids);
      }
      selectionStart.current = null; setSelectionBox(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  return (
    <DndContext id="warehouse-canvas" onDragStart={() => setDragging(true)} onDragCancel={() => setDragging(false)} onDragEnd={async (event: DragEndEvent) => {
      setDragging(false);
      if (!event.active || (event.delta.x === 0 && event.delta.y === 0)) return;
      const productId = Number(event.active.id);
      const movingIds = selectedIds.includes(productId) ? selectedIds : [productId];
      const previous = products.find((product) => product.productId === productId);
      if (!previous) return;
      const scale = transformRef.current?.instance.transformState.scale ?? 1;
      const dx = event.delta.x / scale;
      const dy = event.delta.y / scale;
      const nextProducts = products.map((product) => movingIds.includes(product.productId) ? { ...product, x: product.x + dx, y: product.y + dy } : product);
      onProductsChange(nextProducts);
      if (event.over?.id === "trash-zone") {
        const result = await Promise.all(movingIds.map((id) => deleteProductLayoutAction({ productId: id, branchId })));
        if (result.every((item) => item.ok)) onProductsChange(products.filter((item) => !movingIds.includes(item.productId)));
        return;
      }
      const result = movingIds.length > 1
        ? await updateProductPositionsAction({ branchId, positions: nextProducts.filter((item) => movingIds.includes(item.productId)).map(({ productId: id, x, y }) => ({ productId: id, x, y })) })
        : await updateProductPositionAction({ productId, branchId, x: nextProducts.find((item) => item.productId === productId)?.x ?? previous.x, y: nextProducts.find((item) => item.productId === productId)?.y ?? previous.y });
      if (!result.ok) {
        onProductsChange(products);
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
          ref={canvasRef}
          className={`relative h-full overflow-hidden bg-slate-50 ${spacePressed ? "cursor-grab" : "cursor-default"}`}
          onPointerDown={(event) => { const target = event.target instanceof HTMLElement ? event.target : null; if (event.button === 0 && !target?.closest(".product-chip")) { const rect = event.currentTarget.getBoundingClientRect(); selectionStart.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; } }}
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
          onClick={() => { setContextMenu(null); }}
        >
          {selectionBox && <div className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-400/20" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
          <div className="absolute left-3 top-3 z-10 rounded-md border bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
            {Math.round(instance.transformState.scale * 100)}%
            <button className="ml-2 underline" onClick={() => resetTransform()}>Reset</button>
          </div>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div className="relative h-[10000px] w-[10000px]">
              {products.map((product) => <div key={product.productId} onFocus={() => setActiveProductId(product.productId)}><DraggableProduct product={product} scale={instance.transformState.scale} selected={selectedIds.includes(product.productId)} onSelect={(shift) => setSelectedIds((ids) => shift ? (ids.includes(product.productId) ? ids.filter((id) => id !== product.productId) : [...ids, product.productId]) : [product.productId])} onContextMenu={(event) => { event.preventDefault(); const nextSelectedIds = selectedIds.includes(product.productId) ? selectedIds : [product.productId]; setSelectedIds(nextSelectedIds); setContextMenu({ productId: product.productId, x: event.clientX, y: event.clientY, selectedIds: nextSelectedIds }); }} /></div>)}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
    {contextMenu && <div className="fixed z-50 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" disabled={contextMenu.selectedIds.length < 2} onClick={() => { const ids = contextMenu.selectedIds; const groupId = crypto.randomUUID(); void setProductLayoutsGroupAction({ branchId, productIds: ids, groupId }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId } : product)); }); setContextMenu(null); }}>Group ({contextMenu.selectedIds.length})</button>
      {products.find((product) => product.productId === contextMenu.productId)?.groupId && <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { const group = products.find((product) => product.productId === contextMenu.productId)?.groupId; const ids = products.filter((product) => product.groupId === group).map((product) => product.productId); void setProductLayoutsGroupAction({ branchId, productIds: ids, groupId: null }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId: null } : product)); }); setContextMenu(null); }}>Ungroup</button>}
    </div>}
    {dragging && <TrashDropZone />}
    </DndContext>
  );
}
