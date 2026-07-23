"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WarehouseDataResult } from "@/lib/warehouse/initial-data";
import { CanvasViewport } from "@/app/warehouse/components/CanvasViewport";
import { AddProductDialog } from "@/app/warehouse/components/AddProductDialog";

export function WarehouseWorkspace({ result, branchId, zone }: { result: WarehouseDataResult; branchId: number; zone: string }) {
  const [canvasProducts, setCanvasProducts] = useState(result.ok ? result.data.canvasProducts : []);
  const [availableProducts, setAvailableProducts] = useState(result.ok ? result.data.availableProducts : []);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [focusProductId, setFocusProductId] = useState<number | null>(null);
  const centerPositionRef = useRef<(() => { x: number; y: number }) | null>(null);
  const registerCenterPosition = useCallback((getter: (() => { x: number; y: number }) | null) => {
    centerPositionRef.current = getter;
  }, []);
  useEffect(() => {
    if (result.ok) {
      setCanvasProducts(result.data.canvasProducts);
      setAvailableProducts(result.data.availableProducts);
    } else {
      setCanvasProducts([]);
      setAvailableProducts([]);
    }
  }, [branchId, zone, result]);
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

  const addProduct = (product: typeof availableProducts[number] & { x: number; y: number; color: string }) => {
    setCanvasProducts((current) => [...current, { productId: product.productId, name: product.name, quantity: product.quantity, x: product.x, y: product.y, color: product.color }]);
    setAvailableProducts((current) => current.filter((candidate) => candidate.productId !== product.productId));
    setFocusProductId(product.productId);
  };
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
      <div className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-2 border-b bg-white px-4 py-2 text-sm">
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 md:hidden" onClick={() => setAddDialogOpen(true)}>+ Thêm sản phẩm</button>
        <AddProductDialog products={availableProducts} branchId={branchId} zone={zone} getPosition={() => centerPositionRef.current?.() ?? { x: 400, y: 250 }} open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdded={addProduct} />
        <span className="font-medium text-slate-900">{canvasProducts.length} sản phẩm trên sơ đồ kho</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{availableProducts.length} sản phẩm có thể thêm</span>
      </div>
      <section className="relative min-h-0 flex-1 overflow-hidden">
        <CanvasViewport products={canvasProducts} branchId={branchId} zone={zone} onProductsChange={setCanvasProducts} onRequestAdd={() => setAddDialogOpen(true)} onRegisterCenterPosition={registerCenterPosition} focusProductId={focusProductId} />
      </section>
    </main>
  );
}
