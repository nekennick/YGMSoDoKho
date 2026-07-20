"use client";

import type { WarehouseDataResult } from "@/lib/warehouse/initial-data";

export function WarehouseWorkspace({ result }: { result: WarehouseDataResult }) {
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

  const { canvasProducts, availableProducts } = result.data;
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-sm">
        <span className="font-medium text-slate-900">{canvasProducts.length} sản phẩm trên canvas</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{availableProducts.length} sản phẩm có thể thêm</span>
      </div>
      <section className="relative flex-1 overflow-hidden bg-slate-50">
        {canvasProducts.map((product) => (
          <div
            key={product.productId}
            className="absolute min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-white shadow-sm"
            style={{ left: product.x, top: product.y, backgroundColor: product.color }}
          >
            <span aria-hidden="true">📦 </span>{product.name}
          </div>
        ))}
        {canvasProducts.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Thêm sản phẩm để bắt đầu bố trí.</div>
        )}
      </section>
    </main>
  );
}
