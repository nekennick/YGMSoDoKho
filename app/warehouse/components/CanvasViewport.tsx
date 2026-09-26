"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, type DragEndEvent, type DragMoveEvent, type DragStartEvent, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import { useKeyboard } from "@/app/warehouse/hooks/useKeyboard";
import { deleteProductLayoutAction, moveProductLayoutsAction, restoreProductLayoutsAction, setProductLayoutsGroupAction, updateProductColorsAction } from "@/app/warehouse/actions/product-layout";
import { drawFloorPlan, WarehouseFloorPlan } from "@/app/warehouse/components/WarehouseFloorPlan";
import { findNearestValidFloorPlanPosition, getFloorPlanCanvasRect, getWarehouseFloorPlan, isPositionInsideFloorPlan, PRODUCT_CHIP_HEIGHT, PRODUCT_CHIP_WIDTH } from "@/lib/warehouse/floor-plans";
import { useWarehouseSettings } from "@/app/warehouse/components/WarehouseSettings";
import { saveWarehouseZoneMarkerAction } from "@/app/warehouse/actions/zone-marker";
import { DRY_TOP_ZONE_MARKER_HEIGHT, DRY_TOP_ZONE_MARKER_LABELS, DRY_ZONE_MARKER_HEIGHT, DRY_ZONE_MARKER_KEY, DRY_ZONE_MARKER_LABELS, DRY_ZONE_MARKER_SPACING, DRY_ZONE_MARKER_WIDTH, getDryTopZoneMarkerKey, type DryTopZoneMarkerLabel, type ZoneMarkerLayout } from "@/lib/warehouse/zone-markers";

const NAME_VISIBLE_SCALE = 0.3;
const DETAILS_VISIBLE_SCALE = 0.7;
const CANVAS_WIDTH = 3600;
const CANVAS_HEIGHT = 7200;
const PLAN_GAP = 520;
const CHIP_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#475569", "#92400e"];
const DRY_ZONE_MARKER_DRAG_ID = "dry-zone-marker-strip";
const DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX = "dry-top-zone-marker-";
const TOP_MARKER_MIN_GAP = 170;
const PALLETS_PER_DRY_ZONE = 5;
const DRY_ZONE_PALLET_HEIGHT = DRY_ZONE_MARKER_SPACING / PALLETS_PER_DRY_ZONE;
const DRY_ZONE_PALLET_LABEL_OFFSET_X = 1150;
const DRY_ZONE_LETTER_LABEL_OFFSET_X = 1230;

type ZonedProduct = CanvasProduct & { zone: string };
type Point = { x: number; y: number };
type Camera = { scale: number; positionX: number; positionY: number };

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function dataUrlToBytes(dataUrl: string) {
  const binary = atob(dataUrl.split(",")[1] ?? "");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createPdfFromJpeg(jpeg: Uint8Array, imageWidth: number, imageHeight: number) {
  const pageWidth = 842;
  const pageHeight = Math.max(1191, Math.ceil((pageWidth - 72) * imageHeight / imageWidth + 72));
  const imageDrawWidth = pageWidth - 72;
  const imageDrawHeight = imageDrawWidth * imageHeight / imageWidth;
  const content = `q\n${imageDrawWidth} 0 0 ${imageDrawHeight} 36 ${pageHeight - 36 - imageDrawHeight} cm\n/Image1 Do\nQ\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Image1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`,
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
  ];
  const chunks: Uint8Array[] = [new TextEncoder().encode("%PDF-1.4\n%\u00ff\u00ff\u00ff\u00ff\n")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(length);
    const prefix = new TextEncoder().encode(`${index + 1} 0 obj\n${objects[index]}\n`);
    chunks.push(prefix);
    length += prefix.length;
    if (index === 4) { chunks.push(jpeg); length += jpeg.length; }
    const suffix = new TextEncoder().encode("\nendobj\n");
    chunks.push(suffix);
    length += suffix.length;
  }
  const xrefOffset = length;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(new TextEncoder().encode(xref));
  return new Blob(chunks as unknown as BlobPart[], { type: "application/pdf" });
}

function truncateCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length && context.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

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
      style={{ left: world.x, top: world.y, backgroundColor: product.color, transform: isDragging || groupDelta ? `translate(${dx}px, ${dy}px)` : undefined, zIndex: isDragging ? 20 : 1 }}>
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
  const alignedY = Math.round(layout.y / DRY_ZONE_PALLET_HEIGHT) * DRY_ZONE_PALLET_HEIGHT;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`zone-marker-strip pointer-events-none absolute ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      style={{ left: layout.x, top: alignedY, width: DRY_ZONE_MARKER_WIDTH, height: DRY_ZONE_MARKER_HEIGHT, transform: isDragging ? `translate(${dx}px, ${dy}px)` : undefined, zIndex: layout.locked ? 0 : 10 }}
      onContextMenu={onContextMenu} title={layout.locked ? "Chuột phải để mở khóa dãy phân khu" : "Kéo để canh dãy phân khu. Chuột phải để cố định xuống nền"}>
      {DRY_ZONE_MARKER_LABELS.map((label, index) => (
        <div key={label} className="pointer-events-none absolute left-0 h-[600px] w-full touch-none" style={{ top: index * DRY_ZONE_MARKER_SPACING }}>
          <div className="absolute left-0 top-0 h-[2px] w-[1120px] bg-amber-500 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" />
          {Array.from({ length: PALLETS_PER_DRY_ZONE }, (_, palletIndex) => <span key={palletIndex} className="absolute flex h-[52px] w-[72px] items-center justify-center rounded-md border-2 border-sky-600 bg-sky-200/95 text-[34px] font-extrabold leading-none text-sky-950 shadow-sm" style={{ left: DRY_ZONE_PALLET_LABEL_OFFSET_X, top: palletIndex * DRY_ZONE_PALLET_HEIGHT + 34 }}>{PALLETS_PER_DRY_ZONE - palletIndex}</span>)}
          <span className="pointer-events-auto absolute top-[-38px] flex h-[76px] w-[140px] items-center justify-center rounded-md border-2 border-amber-600 bg-amber-300/95 text-[56px] font-black leading-none text-amber-950 shadow-sm" style={{ left: DRY_ZONE_LETTER_LABEL_OFFSET_X }}>{label}</span>
        </div>
      ))}
    </div>
  );
});

const TopZoneMarker = memo(function TopZoneMarker({ label, layout, scale, disabled, onContextMenu }: { label: DryTopZoneMarkerLabel; layout: ZoneMarkerLayout; scale: number; disabled: boolean; onContextMenu: (event: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX}${label}`, disabled });
  const dx = isDragging ? (transform?.x ?? 0) / scale : 0;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`zone-marker-strip pointer-events-none absolute w-[140px] touch-none ${disabled ? "cursor-default" : "cursor-ew-resize active:cursor-grabbing"}`}
      style={{ left: layout.x, top: layout.y, height: 76, transform: isDragging ? `translate(${dx}px, 0)` : undefined, zIndex: layout.locked ? 0 : 10 }}
      onContextMenu={onContextMenu}>
      <div className="pointer-events-none absolute left-[69px] top-[118px] h-[6400px] w-[2px] bg-amber-600 shadow-[0_0_0_1px_rgba(120,53,15,0.45)]" />
      <span className="pointer-events-auto absolute left-0 top-0 flex h-[76px] w-[140px] items-center justify-center rounded-md border-2 border-amber-700 bg-amber-300/95 text-[56px] font-black leading-none text-amber-950 shadow-md">{label}</span>
    </div>
  );
});

export function CanvasViewport({ products, branchId, zone, dryZoneMarker, onDryZoneMarkerChange, dryTopZoneMarkers, onDryTopZoneMarkersChange, onProductsChange, onProductsDeleted, onProductsRestored, onRequestAdd, onRegisterCenterPosition, focusProductId }: { products: CanvasProduct[]; branchId: number; zone: string; dryZoneMarker: ZoneMarkerLayout | null; onDryZoneMarkerChange: (layout: ZoneMarkerLayout) => void; dryTopZoneMarkers: Record<DryTopZoneMarkerLabel, ZoneMarkerLayout> | null; onDryTopZoneMarkersChange: (layouts: Record<DryTopZoneMarkerLabel, ZoneMarkerLayout>) => void; onProductsChange: (products: CanvasProduct[]) => void; onProductsDeleted?: (products: CanvasProduct[]) => void; onProductsRestored?: (products: CanvasProduct[]) => void; onRequestAdd: () => void; onRegisterCenterPosition?: (getter: (() => Point) | null) => void; focusProductId?: number | null }) {
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
  const [scale, setScale] = useState(0.2);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; productId: number } | null>(null);
  const [zoneMarkerContextMenu, setZoneMarkerContextMenu] = useState<{ x: number; y: number; marker: "side" | DryTopZoneMarkerLabel } | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ ids: number[]; x: number; y: number } | null>(null);
  const [viewportVersion, setViewportVersion] = useState(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const overviewPlanCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const overviewCamera = useRef<Camera>({ scale: 0.2, positionX: 0, positionY: 0 });
  const overviewFrame = useRef<number | null>(null);
  const viewportFrame = useRef<number | null>(null);
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
  const markerDragActive = useRef<"side" | DryTopZoneMarkerLabel | null>(null);
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
  const drawOverview = useCallback((camera: Camera) => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(rect.width * pixelRatio);
    const height = Math.round(rect.height * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#e2e8f0";
    context.fillRect(0, 0, width, height);
    context.setTransform(pixelRatio * camera.scale, 0, 0, pixelRatio * camera.scale, pixelRatio * camera.positionX, pixelRatio * camera.positionY);

    for (const targetZone of zones) {
      const plan = getWarehouseFloorPlan(branchId, targetZone);
      if (!plan) continue;
      const cacheKey = `${plan.id}:${settings.showFloorGrid}`;
      let planCanvas = overviewPlanCanvases.current.get(cacheKey);
      if (!planCanvas) {
        planCanvas = document.createElement("canvas");
        drawFloorPlan(planCanvas, plan, settings.showFloorGrid, 900_000);
        overviewPlanCanvases.current.set(cacheKey, planCanvas);
      }
      const offset = offsets.get(targetZone) ?? { x: 0, y: 0 };
      const planRect = getFloorPlanCanvasRect(plan);
      context.drawImage(planCanvas, plan.canvasX + offset.x, plan.canvasY + offset.y, planRect.width, planRect.height);
    }

    if (dryTopZoneMarkers) {
      context.lineWidth = 3;
      context.strokeStyle = "#b45309";
      for (const label of DRY_TOP_ZONE_MARKER_LABELS) {
        const marker = dryTopZoneMarkers[label];
        context.beginPath();
        context.moveTo(marker.x + 70, marker.y + 118);
        context.lineTo(marker.x + 70, marker.y + 6518);
        context.stroke();
      }
    }
    if (dryZoneMarker) {
      context.lineWidth = 3;
      context.strokeStyle = "#b45309";
      for (const [index] of DRY_ZONE_MARKER_LABELS.entries()) {
        const y = Math.round(dryZoneMarker.y / DRY_ZONE_PALLET_HEIGHT) * DRY_ZONE_PALLET_HEIGHT + index * DRY_ZONE_MARKER_SPACING;
        context.beginPath();
        context.moveTo(dryZoneMarker.x, y);
        context.lineTo(dryZoneMarker.x + 1120, y);
        context.stroke();
      }
    }
    for (const product of allProducts) {
      const position = worldPositions.get(product.productId) ?? worldPosition(product);
      context.fillStyle = product.color;
      context.fillRect(position.x, position.y, PRODUCT_CHIP_WIDTH, PRODUCT_CHIP_HEIGHT);
    }
  }, [allProducts, branchId, dryTopZoneMarkers, dryZoneMarker, offsets, settings.showFloorGrid, worldPosition, worldPositions, zones]);
  const scheduleOverviewDraw = useCallback((camera: Camera) => {
    overviewCamera.current = camera;
    if (overviewFrame.current !== null) return;
    overviewFrame.current = requestAnimationFrame(() => {
      overviewFrame.current = null;
      drawOverview(overviewCamera.current);
    });
  }, [drawOverview]);
  const scheduleViewportRefresh = useCallback(() => {
    if (viewportFrame.current !== null) return;
    viewportFrame.current = requestAnimationFrame(() => {
      viewportFrame.current = null;
      setViewportVersion((current) => current + 1);
    });
  }, []);
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
  const clampMarkerPosition = useCallback((position: Point, snapToPalletGrid = false): Point => {
    const snap = (value: number) => Math.round(value / 50) * 50;
    return { x: snap(position.x), y: snapToPalletGrid ? Math.round(position.y / DRY_ZONE_PALLET_HEIGHT) * DRY_ZONE_PALLET_HEIGHT : snap(position.y) };
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
  const updateDryTopZoneMarker = useCallback((label: DryTopZoneMarkerLabel, next: ZoneMarkerLayout) => {
    if (!dryTopZoneMarkers) return;
    const before = dryTopZoneMarkers;
    onDryTopZoneMarkersChange({ ...dryTopZoneMarkers, [label]: next });
    setZoneMarkerContextMenu(null);
    void trackMutation(saveWarehouseZoneMarkerAction({ branchId, zone: "dry", key: getDryTopZoneMarkerKey(label), ...next })).then((result) => {
      if (!result.ok) {
        onDryTopZoneMarkersChange(before);
        setNotice(result.message);
      }
    });
  }, [branchId, dryTopZoneMarkers, onDryTopZoneMarkersChange, trackMutation]);
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
  useEffect(() => {
    overviewPlanCanvases.current.clear();
  }, [branchId, settings.showFloorGrid]);
  useEffect(() => {
    if (!overview) return;
    const transform = transformRef.current?.instance.transformState;
    scheduleOverviewDraw(transform ? { scale: transform.scale, positionX: transform.positionX, positionY: transform.positionY } : overviewCamera.current);
  }, [overview, scheduleOverviewDraw]);
  useEffect(() => () => {
    if (overviewFrame.current !== null) cancelAnimationFrame(overviewFrame.current);
    if (viewportFrame.current !== null) cancelAnimationFrame(viewportFrame.current);
  }, []);
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
  const visibleProducts = (() => {
    if (overview) return [];
    const viewport = canvasRef.current?.getBoundingClientRect();
    const transform = transformRef.current?.instance.transformState;
    if (!viewport || !transform) return allProducts;
    const padding = 500;
    const left = (-transform.positionX) / transform.scale - padding;
    const top = (-transform.positionY) / transform.scale - padding;
    const right = (viewport.width - transform.positionX) / transform.scale + padding;
    const bottom = (viewport.height - transform.positionY) / transform.scale + padding;
    return allProducts.filter((product) => {
      const position = worldPositions.get(product.productId) ?? worldPosition(product);
      return position.x < right && position.x + PRODUCT_CHIP_WIDTH > left && position.y < bottom && position.y + PRODUCT_CHIP_HEIGHT > top;
    });
  })();
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const exportWarehouseImage = useCallback((format: "png" | "pdf") => {
    if (window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches) {
      setNotice("Xuất ảnh độ phân giải cao cần thực hiện trên máy tính để tránh trình duyệt điện thoại bị quá tải.");
      return;
    }
    setExporting(format);
    window.setTimeout(() => {
      try {
        const padding = 120;
        const floorRects = zones.flatMap((targetZone) => {
          const plan = getWarehouseFloorPlan(branchId, targetZone);
          if (!plan) return [];
          const rect = getFloorPlanCanvasRect(plan);
          const offset = offsets.get(targetZone) ?? { x: 0, y: 0 };
          return [{ x: rect.x + offset.x, y: rect.y + offset.y, width: rect.width, height: rect.height }];
        });
        if (!floorRects.length) return;
        const left = Math.min(...floorRects.map((rect) => rect.x), ...(dryTopZoneMarkers ? DRY_TOP_ZONE_MARKER_LABELS.map((label) => dryTopZoneMarkers[label].x) : [Infinity])) - padding;
        const top = Math.min(...floorRects.map((rect) => rect.y), ...(dryTopZoneMarkers ? DRY_TOP_ZONE_MARKER_LABELS.map((label) => dryTopZoneMarkers[label].y) : [Infinity])) - padding;
        const right = Math.max(...floorRects.map((rect) => rect.x + rect.width), ...(dryTopZoneMarkers ? DRY_TOP_ZONE_MARKER_LABELS.map((label) => dryTopZoneMarkers[label].x + 140) : [-Infinity]), ...(dryZoneMarker ? [dryZoneMarker.x + DRY_ZONE_LETTER_LABEL_OFFSET_X + 140] : [-Infinity])) + padding;
        const bottom = Math.max(...floorRects.map((rect) => rect.y + rect.height), ...(dryTopZoneMarkers ? DRY_TOP_ZONE_MARKER_LABELS.map((label) => dryTopZoneMarkers[label].y + DRY_TOP_ZONE_MARKER_HEIGHT) : [-Infinity]), ...(dryZoneMarker ? [dryZoneMarker.y + DRY_ZONE_MARKER_SPACING * (DRY_ZONE_MARKER_LABELS.length - 1) + DRY_ZONE_MARKER_HEIGHT] : [-Infinity])) + padding;
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(right - left);
        canvas.height = Math.ceil(bottom - top);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.fillStyle = "#e2e8f0";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.translate(-left, -top);
        for (const targetZone of zones) {
          const plan = getWarehouseFloorPlan(branchId, targetZone);
          if (!plan) continue;
          const planCanvas = document.createElement("canvas");
          drawFloorPlan(planCanvas, plan, settings.showFloorGrid, Number.POSITIVE_INFINITY);
          const offset = offsets.get(targetZone) ?? { x: 0, y: 0 };
          context.drawImage(planCanvas, plan.canvasX + offset.x, plan.canvasY + offset.y);
          context.fillStyle = "#1e3a8a";
          context.font = "800 52px system-ui, sans-serif";
          context.textAlign = "left";
          context.fillText(plan.displayTitle ?? plan.name.toUpperCase(), plan.canvasX + offset.x, plan.canvasY + offset.y - 28);
          context.fillStyle = "#475569";
          context.font = "600 28px system-ui, sans-serif";
          context.fillText(plan.displaySubtitle ?? plan.name, plan.canvasX + offset.x, plan.canvasY + offset.y - 68);
        }
        if (dryTopZoneMarkers) for (const label of DRY_TOP_ZONE_MARKER_LABELS) {
          const marker = dryTopZoneMarkers[label];
          context.fillStyle = "#b45309";
          context.fillRect(marker.x + 69, marker.y + 118, 2, 6400);
          context.fillStyle = "#fcd34d";
          context.strokeStyle = "#b45309";
          context.lineWidth = 3;
          context.fillRect(marker.x, marker.y, 140, 76);
          context.strokeRect(marker.x, marker.y, 140, 76);
          context.fillStyle = "#78350f";
          context.font = "900 56px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, marker.x + 70, marker.y + 39);
        }
        if (dryZoneMarker) for (const [index, label] of DRY_ZONE_MARKER_LABELS.entries()) {
          const y = Math.round(dryZoneMarker.y / DRY_ZONE_PALLET_HEIGHT) * DRY_ZONE_PALLET_HEIGHT + index * DRY_ZONE_MARKER_SPACING;
          context.fillStyle = "#b45309";
          context.fillRect(dryZoneMarker.x, y, 1120, 2);
          for (let palletIndex = 0; palletIndex < PALLETS_PER_DRY_ZONE; palletIndex += 1) {
            const palletY = y + palletIndex * DRY_ZONE_PALLET_HEIGHT + 34;
            context.fillStyle = "#bae6fd";
            context.strokeStyle = "#0284c7";
            context.lineWidth = 3;
            context.fillRect(dryZoneMarker.x + DRY_ZONE_PALLET_LABEL_OFFSET_X, palletY, 72, 52);
            context.strokeRect(dryZoneMarker.x + DRY_ZONE_PALLET_LABEL_OFFSET_X, palletY, 72, 52);
            context.fillStyle = "#0c4a6e";
            context.font = "800 34px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(String(PALLETS_PER_DRY_ZONE - palletIndex), dryZoneMarker.x + DRY_ZONE_PALLET_LABEL_OFFSET_X + 36, palletY + 26);
          }
          context.fillStyle = "#fcd34d";
          context.strokeStyle = "#b45309";
          context.lineWidth = 3;
          context.fillRect(dryZoneMarker.x + DRY_ZONE_LETTER_LABEL_OFFSET_X, y - 38, 140, 76);
          context.strokeRect(dryZoneMarker.x + DRY_ZONE_LETTER_LABEL_OFFSET_X, y - 38, 140, 76);
          context.fillStyle = "#78350f";
          context.font = "900 56px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, dryZoneMarker.x + DRY_ZONE_LETTER_LABEL_OFFSET_X + 70, y);
        }
        for (const product of allProducts) {
          const position = worldPosition(product);
          context.fillStyle = product.color;
          context.beginPath();
          context.roundRect(position.x, position.y, PRODUCT_CHIP_WIDTH, PRODUCT_CHIP_HEIGHT, 7);
          context.fill();
          context.strokeStyle = "rgba(255,255,255,0.8)";
          context.lineWidth = 2;
          context.stroke();
          context.fillStyle = "#ffffff";
          context.textAlign = "left";
          context.textBaseline = "middle";
          context.font = "600 22px system-ui, sans-serif";
          context.fillText(truncateCanvasText(context, product.name, 218), position.x + 10, position.y + 20);
        }
        context.restore();
        const filename = `so-do-tong-kho-yagami-${new Date().toISOString().slice(0, 10)}`;
        if (format === "png") canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${filename}.png`); }, "image/png");
        else downloadBlob(createPdfFromJpeg(dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.94)), canvas.width, canvas.height), `${filename}.pdf`);
      } finally {
        setExporting(null);
      }
    }, 20);
  }, [allProducts, branchId, dryTopZoneMarkers, dryZoneMarker, offsets, settings.showFloorGrid, worldPosition, zones]);

  return <DndContext sensors={sensors} autoScroll={false} onDragStart={(event: DragStartEvent) => {
    const topLabel = typeof event.active.id === "string" && event.active.id.startsWith(DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX)
      ? event.active.id.slice(DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX.length) as DryTopZoneMarkerLabel : null;
    if (event.active.id === DRY_ZONE_MARKER_DRAG_ID || (topLabel && DRY_TOP_ZONE_MARKER_LABELS.includes(topLabel))) {
      markerDragActive.current = event.active.id === DRY_ZONE_MARKER_DRAG_ID ? "side" : topLabel;
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
    if (markerDragActive.current || event.active.id === DRY_ZONE_MARKER_DRAG_ID || (typeof event.active.id === "string" && event.active.id.startsWith(DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX))) return;
    const currentScale = transformRef.current?.instance.transformState.scale ?? 1;
    if (draggingIdsRef.current.length) setDragPreview({ ids: draggingIdsRef.current, x: event.delta.x / currentScale, y: event.delta.y / currentScale });
  }} onDragCancel={() => { markerDragActive.current = null; draggingIdsRef.current = []; setDragPreview(null); }} onDragEnd={(event: DragEndEvent) => {
    const topLabel = typeof event.active.id === "string" && event.active.id.startsWith(DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX)
      ? event.active.id.slice(DRY_TOP_ZONE_MARKER_DRAG_ID_PREFIX.length) as DryTopZoneMarkerLabel : null;
    const activeMarker = markerDragActive.current ?? (event.active.id === DRY_ZONE_MARKER_DRAG_ID ? "side" : topLabel && DRY_TOP_ZONE_MARKER_LABELS.includes(topLabel) ? topLabel : null);
    if (activeMarker) {
      markerDragActive.current = null;
      const marker = activeMarker === "side" ? dryZoneMarker : dryTopZoneMarkers?.[activeMarker];
      if (!marker || marker.locked || overview) return;
      const currentScale = transformRef.current?.instance.transformState.scale ?? 1;
      const rawPosition = clampMarkerPosition({ x: marker.x + event.delta.x / currentScale, y: marker.y + event.delta.y / currentScale }, activeMarker === "side");
      const nextPosition = activeMarker === "side" ? rawPosition : {
        x: Math.max(
          DRY_TOP_ZONE_MARKER_LABELS.indexOf(activeMarker) > 0 ? (dryTopZoneMarkers?.[DRY_TOP_ZONE_MARKER_LABELS[DRY_TOP_ZONE_MARKER_LABELS.indexOf(activeMarker) - 1]]?.x ?? -Infinity) + TOP_MARKER_MIN_GAP : -Infinity,
          Math.min(
            DRY_TOP_ZONE_MARKER_LABELS.indexOf(activeMarker) < DRY_TOP_ZONE_MARKER_LABELS.length - 1 ? (dryTopZoneMarkers?.[DRY_TOP_ZONE_MARKER_LABELS[DRY_TOP_ZONE_MARKER_LABELS.indexOf(activeMarker) + 1]]?.x ?? Infinity) - TOP_MARKER_MIN_GAP : Infinity,
            rawPosition.x,
          ),
        ),
        y: marker.y,
      };
      if (nextPosition.x !== marker.x || nextPosition.y !== marker.y) {
        if (activeMarker === "side") updateDryZoneMarker({ ...marker, ...nextPosition });
        else updateDryTopZoneMarker(activeMarker, { ...marker, ...nextPosition });
      }
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
    <TransformWrapper ref={transformRef} minScale={0.2} maxScale={4} limitToBounds={false} centerZoomedOut={false} wheel={{ activationKeys: ["Control"], step: 0.02 }} panning={{ disabled: !spacePressed, excluded: ["product-chip", "canvas-control"] }} doubleClick={{ disabled: true }} onTransformed={(_, state) => {
      const camera = { scale: state.scale, positionX: state.positionX, positionY: state.positionY };
      if (state.scale < NAME_VISIBLE_SCALE) scheduleOverviewDraw(camera);
      scheduleViewportRefresh();
      setScale((current) => {
        const currentBand = current < NAME_VISIBLE_SCALE ? 0 : current < DETAILS_VISIBLE_SCALE ? 1 : 2;
        const nextBand = state.scale < NAME_VISIBLE_SCALE ? 0 : state.scale < DETAILS_VISIBLE_SCALE ? 1 : 2;
        return currentBand !== nextBand || Math.abs(current - state.scale) >= 0.12 ? state.scale : current;
      });
    }}>
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
      }} onPointerUp={() => { middlePanStart.current = null; selectionJustEnded.current = selectionDragged.current; if (selectionBox && selectionDragged.current && canvasRef.current) { const canvas = canvasRef.current.getBoundingClientRect(); const ids = [...canvasRef.current.querySelectorAll<HTMLElement>(".product-chip")].filter((node) => { const rect = node.getBoundingClientRect(); const left = rect.left - canvas.left; const top = rect.top - canvas.top; return left < selectionBox.x + selectionBox.width && left + rect.width > selectionBox.x && top < selectionBox.y + selectionBox.height && top + rect.height > selectionBox.y; }).map((node) => Number(node.dataset.productId)); const first = allProducts.find((item) => item.productId === ids[0]); setSelectedIds(first ? ids.filter((id) => allProducts.find((item) => item.productId === id)?.zone === first.zone) : []); } selectionStart.current = null; setSelectionBox(null); }} onPointerCancel={() => { middlePanStart.current = null; markerDragActive.current = null; selectionStart.current = null; selectionDragged.current = false; selectionJustEnded.current = false; setSelectionBox(null); }} onClick={(event) => { const target = event.target as HTMLElement; if (!target.closest(".product-chip") && !target.closest(".zone-marker-strip") && !target.closest(".canvas-control")) { setContextMenu(null); setZoneMarkerContextMenu(null); if (!selectionJustEnded.current) setSelectedIds([]); } selectionJustEnded.current = false; }} onContextMenu={(event) => { const target = event.target as HTMLElement; if (!target.closest(".product-chip") && !target.closest(".zone-marker-strip")) { event.preventDefault(); onRequestAdd(); } }}>
        <div className="canvas-control absolute left-3 top-3 z-30 flex items-center gap-2 rounded-md border bg-white/95 p-2 text-xs shadow-sm"><span>{Math.round(scale * 100)}%</span><button className="underline" onClick={() => fitAll()}>Xem cả hai kho</button><button className="underline" onClick={() => resetTransform()}>Đặt lại</button><button className="underline" disabled={exporting !== null} onClick={() => exportWarehouseImage("png")}>{exporting === "png" ? "Đang xuất…" : "Ảnh PNG"}</button><button className="underline" disabled={exporting !== null} onClick={() => exportWarehouseImage("pdf")}>{exporting === "pdf" ? "Đang xuất…" : "PDF"}</button>{overview && <span className="text-slate-500">Zoom gần để kéo thả</span>}</div>
        <div className="canvas-control absolute right-3 top-3 z-30 flex w-64 items-center gap-2 rounded-md border bg-white/95 p-2 shadow-sm"><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{matches && <span className="text-xs text-slate-500">{matches.size}</span>}</div>
        {notice && <div className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow">{notice}</div>}
        {selectionBox && <div className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-400/20" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
        <canvas ref={overviewCanvasRef} aria-hidden className={`pointer-events-none absolute inset-0 z-10 h-full w-full ${overview ? "" : "hidden"}`} />
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">{overview ? <div style={{ width: 1, height: 1 }} /> : <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
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
          {dryTopZoneMarkers && getWarehouseFloorPlan(branchId, "dry") && DRY_TOP_ZONE_MARKER_LABELS.map((label) => <TopZoneMarker key={label} label={label} layout={dryTopZoneMarkers[label]} scale={scale} disabled={dryTopZoneMarkers[label].locked || overview || spacePressed} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); setZoneMarkerContextMenu({ x: event.clientX, y: event.clientY, marker: label }); }} />)}
          {dryZoneMarker && getWarehouseFloorPlan(branchId, "dry") && <ZoneMarkerStrip layout={dryZoneMarker} scale={scale} disabled={dryZoneMarker.locked || overview || spacePressed} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); setZoneMarkerContextMenu({ x: event.clientX, y: event.clientY, marker: "side" }); }} />}
          {visibleProducts.map((product) => <ProductChip key={product.productId} product={product} world={worldPositions.get(product.productId) ?? { x: product.x, y: product.y }} scale={scale} selected={selectedSet.has(product.productId)} disabled={spacePressed} overview={false} showDetails={showDetails} dimmed={matches !== null && !matches.has(product.productId)} showInventory={settings.showInventory} groupDelta={dragPreview?.ids.includes(product.productId) ? { x: dragPreview.x, y: dragPreview.y } : null} onSelect={sameZoneSelection} onContextMenu={openContextMenu} />)}
        </div>}</TransformComponent>
      </div>}
    </TransformWrapper>
    {contextMenu && <div className="fixed z-50 min-w-52 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }}><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={!undoCount} onClick={undo}>Hoàn tác (Ctrl+Z){undoCount ? ` · ${undoCount}` : ""}</button><div className="my-1 border-t" /><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => group(crypto.randomUUID())}>Group</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={!selectedProducts.some((item) => item.groupId)} onClick={() => group(null)}>Ungroup</button><div className="my-1 border-t" /><div className="grid grid-cols-4 gap-2 px-3 py-2">{CHIP_COLORS.map((color) => <button key={color} aria-label={`Đổi màu ${color}`} className="h-7 rounded ring-1 ring-slate-300 hover:scale-110" style={{ backgroundColor: color }} onClick={() => changeColor(color)} />)}</div><div className="my-1 border-t" /><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("vertical")}>Xếp dọc, cách nhau 5px</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("horizontal")}>Xếp ngang, cách nhau 5px</button><button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 disabled:text-slate-400" disabled={selectedProducts.length < 2} onClick={() => arrange("grid")}>Sắp xếp theo lưới 5px</button><button className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" onClick={removeSelected}>Xóa</button></div>}
    {zoneMarkerContextMenu?.marker === "side" && dryZoneMarker && <div className="fixed z-50 min-w-56 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: zoneMarkerContextMenu.x, top: zoneMarkerContextMenu.y }}><button className="block w-full px-3 py-2 text-left font-medium hover:bg-amber-50" onClick={() => updateDryZoneMarker({ ...dryZoneMarker, locked: !dryZoneMarker.locked })}>{dryZoneMarker.locked ? "Mở khóa dãy phân khu" : "Cố định xuống nền"}</button></div>}
    {zoneMarkerContextMenu && zoneMarkerContextMenu.marker !== "side" && dryTopZoneMarkers && (() => { const label = zoneMarkerContextMenu.marker as DryTopZoneMarkerLabel; const marker = dryTopZoneMarkers[label]; return <div className="fixed z-50 min-w-56 rounded-md border bg-white py-1 text-sm shadow-lg" style={{ left: zoneMarkerContextMenu.x, top: zoneMarkerContextMenu.y }}><button className="block w-full px-3 py-2 text-left font-medium hover:bg-amber-50" onClick={() => updateDryTopZoneMarker(label, { ...marker, locked: !marker.locked })}>{marker.locked ? "Mở khóa phân khu này" : "Cố định phân khu này"}</button></div>; })()}
  </DndContext>;
}
