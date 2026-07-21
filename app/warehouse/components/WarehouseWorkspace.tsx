"use client";

import { useState } from "react";
import type { WarehouseDataResult } from "@/lib/warehouse/initial-data";
import { CanvasViewport } from "@/app/warehouse/components/CanvasViewport";
import { AddProductDialog } from "@/app/warehouse/components/AddProductDialog";

export function WarehouseWorkspace({ result }: { result: WarehouseDataResult }) {
  const [canvasProducts, setCanvasProducts] = useState(result.ok ? result.data.canvasProducts : []);
  const [availableProducts, setAvailableProducts] = useState(result.ok ? result.data.availableProducts : []);
  if (!result.ok) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-8">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-center">
          <p className="text-2xl">⚠️</p>
          <h1 className="mt-2 font-semibold text-amber-950">Chưa thể tải dữ liệu</h1>
          <p className="mt-1 text-sm text-amber-800">{result.message}</p>
        </div>
      </main>
    );
  }

  const addProduct = (product: typeof availableProducts[number] & { x: number; y: number; color: string }) => {
    setCanvasProducts((current) => [...current, { productId: product.productId, name: product.name, x: product.x, y: product.y, color: product.color }]);
    setAvailableProducts((current) => current.filter((candidate) => candidate.productId !== product.productId));
  };
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-sm">
        <AddProductDialog products={availableProducts} onAdded={addProduct} />
        <span className="font-medium text-slate-900">{canvasProducts.length} sản phẩm trên canvas</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{availableProducts.length} sản phẩm có thể thêm</span>
      </div>
      <section className="relative flex-1">
        <CanvasViewport products={canvasProducts} onProductsChange={setCanvasProducts} />
      </section>
    </main>
  );
}
