"use client";

import { useState } from "react";
import Link from "next/link";
import { WarehouseSettingsButton } from "@/app/warehouse/components/WarehouseSettings";
import { WAREHOUSES } from "@/lib/warehouse/branches";

export function WarehouseHeader({ warehouseId, warehouseName, onAdd, onOpenChange }: { warehouseId: number; warehouseName: string; onAdd: () => void; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const toggleMenu = () => setOpen((current) => {
    onOpenChange(!current);
    return !current;
  });

  return (
    <header className="absolute left-1 top-1 z-40">
      <div className="flex items-center gap-1">
        <button type="button" aria-label={open ? "Thu gọn menu" : "Mở menu"} aria-expanded={open} className="grid size-7 place-items-center rounded-md border bg-white text-base font-semibold leading-none text-slate-700 shadow-sm hover:bg-slate-100" onClick={toggleMenu}>{open ? "⌃" : "⌄"}</button>
        <button type="button" aria-label="Thêm sản phẩm" title="Thêm sản phẩm" className="grid size-7 place-items-center rounded-md bg-blue-600 text-lg font-semibold leading-none text-white shadow-sm hover:bg-blue-700" onClick={onAdd}>+</button>
      </div>
      {open && <div className="absolute left-0 top-8 flex w-[min(26rem,calc(100vw-0.5rem))] flex-wrap items-center gap-2 rounded-md border bg-white p-2 shadow-lg">
        <div className="min-w-0 grow">
          <p className="truncate text-sm font-semibold text-slate-900">Sơ đồ kho · {warehouseName}</p>
          <p className="truncate text-xs text-slate-500">Powered by Khoa Trần</p>
        </div>
        <nav className="flex shrink-0 gap-1 rounded-md bg-slate-100 p-1 text-xs">
          {Object.values(WAREHOUSES).map((item) => <Link key={item.slug} href={`/warehouse?branch=${item.slug}`} className={`rounded px-2 py-1 ${item.id === warehouseId ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{item.name}</Link>)}
        </nav>
        <WarehouseSettingsButton />
      </div>}
    </header>
  );
}
