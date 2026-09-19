"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, type DragEndEvent, type DragMoveEvent, type DragStartEvent, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";
import { deleteProductLayoutAction, moveProductLayoutsAction, restoreProductLayoutsAction, setProductLayoutsGroupAction, updateProductColorsAction } from "@/app/warehouse/actions/product-layout";
import { WarehouseFloorPlan } from "@/app/warehouse/components/WarehouseFloorPlan";
import { findNearestValidFloorPlanPosition, getFloorPlanCanvasRect, getWarehouseFloorPlan, isPositionInsideFloorPlan, PRODUCT_CHIP_HEIGHT, PRODUCT_CHIP_WIDTH } from "@/lib/warehouse/floor-plans";
import { useWarehouseSettings } from "@/app/warehouse/components/WarehouseSettings";
import { saveWarehouseZoneMarkerAction } from "@/app/warehouse/actions/zone-marker";
import { DRY_ZONE_MARKER_HEIGHT, DRY_ZONE_MARKER_KEY, DRY_ZONE_MARKER_LABELS, DRY_ZONE_MARKER_SPACING, DRY_ZONE_MARKER_WIDTH, type ZoneMarkerLayout } from "@/lib/warehouse/zone-markers";

const NAME_VISIBLE_SCALE = 0.3;
const DETAILS_VISIBLE_SCALE = 0.7;
const CANVAS_SIZE = 12000;
const PLAN_GAP = 520;
const CHIP_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#475569", "#92400e"];
const DRY_ZONE_MARKER_DRAG_ID = "dry-zone-marker-strip";

type ZonedProduct = CanvasProduct & { zone: string };
type Point = { x: number; y: number };

function zoneOffsets(branchId: number, zones: readonly string[]) {
  if (zones.includes("cold") && zones.includes("dry")) {
    // Kho Đông đang dùng toạ độ gốc (240, 240); đưa nó vào đúng vùng 16 × 26 m
    // ở góc trên trái của Kho Khô mà không sửa bất kỳ toạ độ nào trong cơ sở dữ liệu.
    return new Map<string, Point>([["dry", { x: 0, y: 0 }], ["cold", { x: -240, y: -240 }]]);
  }
  let nextX = 300;
  const offsets = new Map<string, Point>();
  for (const zone of zones) {
    const plan = getWarehouseFloorPlan(branchId, zone);
    if (!plan) { offsets.set(zone, { x: 0, y: 0 }); continue; }
    const rect = getFloorPlanCanvasRect(plan);
    offsets.set(zone, { x: nextX - rect.x, y: 420 - rect.y });
    nextX += rect.width + PLAN_GAP;
  }
  return offsets;
}

const ProductChip = memo(function ProductChip({ product, world, scale, selected, disabled, overview, showDetails, dimmed, showInventory, groupDelta, onSelect, onContextMenu }: { product: ZonedProduct; world: Point; scale: number; selected: boolean; disabled: boolean; overview: boolean; showDetails: boolean; dimmed: boolean; showInventory: boolean; groupDelta: Point | null; onSelect: (productId: number, shift: boolean) => void; onContextMenu: (productId: number, event: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: product.productId, disabled });
  const dx = isDragging ? (transform?.x ?? 0) / scale : (groupDelta?.x ?? 0);
  const dy = isDragging ? (transform?.y ?? 0) / scale : (groupDelta?.y ?? 0);
  if (overview) {
    return <div title={product.name} data-product-id={product.productId} className={`product-chip absolute h-10 w-[250px] rounded-md border border-white/70 shadow-sm ${selected ? "ring-4 ring-yellow-300" : ""} ${dimmed ? "opacity-20" : "opacity-95"}`} style={{ left: world.x, top: world.y, backgroundColor: product.color }} />;
  }
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} data-product-id={product.productId} title={product.name} onClick={(event) => onSelect(product.productId, event.shiftKey)} onContextMenu={(event) => onContextMenu(product.productId, event)}
      className={`product-chip absolute flex h-10 w-[250px] touch-none items-center overflow-hidden rounded-lg border px-3 text-3xl font-medium text-white shadow-sm ${selected ? "border-yellow-300 ring-4 ring-yellow-300/80 ring-offset-2" : product.groupId ? "border-violet-100 ring-2 ring-violet-300/80" : "border-white/60"} ${dimmed ? "opacity-25" : ""}`}
      style={{ left: world.x, top: world.y, backgroundColor: product.color, transform: `translate3d(${dx}px, ${dy}px, 0)`, zIndex: isDragging ? 20 : 1 }}>
      <span className="min-w-0 flex-1 truncate">{product.name}</span>
      {showDetails && showInventory && <span className="ml-2 shrink-0 text-sm font-normal text-white/80">({product.quantity})</span>}
      {showDetails && product.groupId && <span className="ml-1.5 shrink-0 text-xs" title="Đã group">⛓</span>}
    </div>
  );
});

const ZoneMarkerStrip = memo(function ZoneMarkerStrip({ layout, scale, disabled, onContextMenu }: { layout: ZoneMarkerLayout; scale: number; disabled: boolean; onContextMenu: (event: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: DRY_ZONE_MARKER_DRAG_ID, disabled });
  const dx = isDragging ? (transform?.x ?? 0) / scale : 0;
  const dy = isDragging ? (transform?.y ?? 0) / scale : 0;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`zone-marker-strip pointer-events-none absolute ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      style={{ left: layout.x, top: layout.y, width: DRY_ZONE_MARKER_WIDTH, height: DRY_ZONE_MARKER_SPACING * (DRY_ZONE_MARKER_LABELS.length - 1) + DRY_ZONE_MARKER_HEIGHT, transform: `translate3d(${dx}px, ${dy}px, 0)`, zIndex: layout.locked ? 0 : 10 }}
      onContextMenu={onContextMenu} title={layout.locked ? "Chuột phải để mở khóa dãy phân khu" : "Kéo để canh dãy phân khu. Chuột phải để cố định xuống nền"}>
      {DRY_ZONE_MARKER_LABELS.map((label, index) => (
        <div key={label} className="pointer-events-auto absolute left-0 h-[80px] w-full touch-none" style={{ top: index * DRY_ZONE_MARKER_SPACING }}>
          <div className="absolute left-0 top-[38px] h-px w-[1120px] bg-amber-400 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" />
          <span className="absolute left-[1160px] top-0 flex h-[76px] w-[140px] items-center justify-center rounded-md border-2 border-amber-600 bg-amber-300/95 text-[56px] font-black leading-none text-amber-950 shadow-sm">{label}</span>
        </div>
      ))}
    </div>
  );
});

export function CanvasViewport({ products, branchId, zone, dryZoneMarker, onDryZoneMarkerChange, onProductsChange, onProductsDeleted, onProductsRestored, onRequestAdd, onRegisterCenterPosition, focusProductId }: { products: CanvasProduct[]; branchId: number; zone: string; dryZoneMarker: ZoneMarkerLayout | null; onDryZoneMarkerChange: (layout: ZoneMarkerLayout) => void; onProductsChange: (products: CanvasProduct[]) => void; onProductsDeleted?: (products: CanvasProduct[]) => void; onProductsRestored?: (products: CanvasProduct[]) => void; onRequestAdd: () => void; onRegisterCenterPosition?: (getter: (() => Point) | null) => void; focusProductId?: number | null }) {
  const { spacePressed } = useKeyboard();
  const { settings } = useWarehouseSettings();
  const allProducts = products as ZonedProduct[];
  const zoneKey = [...new Set([
    ...allProducts.map((item) => item.zone ?? zone),
    ...(getWarehouseFloorPlan(branchId, "cold") ? ["cold", "dry"] : []),
  ])].sort((a, b) => a === "cold" ? -1 : b === "cold" ? 1 : a.localeCompare(b)).join("|");
  const zones = useMemo(() => zoneKey ? zoneKey.split("|") : [zone], [zone, zoneKey]);
  const offsets = useMemo(() => zoneOffsets(branchId, zones), [branchId, zones]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [scale, setScale] = useState(0.3);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; productId: number } | null>(null);
  const [zoneMarkerContextMenu, setZoneMarkerContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ ids: number[]; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const undoHistory = useRef<ZonedProduct[][]>([]);
  const pendingMutations = useRef(new Set<Promise<unknown>>());
  const selectionStart = useRef<Point | null>(null);
  const selectionDragged = useRef(false);
  const selectionJustEnded = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  const draggingIdsRef = useRef<number[]>([]);
  const handledFocusProductId = useRef<number | null>(null);
  const didInitialFit = useRef(false);
  const middlePanStart = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null);
  const markerDragActive = useRef(false);
  const overview = scale < NAME_VISIBLE_SCALE;
  const showDetails = scale >= DETAILS_VISIBLE_SCALE;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  selectedIdsRef.current = selectedIds;
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const matches = useMemo(() => normalizedQuery ? new Set(allProducts.filter((item) => item.name.toLocaleLowerCase("vi").includes(normalizedQuery)).map((item) => item.productId)) : null, [allProducts, normalizedQuery]);

  const worldPosition = useCallback((item: ZonedProduct): Point => {
    const offset = offsets.get(item.zone) ?? { x: 0, y: 0 };
    return { x: item.x + offset.x, y: item.y + offset.y };
  }, [offsets]);
  const resolveDropZone = useCallback((world: Point): string | null => {
    const candidateZones = [...zones].sort((first, second) => first === "cold" ? -1 : second === "cold" ? 1 : 0);
    for (const candidateZone of candidateZones) {
      const floorPlan = getWarehouseFloorPlan(branchId, candidateZone);
      const offset = offsets.get(candidateZone) ?? { x: 0, y: 0 };
      if (!floorPlan) return candidateZone;
      const rect = getFloorPlanCanvasRect(floorPlan);
      const center = { x: world.x + PRODUCT_CHIP_WIDTH / 2, y: world.y + PRODUCT_CHIP_HEIGHT / 2 };
      if (center.x >= rect.x + offset.x && center.x <= rect.x + offset.x + rect.width
        && center.y >= rect.y + offset.y && center.y <= rect.y + offset.y + rect.height) return candidateZone;
    }
    return null;
  }, [branchId, offsets, zones]);
  const worldPositions = useMemo(() => new Map(allProducts.map((item) => [item.productId, worldPosition(item)])), [allProducts, worldPosition]);
  const sameZoneSelection = useCallback((productId: number, shift: boolean) => {
    const product = allProducts.find((item) => item.productId === productId);
    if (!product) return;
    setSelectedIds((current) => {
      const compatible = current.filter((id) => allProducts.find((item) => item.productId === id)?.zone === product.zone);
      if (!shift) return [productId];
      return compatible.includes(productId) ? compatible.filter((id) => id !== productId) : [...compatible, productId];
    });
  }, [allProducts]);
  const openContextMenu = useCallback((productId: number, event: React.MouseEvent) => {
    event.preventDefault();
    if (!selectedSet.has(productId)) sameZoneSelection(productId, false);
    setContextMenu({ x: event.clientX, y: event.clientY, productId });
  }, [sameZoneSelection, selectedSet]);
  const trackMutation = useCallback(<T,>(promise: Promise<T>) => { pendingMutations.current.add(promise); void promise.finally(() => pendingMutations.current.delete(promise)); return promise; }, []);
  const saveUndo = useCallback((snapshot: ZonedProduct[]) => { undoHistory.current = [...undoHistory.current, snapshot.map((item) => ({ ...item }))].slice(-10); setUndoCount(undoHistory.current.length); }, []);
  const restoreSnapshot = useCallback((snapshot: ZonedProduct[]) => {
    const byZone = new Map<string, ZonedProduct[]>();
    snapshot.forEach((item) => byZone.set(item.zone, [...(byZone.get(item.zone) ?? []), item]));
    return Promise.all([...byZone].map(([targetZone, items]) => restoreProductLayoutsAction({ branchId, zone: targetZone, products: items.map(({ productId, x, y, color, groupId }) => ({ productId, x, y, color, groupId })) }))).then((result) => result.every((item) => item.ok));
  }, [branchId]);
  const undo = useCallback(() => {
    const snapshot = undoHistory.current.at(-1);
    if (!snapshot) return;
    undoHistory.current = undoHistory.current.slice(0, -1); setUndoCount(undoHistory.current.length);
    onProductsChange(snapshot); onProductsRestored?.(snapshot); setSelectedIds([]); setContextMenu(null);
    void trackMutation(Promise.allSettled([...pendingMutations.current]).then(() => restoreSnapshot(snapshot))).then((ok) => { if (!ok) setNotice("Không thể lưu thao tác hoàn tác."); });
  }, [onProductsChange, onProductsRestored, restoreSnapshot, trackMutation]);
  const selectedProducts = useMemo(() => allProducts.filter((item) => selectedSet.has(item.productId)), [allProducts, selectedSet]);
  const selectedZone = selectedProducts[0]?.zone;
  const clampMarkerPosition = useCallback((position: Point): Point => {
    const snap = (value: number) => Math.round(value / 50) * 50;
    return { x: snap(position.x), y: snap(position.y) };
  }, []);
  const updateDryZoneMarker = useCallback((next: ZoneMarkerLayout) => {
    if (!dryZoneMarker) return;
    const before = dryZoneMarker;
    onDryZoneMarkerChange(next);
    setZoneMarkerContextMenu(null);
    void trackMutation(saveWarehouseZoneMarkerAction({ branchId, zone: "dry", key: DRY_ZONE_MARKER_KEY, ...next })).then((result) => {
      if (!result.ok) {
        onDryZoneMarkerChange(before);
        setNotice(result.message);
      }
    });
  }, [branchId, dryZoneMarker, onDryZoneMarkerChange, trackMutation]);
  const canPlace = useCallback((next: ZonedProduct[], ids: readonly number[]) => next.filter((item) => ids.includes(item.productId)).every((item) => {
    const plan = getWarehouseFloorPlan(branchId, item.zone);
    return !plan || isPositionInsideFloorPlan(plan, item);
  }), [branchId]);
  const persistPositions = useCallback((next: ZonedProduct[], ids: number[]) => moveProductLayoutsAction({
    branchId,
    products: next.filter((item) => ids.includes(item.productId)).map(({ productId, zone: targetZone, x, y }) => ({ productId, zone: targetZone, x, y })),
  }).then((result) => result.ok), [branchId]);
  const updatePositions = useCallback((next: ZonedProduct[], ids: number[]) => {
    if (!canPlace(next, ids)) { setNotice("Vị trí này nằm trong khu vực không được đặt chip."); return; }
    saveUndo(allProducts); onProductsChange(next);
    void trackMutation(persistPositions(next, ids)).then((ok) => { if (!ok) { onProductsChange(allProducts); setNotice("Không thể lưu vị trí chip."); } });
  }, [allProducts, canPlace, onProductsChange, persistPositions, saveUndo, trackMutation]);
  const arrange = useCallback((kind: "vertical" | "horizontal" | "grid") => {
    if (selectedProducts.length < 2 || !selectedZone) return;
    const ordered = [...selectedProducts].sort((a, b) => a.y - b.y || a.x - b.x);
    const first = ordered[0]; const columns = Math.ceil(Math.sqrt(ordered.length));
    const indexById = new Map(ordered.map((item, index) => [item.productId, index]));
    const next = allProducts.map((item) => {
      const index = indexById.get(item.productId); if (index === undefined) return item;
      const x = kind === "vertical" ? first.x : first.x + (kind === "horizontal" ? index : index % columns) * (PRODUCT_CHIP_WIDTH + 5);
      const y = kind === "horizontal" ? first.y : first.y + (kind === "vertical" ? index : Math.floor(index / columns)) * (PRODUCT_CHIP_HEIGHT + 5);
      return { ...item, x, y };
    });
    updatePositions(next, selectedProducts.map((item) => item.productId)); setContextMenu(null);
  }, [allProducts, selectedProducts, selectedZone, updatePositions]);
  const changeColor = useCallback((color: string) => {
    if (!selectedProducts.length || !selectedZone) return;
    const ids = selectedProducts.map((item) => item.productId); const before = allProducts;
    const next = allProducts.map((item) => ids.includes(item.productId) ? { ...item, color } : item);
    saveUndo(before); onProductsChange(next); setContextMenu(null);
    void trackMutation(updateProductColorsAction({ branchId, zone: selectedZone, productIds: ids, color })).then((result) => { if (!result.ok) { onProductsChange(before); setNotice(result.message); } });
  }, [allProducts, branchId, onProductsChange, saveUndo, selectedProducts, selectedZone, trackMutation]);
  const group = useCallback((groupId: string | null) => {
    if (!selectedProducts.length || !selectedZone) return;
    const ids = selectedProducts.map((item) => item.productId); const before = allProducts;
    const next = allProducts.map((item) => ids.includes(item.productId) ? { ...item, groupId } : item);
    saveUndo(before); onProductsChange(next); setContextMenu(null);
    void trackMutation(setProductLayoutsGroupAction({ branchId, zone: selectedZone, productIds: ids, groupId })).then((result) => { if (!result.ok) { onProductsChange(before); setNotice(result.message); } });
  }, [allProducts, branchId, onProductsChange, saveUndo, selectedProducts, selectedZone, trackMutation]);
  const removeSelected = useCallback(() => {
    if (!selectedProducts.length) return;
    const before = allProducts; const ids = selectedProducts.map((item) => item.productId);
    saveUndo(before); onProductsChange(allProducts.filter((item) => !ids.includes(item.productId))); onProductsDeleted?.(selectedProducts); setSelectedIds([]); setContextMenu(null);
    void trackMutation(Promise.all(selectedProducts.map((item) => deleteProductLayoutAction({ productId: item.productId, branchId, zone: item.zone }))).then((items) => items.every((item) => item.ok))).then((ok) => { if (!ok) { onProductsChange(before); setNotice("Không thể xóa chip."); } });
  }, [allProducts, branchId, onProductsChange, onProductsDeleted, saveUndo, selectedProducts, trackMutation]);

  const fitAll = useCallback((duration = 250) => {
    const viewport = canvasRef.current?.getBoundingClientRect(); if (!viewport || !transformRef.current) return;
    const rects = zones.flatMap((targetZone) => {
      const plan = getWarehouseFloorPlan(branchId, targetZone);
      if (!plan) return [];
      const rect = getFloorPlanCanvasRect(plan);
      const offset = offsets.get(targetZone) ?? { x: 0, y: 0 };
      return [{ x: rect.x + offset.x, y: rect.y + offset.y, width: rect.width, height: rect.height }];
    });
    if (!rects.length) return;
    const left = Math.min(...rects.map((item) => item.x)); const top = Math.min(...rects.map((item) => item.y)); const right = Math.max(...rects.map((item) => item.x + item.width)); const bottom = Math.max(...rects.map((item) => item.y + item.height));
    const factor = Math.max(0.2, Math.min(0.65, Math.min((viewport.width - 96) / (right - left), (viewport.height - 96) / (bottom - top))));
    transformRef.current.setTransform(viewport.width / 2 - (left + right) / 2 * factor, viewport.height / 2 - (top + bottom) / 2 * factor, factor, duration);
  }, [branchId, offsets, zones]);
  useEffect(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;
    const frame = requestAnimationFrame(() => fitAll(0));
    return () => cancelAnimationFrame(frame);
  }, [fitAll]);
  useEffect(() => { undoHistory.current = []; setUndoCount(0); }, [branchId, zone]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!onRegisterCenterPosition) return; onRegisterCenterPosition(() => ({ x: 400, y: 250 })); return () => onRegisterCenterPosition(null); }, [onRegisterCenterPosition]);
  useEffect(() => {
    if (focusProductId == null) { handledFocusProductId.current = null; return; }
    if (handledFocusProductId.current === focusProductId) return;
    const item = allProducts.find((product) => product.productId === focusProductId);
    if (!item || !transformRef.current || !canvasRef.current) return;
    const world = worldPosition(item);
    const rect = canvasRef.current.getBoundingClientRect();
    const current = transformRef.current.instance.transformState;
    handledFocusProductId.current = focusProductId;
    transformRef.current.setTransform(rect.width / 2 - (world.x + PRODUCT_CHIP_WIDTH / 2) * current.scale, rect.height / 2 - (world.y + PRODUCT_CHIP_HEIGHT / 2) * current.scale, Math.max(current.scale, NAME_VISIBLE_SCALE), 250);
  }, [allProducts, focusProductId, worldPosition]);
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; } if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length) { event.preventDefault(); removeSelected(); } }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [removeSelected, selectedIds.length, undo]);
  const visibleProducts = useMemo(() => allProducts, [allProducts]);

  return <DndContext sensors={sensors} autoScroll={false} onDragStart={(event: DragStartEvent) => {
    if (event.active.id === DRY_ZONE_MARKER_DRAG_ID) {
      markerDragActive.current = true;
      setContextMenu(null);
      return;
    }
    if (overview || spacePressed) return;
    const item = allProducts.find((product) => product.productId === Number(event.active.id));
    if (!item) return;
    const currentSelection = selectedIdsRef.current;
    const ids = item.groupId
      ? allProducts.filter((product) => product.zone === item.zone && product.groupId === item.groupId).map((product) => product.productId)
      : currentSelection.includes(item.productId) ? currentSelection : [item.productId];
    draggingIdsRef.current = ids;
    setSelectedIds(ids);
    setDragPreview({ ids, x: 0, y: 0 });
  }} onDragMove={(event: DragMoveEvent) => {
    if (markerDragActive.current || event.active.id === DRY_ZONE_MARKER_DRAG_ID) return;
    const currentScale = transformRef.current?.instance.transformState.scale ?? 1;
    if (draggingIdsRef.current.length) setDragPreview({ ids: draggingIdsRef.current, x: event.delta.x / currentScale, y: event.delta.y / currentScale });
  }} onDragCancel={() => { markerDragActive.current = false; draggingIdsRef.current = []; setDragPreview(null); }} onDragEnd={(event: DragEndEvent) => {
    if (markerDragActive.current || event.active.id === DRY_ZONE_MARKER_DRAG_ID) {
      markerDragActive.current = false;
      if (!dryZoneMarker || dryZoneMarker.locked || overview) return;
      const currentScale = transformRef.current?.instance.transformState.scale ?? 1;
      const nextPosition = clampMarkerPosition({ x: dryZoneMarker.x + event.delta.x / currentScale, y: dryZoneMarker.y + event.delta.y / currentScale });
      if (nextPosition.x !== dryZoneMarker.x || nextPosition.y !== dryZoneMarker.y) updateDryZoneMarker({ ...dryZoneMarker, ...nextPosition });
      return;
    }
    const moving = draggingIdsRef.current;
    draggingIdsRef.current = [];
    setDragPreview(null);
    if (overview || (!event.delta.x && !event.delta.y)) return;
    const id = Number(event.active.id); const active = allProducts.find((item) => item.productId === id);
    if (!active) return;
    const ids = moving.length ? moving : [id];
    const currentScale = transformRef.current?.instance.transformState.scale ?? 1;
    const rawDelta = { x: event.delta.x / currentScale, y: event.delta.y / currentScale };
    const activeWorld = worldPosition(active);
    const targetZone = resolveDropZone({ x: activeWorld.x + rawDelta.x, y: activeWorld.y + rawDelta.y });
    if (!targetZone) { setNotice("Hãy thả chip vào phạm vi hợp lệ của một kho."); return; }
    const targetOffset = offsets.get(targetZone) ?? { x: 0, y: 0 };
    const targetPlan = getWarehouseFloorPlan(branchId, targetZone);
    const rawTargetPosition = { x: activeWorld.x + rawDelta.x - targetOffset.x, y: activeWorld.y + rawDelta.y - targetOffset.y };
    const targetPosition = targetPlan ? findNearestValidFloorPlanPosition(targetPlan, rawTargetPosition) : rawTargetPosition;
    const delta = { x: targetPosition.x + targetOffset.x - activeWorld.x, y: targetPosition.y + targetOffset.y - activeWorld.y };
    const next = allProducts.map((item) => ids.includes(item.productId)
      ? { ...item, zone: targetZone, x: worldPosition(item).x + delta.x - targetOffset.x, y: worldPosition(item).y + delta.y - targetOffset.y }
      : item);
    updatePositions(next, ids);
  }}>
    <TransformWrapper ref={transformRef} minScale={0.2} maxScale={4} limitToBounds={false} centerZoomedOut={false} wheel={{ activationKeys: ["Control"], step: 0.02 }} panning={{ disabled: !spacePressed, excluded: ["product-chip", "canvas-control"] }} doubleClick={{ disabled: true }} onTransformed={(_, state) => setScale((current) => Math.abs(current - state.scale) > 0.01 ? state.scale : current)}>
      {({ resetTransform }) => <div ref={canvasRef} className="relative h-full overflow-hidden bg-slate-200" onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".canvas-control")) searchInputRef.current?.blur();
        if (event.button === 1) {
          event.preventDefault();
          const transform = transformRef.current?.instance.transformState;
          if (transform) middlePanStart.current = { x: event.clientX, y: event.clientY, positionX: transform.positionX, positionY: transform.positionY };
          return;
        }
        if (!overview && event.button === 0 && !target.closest(".product-chip") && !target.closest(".zone-marker-strip") && !target.closest(".canvas-control")) { const rect = event.currentTarget.getBoundingClientRect(); selectionStart.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }; selectionDragged.current = false; }
      }} onPointerMove={(event) => {
        const middleStart = middlePanStart.current;
        if (middleStart && transformRef.current) {
          event.preventDefault();
          const transform = transformRef.current.instance.transformState;
          transformRef.current.setTransform(middleStart.positionX + event.clientX - middleStart.x, middleStart.positionY + event.clientY - middleStart.y, transform.scale, 0);
          return;
        }
        if (!selectionStart.current) return; const rect = event.currentTarget.getBoundingClientRect(); const end = { x: event.clientX - rect.left, y: event.clientY - rect.top }; const width = Math.abs(end.x - selectionStart.current.x); const height = Math.abs(end.y - selectionStart.current.y); if (width > 3 || height > 3) selectionDragged.current = true; setSelectionBox({ x: Math.min(selectionStart.current.x, end.x), y: Math.min(selectionStart.current.y, end.y), width, height });
      }} onPointerUp={() => { middlePanStart.current = null; selectionJustEnded.current = selectionDragged.current; if (selectionBox && selectionDragged.current && canvasRef.current) { const canvas = canvasRef.current.getBoundingClientRect(); const ids = [...canvasRef.current.querySelectorAll<HTMLElement>(".product-chip")].filter((node) => { const rect = node.getBoundingClientRect(); const left = rect.left - canvas.left; const top = rect.top - canvas.top; return left < selectionBox.x + selectionBox.width && left + rect.width > selectionBox.x && top < selectionBox.y + selectionBox.height && top + rect.height > selectionBox.y; }).map((node) => Number(node.dataset.productId)); const first = allProducts.find((item) => item.productId === ids[0]); setSelectedIds(first ? ids.filter((id) => allProducts.find((item) => item.productId === id)?.zone === first.zone) : []); } selectionStart.current = null; setSelectionBox(null); }} onPointerCancel={() => { middlePanStart.current = null; markerDragActive.current = false; selectionStart.current = null; selectionDragged.current = false; selectionJustEnded.current = false; setSelectionBox(null); }} onClick={(event) => { const target = event.target as HTMLElement; if (!target.closest(".product-chip") && !target.closest(".zone-marker-strip") && !target.closest(".canvas-control")) { setContextMenu(null); setZoneMarkerContextMenu(null); if (!selectionJustEnded.current) setSelectedIds([]); } selectionJustEnded.current = false; }} onContextMenu={(event) => { const target = event.target as HTMLElement; if (!target.closest(".product-chip") && !target.closest(".zone-marker-strip")) { event.preventDefault(); onRequestAdd(); } }}>
        <div className="canvas-control absolute left-3 top-3 z-30 flex items-center gap-2 rounded-md border bg-white/95 p-2 text-xs shadow-sm"><span>{Math.round(scale * 100)}%</span><button className="underline" onClick={() => fitAll()}>Xem cả hai kho</button><button className="underline" onClick={() => resetTransform()}>Đặt lại</button>{overview && <span className="text-slate-500">Zoom gần để kéo thả</span>}</div>
        <div className="canvas-control absolute right-3 top-3 z-30 flex w-64 items-center gap-2 rounded-md border bg-white/95 p-2 shadow-sm"><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{matches && <span className="text-xs text-slate-500">{matches.size}</span>}</div>
        {notice && <div className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow">{notice}</div>}
        {selectionBox && <div className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-400/20" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full"><div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
          {zones.map((targetZone) => { const plan = getWarehouseFloorPlan(branchId, targetZone); return plan ? <WarehouseFloorPlan key={targetZone} plan={plan} offset={offsets.get(targetZone)} infoOffset={targetZone === "dry" && zones.includes("cold") ? { x: 1660, y: 0 } : undefined} /> : null; })}
          {zones.includes("cold") && zones.includes("dry") && (
            <div className="pointer-events-none absolute z-0 text-center text-slate-500" aria-hidden="true">
              {/* Các đường này chỉ thể hiện phân khu; không còn giới hạn nơi đặt chip của Kho Khô. */}
              <div className="absolute border-[6px] border-slate-500" style={{ left: 0, top: 0, width: 1600, height: 2600 }} />
              <div className="absolute border-b-[6px] border-slate-500" style={{ left: 0, top: 1600, width: 1600 }} />
              <div className="absolute border-[5px] border-dashed border-slate-400" style={{ left: 1100, top: 0, width: 500, height: 600 }} />
              <div className="absolute flex items-center justify-center border-[5px] border-dashed border-slate-400 text-[26px] font-semibold" style={{ left: 0, top: 1600, width: 400, height: 600 }}>Kho Mát 1</div>
              <div className="absolute left-0 flex h-[1000px] w-[1600px] items-center justify-center text-[30px] font-semibold" style={{ top: 1600 }}>Khu đóng hàng</div>
            </div>
          )}
          <aside className="pointer-events-none absolute w-[1080px] rounded-2xl border-4 border-slate-300 bg-white/90 px-10 py-9 text-[34px] leading-relaxed text-slate-600 shadow-sm" style={{ left: -1140, top: 220 }} aria-label="Hướng dẫn thao tác nhanh">
            <p className="text-[54px] font-extrabold text-slate-900">Cách thao tác</p>
            <div className="space-y-5">
              <section>
                <p className="mb-1 text-[30px] font-bold uppercase tracking-wide text-blue-700">1. Chọn và di chuyển chip</p>
                <p><strong className="text-slate-900">Click chip</strong> để chọn · <strong className="text-slate-900">Shift + click</strong> để chọn thêm</p>
                <p><strong className="text-slate-900">Kéo nền trống</strong> để quét chọn nhiều chip · <strong className="text-slate-900">Kéo chip</strong> để đổi vị trí</p>
              </section>
              <section>
                <p className="mb-1 text-[30px] font-bold uppercase tracking-wide text-blue-700">2. Xem sơ đồ</p>
                <p><strong className="text-slate-900">Giữ chuột giữa và kéo</strong> để xem khu vực khác</p>
                <p><strong className="text-slate-900">Ctrl + lăn chuột</strong> để phóng to hoặc thu nhỏ</p>
              </section>
              <section>
                <p className="mb-1 text-[30px] font-bold uppercase tracking-wide text-blue-700">3. Chỉnh sửa</p>
                <p><strong className="text-slate-900">Chuột phải vào chip</strong> để đổi màu, group hoặc sắp xếp</p>
                <p><strong className="text-slate-900">Ctrl + Z</strong> để quay lại thao tác vừa làm</p>
              </section>
            </div>
            <p className="mt-6 border-t-2 border-slate-200 pt-5 text-[28px]">Mẹo: zoom từ 30% để đọc tên và kéo chip.</p>
          </aside>
          {dryZoneMarker && getWarehouseFloorPlan(branchId, "dry") && <ZoneMarkerStrip layout={dryZoneMarker} scale={scale} disabled={dryZoneMarker.locked || overview || spacePressed} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); setZoneMarkerContextMenu({ x: event.clientX, y: event.clientY }); }} />}
          {visibleProducts.map((product) => <ProductChip key={product.productId} product={product} world={worldPositions.get(product.productId) ?? { x: product.x, y: product.y }} scale={scale} selected={selectedSet.has(product.productId)} disabled={overview || spacePressed} overview={overview} showDetails={showDetails} dimmed={matches !== null && !matches.has(product.productId)} showInventory={settings.showInventory} groupDelta={dragPreview?.ids.includes(product.productId) ? { x: dragPreview.x, y: dragPreview.y } : null} onSelect={sameZoneSelection} onContextMenu={openContextMenu} />)}
        </div></TransformComponent>
      </div>}
    </TransformWrapper>
    {contextMenu && <div className="fixed z-50 min-w-52 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }}><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={!undoCount} onClick={undo}>Hoàn tác (Ctrl+Z){undoCount ? ` · ${undoCount}` : ""}</button><div className="my-1 border-t" /><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => group(crypto.randomUUID())}>Group</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={!selectedProducts.some((item) => item.groupId)} onClick={() => group(null)}>Ungroup</button><div className="my-1 border-t" /><div className="grid grid-cols-4 gap-2 px-3 py-2">{CHIP_COLORS.map((color) => <button key={color} aria-label={`Đổi màu ${color}`} className="h-7 rounded ring-1 ring-slate-300 hover:scale-110" style={{ backgroundColor: color }} onClick={() => changeColor(color)} />)}</div><div className="my-1 border-t" /><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("vertical")}>Xếp dọc, cách nhau 5px</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("horizontal")}>Xếp ngang, cách nhau 5px</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("grid")}>Sắp xếp theo lưới 5px</button><button className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" onClick={removeSelected}>Xóa</button></div>}
    {zoneMarkerContextMenu && dryZoneMarker && <div className="fixed z-50 min-w-56 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: zoneMarkerContextMenu.x, top: zoneMarkerContextMenu.y }}><button className="block w-full px-3 py-2 text-left font-medium hover:bg-amber-50" onClick={() => updateDryZoneMarker({ ...dryZoneMarker, locked: !dryZoneMarker.locked })}>{dryZoneMarker.locked ? "Mở khóa dãy phân khu" : "Cố định xuống nền"}</button></div>}
  </DndContext>;
}
