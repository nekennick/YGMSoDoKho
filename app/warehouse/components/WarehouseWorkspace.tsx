"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WarehouseDataResult } from "@/lib/warehouse/initial-data";
import { CanvasViewport } from "@/app/warehouse/components/CanvasViewport";
import { AddProductDialog } from "@/app/warehouse/components/AddProductDialog";
import { useWarehouseSettings } from "@/app/warehouse/components/WarehouseSettings";
import type { CanvasProduct } from "@/lib/product-catalog/merge";
import type { DryTopZoneMarkerLabel, ZoneMarkerLayout } from "@/lib/warehouse/zone-markers";

export function WarehouseWorkspace({ result, branchId, zone }: { result: WarehouseDataResult; branchId: number; zone: string }) {
  const { settings } = useWarehouseSettings();
  const [canvasProducts, setCanvasProducts] = useState(result.ok ? result.data.canvasProducts : []);
  const [availableProducts, setAvailableProducts] = useState(result.ok ? result.data.availableProducts : []);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [focusProductId, setFocusProductId] = useState<number | null>(null);
  const [dryZoneMarker, setDryZoneMarker] = useState<ZoneMarkerLayout | null>(result.ok ? result.data.dryZoneMarker : null);
  const [dryTopZoneMarkers, setDryTopZoneMarkers] = useState<Record<DryTopZoneMarkerLabel, ZoneMarkerLayout> | null>(result.ok ? result.data.dryTopZoneMarkers : null);
  const centerPositionRef = useRef<(() => { x: number; y: number }) | null>(null);
  const registerCenterPosition = useCallback((getter: (() => { x: number; y: number }) | null) => {
    centerPositionRef.current = getter;
  }, []);
  useEffect(() => {
    if (result.ok) {
      setCanvasProducts(result.data.canvasProducts);
      setAvailableProducts(result.data.availableProducts);
      setDryZoneMarker(result.data.dryZoneMarker);
      setDryTopZoneMarkers(result.data.dryTopZoneMarkers);
    } else {
      setCanvasProducts([]);
      setAvailableProducts([]);
      setDryZoneMarker(null);
      setDryTopZoneMarkers(null);
    }
  }, [branchId, zone, result]);
  const restoreDeletedProducts = useCallback((deletedProducts: CanvasProduct[]) => {
    setAvailableProducts((current) => {
      const existingIds = new Set(current.map((product) => product.productId));
      const restored = deletedProducts
        .filter((product) => !existingIds.has(product.productId))
        .map(({ productId, name, quantity }) => ({ productId, name, quantity }));
      return [...current, ...restored];
    });
  }, []);
  const removeRestoredProductsFromAvailable = useCallback((restoredProducts: CanvasProduct[]) => {
    const restoredIds = new Set(restoredProducts.map((product) => product.productId));
    setAvailableProducts((current) => current.filter((product) => !restoredIds.has(product.productId)));
  }, []);
  if (!result.ok) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-center">
          <p className="text-2xl">⚠️</p>
          <h1 className="mt-2 font-semibold text-amber-950">Chưa thể tải dữ liệu</h1>
          <p className="mt-1 text-sm text-amber-800">{result.message}</p>
        </div>
      </main>
    );
  }

  const addProducts = (products: Array<typeof availableProducts[number] & { x: number; y: number; color: string }>) => {
    const addedIds = new Set(products.map((product) => product.productId));
    setCanvasProducts((current) => [
      ...current,
      ...products.map((product) => ({
        productId: product.productId,
        name: product.name,
        quantity: product.quantity,
        x: product.x,
        y: product.y,
        color: product.color,
        zone,
      })),
    ]);
    setAvailableProducts((current) => current.filter((candidate) => !addedIds.has(candidate.productId)));
    setFocusProductId(settings.focusNewProducts ? products[0]?.productId ?? null : null);
  };
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
      <div className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-2 border-b bg-white px-4 py-2 text-sm">
        <button type="button" aria-label="Thêm sản phẩm" title="Thêm sản phẩm" className="grid size-8 place-items-center rounded-md bg-blue-600 text-lg font-semibold leading-none text-white shadow-sm hover:bg-blue-700 md:hidden" onClick={() => setAddDialogOpen(true)}>+</button>
        <AddProductDialog products={availableProducts} branchId={branchId} zone={zone} getPosition={() => centerPositionRef.current?.() ?? { x: 400, y: 250 }} open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdded={addProducts} />
        <span className="font-medium text-slate-900">{canvasProducts.length} SP</span>
      </div>
      <section className="relative min-h-0 flex-1 overflow-hidden">
        <CanvasViewport products={canvasProducts} branchId={branchId} zone={zone} dryZoneMarker={dryZoneMarker} onDryZoneMarkerChange={setDryZoneMarker} dryTopZoneMarkers={dryTopZoneMarkers} onDryTopZoneMarkersChange={setDryTopZoneMarkers} onProductsChange={setCanvasProducts} onProductsDeleted={restoreDeletedProducts} onProductsRestored={removeRestoredProductsFromAvailable} onRequestAdd={() => setAddDialogOpen(true)} onRegisterCenterPosition={registerCenterPosition} focusProductId={focusProductId} />
      </section>
    </main>
  );
}
