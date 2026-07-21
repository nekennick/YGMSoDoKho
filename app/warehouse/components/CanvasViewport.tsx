"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent, type DragMoveEvent, type DragStartEvent, useDraggable } from "@dnd-kit/core";
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

function DraggableProduct({ product, scale, selected, groupDelta, onSelect, onContextMenu, onMultiSelectStart, onLongPress }: { product: CanvasProduct; scale: number; selected: boolean; groupDelta: { x: number; y: number } | null; onSelect: (event: { shiftKey: boolean; touch?: boolean }) => void; onContextMenu: (event: React.MouseEvent) => void; onMultiSelectStart: () => void; onLongPress: (x: number, y: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: product.productId });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const multiSelectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const lastPointerWasTouch = useRef(false);
  const deltaX = isDragging ? (transform?.x ?? 0) / scale : (groupDelta?.x ?? 0);
  const deltaY = isDragging ? (transform?.y ?? 0) / scale : (groupDelta?.y ?? 0);
  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (multiSelectTimer.current) clearTimeout(multiSelectTimer.current);
    longPressTimer.current = null;
    multiSelectTimer.current = null;
  };
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(event) => {
        listeners?.onPointerDown?.(event);
        lastPointerWasTouch.current = event.pointerType !== "mouse";
        if (event.pointerType === "mouse") return;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        longPressTriggered.current = false;
        clearLongPress();
        multiSelectTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          onMultiSelectStart();
        }, 300);
        longPressTimer.current = setTimeout(() => {
          onLongPress(event.clientX, event.clientY);
        }, 500);
      }}
      onPointerMove={(event) => {
        if (!pointerStart.current) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 8) clearLongPress();
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "mouse") return;
        const start = pointerStart.current;
        pointerStart.current = null;
        clearLongPress();
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) longPressTriggered.current = true;
      }}
      onPointerCancel={() => { pointerStart.current = null; clearLongPress(); }}
      onClick={(event) => {
        if (lastPointerWasTouch.current) {
          lastPointerWasTouch.current = false;
          clearLongPress();
          pointerStart.current = null;
          if (!longPressTriggered.current) onSelect({ shiftKey: false, touch: true });
          longPressTriggered.current = false;
          return;
        }
        onSelect(event);
      }}
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
  const [trashVisible, setTrashVisible] = useState(false);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dragPreview, setDragPreview] = useState<{ ids: number[]; x: number; y: number } | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ productId: number; x: number; y: number; selectedIds: number[] } | null>(null);
  const [mobileMultiSelect, setMobileMultiSelect] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const selectionMoved = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const trashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTrashTimer = () => {
    if (trashTimer.current) clearTimeout(trashTimer.current);
    trashTimer.current = null;
  };

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouchDevice(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const alignSelected = (mode: "left" | "right" | "center") => {
    if (selectedIds.length < 2) return;
    const widths = new Map<number, number>();
    selectedIds.forEach((id) => {
      const node = canvasRef.current?.querySelector<HTMLElement>(`.product-chip[data-product-id="${id}"]`);
      widths.set(id, node?.offsetWidth ?? 192);
    });
    const selectedProducts = products.filter((product) => selectedIds.includes(product.productId));
    const left = Math.min(...selectedProducts.map((product) => product.x));
    const right = Math.max(...selectedProducts.map((product) => product.x + (widths.get(product.productId) ?? 192)));
    const center = (left + right) / 2;
    const nextProducts = products.map((product) => {
      if (!selectedIds.includes(product.productId)) return product;
      const width = widths.get(product.productId) ?? 192;
      const x = mode === "left" ? left : mode === "right" ? right - width : center - width / 2;
      return { ...product, x };
    });
    onProductsChange(nextProducts);
    void updateProductPositionsAction({ branchId, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) }).then((result) => {
      if (!result.ok) onProductsChange(products);
    });
    setContextMenu(null);
  };

  const distributeSelectedVertically = () => {
    if (selectedIds.length < 2) return;
    const selectedProducts = products
      .filter((product) => selectedIds.includes(product.productId))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const firstY = selectedProducts[0]?.y;
    if (firstY === undefined) return;
    const chipHeight = canvasRef.current?.querySelector<HTMLElement>(".product-chip")?.offsetHeight ?? 40;
    const gap = 5;
    const nextProducts = products.map((product) => {
      const index = selectedProducts.findIndex((item) => item.productId === product.productId);
      return index < 0 ? product : { ...product, y: firstY + index * (chipHeight + gap) };
    });
    onProductsChange(nextProducts);
    void updateProductPositionsAction({ branchId, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) }).then((result) => {
      if (!result.ok) onProductsChange(products);
    });
    setContextMenu(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      const usesCommand = event.ctrlKey || event.metaKey;
      if (usesCommand && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(products.map((product) => product.productId));
        setActiveProductId(products[0]?.productId ?? null);
        return;
      }
      if (event.key === "Escape") {
        setSelectedIds([]);
        setActiveProductId(null);
        setContextMenu(null);
        setMobileMultiSelect(false);
        return;
      }
      if (usesCommand && event.key.toLowerCase() === "g" && (selectedIds.length > 1 || (event.shiftKey && selectedIds.some((id) => products.find((product) => product.productId === id)?.groupId)))) {
        event.preventDefault();
        const groupedIds = event.shiftKey
          ? products.filter((product) => selectedIds.includes(product.productId) && product.groupId).map((product) => product.groupId as string)
          : [];
        const ids = event.shiftKey && groupedIds.length
          ? products.filter((product) => product.groupId && groupedIds.includes(product.groupId)).map((product) => product.productId)
          : selectedIds;
        const groupId = event.shiftKey ? null : crypto.randomUUID();
        void setProductLayoutsGroupAction({ branchId, productIds: ids, groupId }).then((result) => {
          if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId } : product));
        });
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const ids = selectedIds.length ? selectedIds : (activeProductId === null ? [] : [activeProductId]);
        if (!ids.length) return;
        event.preventDefault();
        void Promise.all(ids.map((productId) => deleteProductLayoutAction({ productId, branchId }))).then((results) => {
          if (results.every((result) => result.ok)) {
            onProductsChange(products.filter((product) => !ids.includes(product.productId)));
            setSelectedIds([]);
            setActiveProductId(null);
          }
        });
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selectedIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const nextProducts = products.map((product) => selectedIds.includes(product.productId) ? { ...product, x: product.x + dx, y: product.y + dy } : product);
        onProductsChange(nextProducts);
        void updateProductPositionsAction({ branchId, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProductId, branchId, onProductsChange, products, selectedIds]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!selectionStart.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (Math.abs(x - selectionStart.current.x) > 3 || Math.abs(y - selectionStart.current.y) > 3) selectionMoved.current = true;
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
        setSelectedIds(ids);
      }
      selectionStart.current = null; setSelectionBox(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  return (
    <DndContext id="warehouse-canvas" onDragStart={(event: DragStartEvent) => { const productId = Number(event.active.id); const ids = selectedIds.includes(productId) ? selectedIds : [productId]; setSelectedIds(ids); setDragPreview({ ids, x: 0, y: 0 }); setDragging(true); setTrashVisible(!isTouchDevice); clearTrashTimer(); if (isTouchDevice) trashTimer.current = setTimeout(() => setTrashVisible(true), 700); }} onDragMove={(event: DragMoveEvent) => { const scale = transformRef.current?.instance.transformState.scale ?? 1; setDragPreview((preview) => preview ? { ...preview, x: event.delta.x / scale, y: event.delta.y / scale } : null); }} onDragCancel={() => { setDragging(false); setTrashVisible(false); clearTrashTimer(); setDragPreview(null); }} onDragEnd={async (event: DragEndEvent) => {
      setDragging(false);
      setTrashVisible(false);
      clearTrashTimer();
      setDragPreview(null);
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
          onPointerDown={(event) => { const target = event.target instanceof HTMLElement ? event.target : null; if (!isTouchDevice && event.button === 0 && !target?.closest(".product-chip")) { const rect = event.currentTarget.getBoundingClientRect(); selectionStart.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; selectionMoved.current = false; } }}
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
          onClick={(event) => { setContextMenu(null); const target = event.target instanceof HTMLElement ? event.target : null; if (!target?.closest(".product-chip") && !selectionMoved.current) { setSelectedIds([]); setActiveProductId(null); setMobileMultiSelect(false); } selectionMoved.current = false; }}
        >
          {selectionBox && <div className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-400/20" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
          <div className="absolute left-3 top-3 z-10 rounded-md border bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
            {Math.round(instance.transformState.scale * 100)}%
            <button className="ml-2 underline" onClick={() => resetTransform()}>Reset</button>
          </div>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div className="relative h-[10000px] w-[10000px]">
              {products.map((product) => <div key={product.productId} onFocus={() => setActiveProductId(product.productId)}><DraggableProduct product={product} scale={instance.transformState.scale} selected={selectedIds.includes(product.productId)} groupDelta={dragPreview?.ids.includes(product.productId) ? { x: dragPreview.x, y: dragPreview.y } : null} onSelect={(event) => { if (event.touch) { setContextMenu(null); if (mobileMultiSelect) setSelectedIds((ids) => Array.from(new Set([...ids, product.productId]))); else setSelectedIds([product.productId]); return; } setSelectedIds((ids) => event.shiftKey ? (ids.includes(product.productId) ? ids.filter((id) => id !== product.productId) : [...ids, product.productId]) : [product.productId]); }} onMultiSelectStart={() => { setMobileMultiSelect(true); setSelectedIds([product.productId]); }} onLongPress={(x, y) => { const nextSelectedIds = selectedIds.includes(product.productId) ? selectedIds : [product.productId]; setSelectedIds(nextSelectedIds); setContextMenu({ productId: product.productId, x, y, selectedIds: nextSelectedIds }); }} onContextMenu={(event) => { event.preventDefault(); const nextSelectedIds = selectedIds.includes(product.productId) ? selectedIds : [product.productId]; setSelectedIds(nextSelectedIds); setContextMenu({ productId: product.productId, x: event.clientX, y: event.clientY, selectedIds: nextSelectedIds }); }} /></div>)}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
    {contextMenu && <div className="fixed z-50 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" disabled={contextMenu.selectedIds.length < 2} onClick={() => { const ids = contextMenu.selectedIds; const groupId = crypto.randomUUID(); void setProductLayoutsGroupAction({ branchId, productIds: ids, groupId }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId } : product)); }); setContextMenu(null); }}>Group ({contextMenu.selectedIds.length})</button>
      <div className="my-1 border-t" />
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("left")}>Căn trái theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("right")}>Căn phải theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("center")}>Căn giữa theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={distributeSelectedVertically}>Xếp dọc, cách nhau 5px</button>
      {products.find((product) => product.productId === contextMenu.productId)?.groupId && <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { const group = products.find((product) => product.productId === contextMenu.productId)?.groupId; const ids = products.filter((product) => product.groupId === group).map((product) => product.productId); void setProductLayoutsGroupAction({ branchId, productIds: ids, groupId: null }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId: null } : product)); }); setContextMenu(null); }}>Ungroup</button>}
    </div>}
    {dragging && trashVisible && <TrashDropZone />}
    </DndContext>
  );
}
