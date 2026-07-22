"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, type DragEndEvent, type DragMoveEvent, type DragStartEvent, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
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

function DraggableProduct({ product, scale, selected, groupDelta, dragDisabled, multiTouchGesture, onSelect, onContextMenu, onMultiSelectStart, onLongPress }: { product: CanvasProduct; scale: number; selected: boolean; groupDelta: { x: number; y: number } | null; dragDisabled: boolean; multiTouchGesture: boolean; onSelect: (shift: boolean) => void; onContextMenu: (event: React.MouseEvent) => void; onMultiSelectStart: () => void; onLongPress: (x: number, y: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: product.productId, disabled: dragDisabled });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const multiSelectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const deltaX = isDragging && !multiTouchGesture ? (transform?.x ?? 0) / scale : (groupDelta?.x ?? 0);
  const deltaY = isDragging && !multiTouchGesture ? (transform?.y ?? 0) / scale : (groupDelta?.y ?? 0);
  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (multiSelectTimer.current) clearTimeout(multiSelectTimer.current);
    longPressTimer.current = null;
    multiSelectTimer.current = null;
  };
  useEffect(() => {
    if (isDragging || multiTouchGesture) clearLongPress();
    return clearLongPress;
  }, [isDragging, multiTouchGesture]);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" && event.currentTarget.closest<HTMLElement>("[data-multi-touch='true']")) {
          clearLongPress();
          pointerStart.current = null;
          return;
        }
        listeners?.onPointerDown?.(event);
        if (event.pointerType === "mouse") return;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        longPressTriggered.current = false;
        clearLongPress();
        multiSelectTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          onMultiSelectStart();
        }, 300);
        longPressTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          onLongPress(event.clientX, event.clientY);
        }, 1000);
      }}
      onPointerMove={(event) => {
        if (!pointerStart.current) return;
        if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 8) clearLongPress();
      }}
      onPointerUp={() => { pointerStart.current = null; clearLongPress(); }}
      onPointerCancel={() => { pointerStart.current = null; clearLongPress(); }}
      onClick={(event) => {
        clearLongPress();
        pointerStart.current = null;
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        onSelect(event.shiftKey);
      }}
      onContextMenu={onContextMenu}
      data-product-id={product.productId}
      className={`product-chip absolute flex h-10 w-64 min-w-64 max-w-64 touch-none items-center overflow-hidden rounded-lg border px-3 text-sm font-medium text-white shadow-sm transition-[filter,box-shadow] ${selected ? "border-yellow-300 brightness-125 saturate-150 ring-4 ring-yellow-300/80 ring-offset-2 ring-offset-slate-50" : "border-slate-200"}`}
      style={{
        left: product.x,
        top: product.y,
        backgroundColor: product.color,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
        zIndex: isDragging && !multiTouchGesture ? 20 : 1,
        opacity: isDragging && !multiTouchGesture ? 0.8 : 1,
      }}
    >
      <span aria-hidden="true" className="mr-1.5 shrink-0">📦</span>
      <span className="min-w-0 flex-1 truncate" title={product.name}>{product.name}</span>
      <span className="ml-2 shrink-0 text-xs font-normal text-white/80">({product.quantity})</span>
    </div>
  );
}

export function CanvasViewport({ products, branchId, zone, onProductsChange, onRequestAdd, onRegisterCenterPosition, focusProductId }: { products: CanvasProduct[]; branchId: number; zone: string; onProductsChange: (products: CanvasProduct[]) => void; onRequestAdd: () => void; onRegisterCenterPosition?: (getter: (() => { x: number; y: number }) | null) => void; focusProductId?: number | null }) {
  const { spacePressed } = useKeyboard();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [dragging, setDragging] = useState(false);
  const [trashVisible, setTrashVisible] = useState(false);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dragPreview, setDragPreview] = useState<{ ids: number[]; x: number; y: number } | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ productId: number; x: number; y: number; selectedIds: number[] } | null>(null);
  const [mobileMultiSelect, setMobileMultiSelect] = useState(false);
  const [multiTouchGesture, setMultiTouchGesture] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const selectionMoved = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const productsRef = useRef(products);
  productsRef.current = products;

  useEffect(() => {
    if (!onRegisterCenterPosition) return;
    onRegisterCenterPosition(() => {
      const viewport = canvasRef.current?.getBoundingClientRect();
      const transform = transformRef.current?.instance.transformState;
      if (!viewport || !transform || !transform.scale) return { x: 400, y: 250 };
      const anchorProduct = productsRef.current[0];
      const anchorNode = anchorProduct && canvasRef.current?.querySelector<HTMLElement>(`.product-chip[data-product-id="${anchorProduct.productId}"]`);
      if (anchorProduct && anchorNode) {
        const anchorRect = anchorNode.getBoundingClientRect();
        const anchorWidth = anchorNode.offsetWidth || 256;
        const anchorHeight = anchorNode.offsetHeight || 40;
        const scaleX = anchorRect.width / anchorWidth;
        const scaleY = anchorRect.height / anchorHeight;
        const targetScreenX = window.innerWidth / 2;
        const targetScreenY = window.innerHeight / 2;
        const worldOriginX = anchorRect.left - anchorProduct.x * scaleX;
        const worldOriginY = anchorRect.top - anchorProduct.y * scaleY;
        return {
          x: (targetScreenX - worldOriginX) / scaleX - anchorWidth / 2,
          y: (targetScreenY - worldOriginY) / scaleY - anchorHeight / 2,
        };
      }
      return {
        x: (window.innerWidth / 2 - viewport.left - transform.positionX) / transform.scale - 128,
        y: (window.innerHeight / 2 - viewport.top - transform.positionY) / transform.scale - 20,
      };
    });
    return () => onRegisterCenterPosition(null);
  }, [onRegisterCenterPosition]);
  const activeTouchPointers = useRef(new Set<number>());
  const multiTouchGestureRef = useRef(false);
  const trashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTrashTimer = () => {
    if (trashTimer.current) clearTimeout(trashTimer.current);
    trashTimer.current = null;
  };

  useEffect(() => {
    if (focusProductId === null || focusProductId === undefined) return;
    const frame = window.requestAnimationFrame(() => {
      if (!canvasRef.current || !transformRef.current) return;
      const node = canvasRef.current.querySelector<HTMLElement>(`.product-chip[data-product-id="${focusProductId}"]`);
      if (!node) return;
      const chip = node.getBoundingClientRect();
      const transform = transformRef.current.instance.transformState;
      const deltaX = window.innerWidth / 2 - (chip.left + chip.width / 2);
      const deltaY = window.innerHeight / 2 - (chip.top + chip.height / 2);
      transformRef.current.setTransform(transform.positionX + deltaX, transform.positionY + deltaY, transform.scale, 300);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusProductId]);

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
    void updateProductPositionsAction({ branchId, zone, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) }).then((result) => {
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
    void updateProductPositionsAction({ branchId, zone, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) }).then((result) => {
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
        void setProductLayoutsGroupAction({ branchId, zone, productIds: ids, groupId }).then((result) => {
          if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId } : product));
        });
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const ids = selectedIds.length ? selectedIds : (activeProductId === null ? [] : [activeProductId]);
        if (!ids.length) return;
        event.preventDefault();
        void Promise.all(ids.map((productId) => deleteProductLayoutAction({ productId, branchId, zone }))).then((results) => {
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
        void updateProductPositionsAction({ branchId, zone, positions: nextProducts.filter((product) => selectedIds.includes(product.productId)).map(({ productId, x, y }) => ({ productId, x, y })) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProductId, branchId, onProductsChange, products, selectedIds, zone]);

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
    <DndContext id="warehouse-canvas" sensors={sensors} onDragStart={(event: DragStartEvent) => { if (mobileMultiSelect || multiTouchGestureRef.current) return; const productId = Number(event.active.id); const ids = selectedIds.includes(productId) ? selectedIds : [productId]; setSelectedIds(ids); setDragPreview({ ids, x: 0, y: 0 }); setDragging(true); setTrashVisible(!isTouchDevice); clearTrashTimer(); if (isTouchDevice) trashTimer.current = setTimeout(() => setTrashVisible(true), 100); }} onDragMove={(event: DragMoveEvent) => { if (multiTouchGestureRef.current) return; const scale = transformRef.current?.instance.transformState.scale ?? 1; setDragPreview((preview) => preview ? { ...preview, x: event.delta.x / scale, y: event.delta.y / scale } : null); }} onDragCancel={() => { setDragging(false); setTrashVisible(false); clearTrashTimer(); setDragPreview(null); }} onDragEnd={async (event: DragEndEvent) => {
      setDragging(false);
      setTrashVisible(false);
      clearTrashTimer();
      setDragPreview(null);
      if (multiTouchGestureRef.current) return;
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
        const result = await Promise.all(movingIds.map((id) => deleteProductLayoutAction({ productId: id, branchId, zone })));
        if (result.every((item) => item.ok)) onProductsChange(products.filter((item) => !movingIds.includes(item.productId)));
        return;
      }
      const result = movingIds.length > 1
        ? await updateProductPositionsAction({ branchId, zone, positions: nextProducts.filter((item) => movingIds.includes(item.productId)).map(({ productId: id, x, y }) => ({ productId: id, x, y })) })
        : await updateProductPositionAction({ productId, branchId, zone, x: nextProducts.find((item) => item.productId === productId)?.x ?? previous.x, y: nextProducts.find((item) => item.productId === productId)?.y ?? previous.y });
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
      centerZoomedOut={false}
      limitToBounds={false}
      wheel={{ disabled: false, activationKeys: ["Control"], step: 0.1, smoothStep: 0.01 }}
      panning={{ disabled: !spacePressed && !multiTouchGesture, excluded: spacePressed || multiTouchGesture ? [] : ["product-chip"] }}
      doubleClick={{ disabled: true }}
    >
      {({ resetTransform, instance }) => (
        <div
          ref={canvasRef}
          className={`relative h-full overflow-hidden bg-slate-50 ${spacePressed ? "cursor-grab" : "cursor-default"}`}
          onPointerDownCapture={(event) => {
            if (event.pointerType !== "touch") return;
            activeTouchPointers.current.add(event.pointerId);
            if (activeTouchPointers.current.size >= 2) {
              multiTouchGestureRef.current = true;
              setMultiTouchGesture(true);
              event.currentTarget.dataset.multiTouch = "true";
            }
          }}
          onPointerUpCapture={(event) => {
            if (event.pointerType !== "touch") return;
            activeTouchPointers.current.delete(event.pointerId);
            if (activeTouchPointers.current.size === 0) {
              window.setTimeout(() => {
                multiTouchGestureRef.current = false;
                setMultiTouchGesture(false);
                if (canvasRef.current) delete canvasRef.current.dataset.multiTouch;
              }, 120);
            }
          }}
          onPointerCancelCapture={(event) => {
            if (event.pointerType !== "touch") return;
            activeTouchPointers.current.delete(event.pointerId);
            if (activeTouchPointers.current.size === 0) {
              multiTouchGestureRef.current = false;
              setMultiTouchGesture(false);
              delete event.currentTarget.dataset.multiTouch;
            }
          }}
          onPointerDown={(event) => { const target = event.target instanceof HTMLElement ? event.target : null; if (!isTouchDevice && !spacePressed && event.button === 0 && !target?.closest(".product-chip")) { const rect = event.currentTarget.getBoundingClientRect(); selectionStart.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; selectionMoved.current = false; } }}
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
              {products.map((product) => (
                <div key={product.productId} onFocus={() => setActiveProductId(product.productId)}>
                  <DraggableProduct
                    product={product}
                    scale={instance.transformState.scale}
                    selected={selectedIds.includes(product.productId)}
                    groupDelta={dragPreview?.ids.includes(product.productId) ? { x: dragPreview.x, y: dragPreview.y } : null}
                    dragDisabled={mobileMultiSelect || spacePressed || multiTouchGesture}
                    multiTouchGesture={multiTouchGesture}
                    onSelect={(shift) => {
                      if (spacePressed) return;
                      setContextMenu(null);
                      setActiveProductId(product.productId);
                      setSelectedIds((ids) => {
                        if (mobileMultiSelect || shift) return ids.includes(product.productId) ? ids.filter((id) => id !== product.productId) : [...ids, product.productId];
                        return [product.productId];
                      });
                    }}
                    onMultiSelectStart={() => {
                      setMobileMultiSelect(true);
                      setActiveProductId(product.productId);
                      setSelectedIds((ids) => ids.includes(product.productId) ? ids : [product.productId]);
                    }}
                    onLongPress={(x, y) => {
                      const nextSelectedIds = selectedIds.includes(product.productId) ? selectedIds : [product.productId];
                      setSelectedIds(nextSelectedIds);
                      setContextMenu({ productId: product.productId, x, y, selectedIds: nextSelectedIds });
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      const nextSelectedIds = selectedIds.includes(product.productId) ? selectedIds : [product.productId];
                      setSelectedIds(nextSelectedIds);
                      setContextMenu({ productId: product.productId, x: event.clientX, y: event.clientY, selectedIds: nextSelectedIds });
                    }}
                  />
                </div>
              ))}
            </div>
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
    {contextMenu && <div className="fixed z-50 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" disabled={contextMenu.selectedIds.length < 2} onClick={() => { const ids = contextMenu.selectedIds; const groupId = crypto.randomUUID(); void setProductLayoutsGroupAction({ branchId, zone, productIds: ids, groupId }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId } : product)); }); setContextMenu(null); }}>Group ({contextMenu.selectedIds.length})</button>
      <div className="my-1 border-t" />
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("left")}>Căn trái theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("right")}>Căn phải theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={() => alignSelected("center")}>Căn giữa theo chiều dọc</button>
      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400" disabled={contextMenu.selectedIds.length < 2} onClick={distributeSelectedVertically}>Xếp dọc, cách nhau 5px</button>
      {products.find((product) => product.productId === contextMenu.productId)?.groupId && <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { const group = products.find((product) => product.productId === contextMenu.productId)?.groupId; const ids = products.filter((product) => product.groupId === group).map((product) => product.productId); void setProductLayoutsGroupAction({ branchId, zone, productIds: ids, groupId: null }).then((result) => { if (result.ok) onProductsChange(products.map((product) => ids.includes(product.productId) ? { ...product, groupId: null } : product)); }); setContextMenu(null); }}>Ungroup</button>}
    </div>}
    {dragging && trashVisible && <TrashDropZone />}
    </DndContext>
  );
}
