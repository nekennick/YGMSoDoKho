"use client";

import { useState } from "react";
import Link from "next/link";
import { WarehouseSettingsButton } from "@/app/warehouse/components/WarehouseSettings";
import { WAREHOUSES } from "@/lib/warehouse/branches";

export function WarehouseHeader({ warehouseId, warehouseName }: { warehouseId: number; warehouseName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b bg-white shadow-sm">
      <div className="flex h-11 items-center px-3 sm:px-5">
        <button type="button" aria-label={open ? "Thu gọn menu" : "Mở menu"} aria-expanded={open} className="grid size-8 place-items-center rounded-md text-lg font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setOpen((current) => !current)}>{open ? "⌃" : "⌄"}</button>
      </div>
      {open && <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 sm:px-5">
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
