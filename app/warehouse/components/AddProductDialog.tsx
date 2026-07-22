"use client";

import { useMemo, useState, useTransition } from "react";
import type { ProductOption } from "@/lib/product-catalog/merge";
import { createProductLayoutAction } from "@/app/warehouse/actions/product-layout";

export function AddProductDialog({
  products,
  onAdded,
  branchId,
  zone,
  getPosition,
  open: openProp,
  onOpenChange,
}: {
  products: ProductOption[];
  onAdded: (product: ProductOption & { x: number; y: number; color: string }) => void;
  branchId: number;
  zone: string;
  getPosition?: () => { x: number; y: number };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => products.filter((product) => product.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))), [products, query]);

  const add = (product: ProductOption) => {
    startTransition(async () => {
      const position = getPosition?.() ?? { x: 400, y: 250 };
      const result = await createProductLayoutAction({ productId: product.productId, branchId, zone, ...position });
      if (result.ok) {
        onAdded({ ...product, ...result.data });
        setOpen(false);
        setQuery("");
      }
    });
  };

  const open = openProp ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (openProp === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  return (
    <div>
      {open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 p-20" onMouseDown={() => setOpen(false)}>
        <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Thêm sản phẩm</h2><button onClick={() => setOpen(false)}>×</button></div>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên sản phẩm..." className="mt-3 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300" />
          <div className="mt-3 max-h-72 overflow-auto">
            {filtered.map((product) => <button key={product.productId} disabled={pending} onClick={() => add(product)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50"><span>📦</span><span className="flex-1">{product.name}</span><span className="text-xs text-slate-500">SL: {product.quantity}</span></button>)}
            {filtered.length === 0 && <p className="p-3 text-sm text-slate-500">Không còn sản phẩm phù hợp.</p>}
          </div>
        </div>
      </div>}
    </div>
  );
}
