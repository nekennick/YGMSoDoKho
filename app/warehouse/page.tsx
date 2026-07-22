import { WarehouseWorkspace } from "@/app/warehouse/components/WarehouseWorkspace";
import { loadWarehouseInitialData } from "@/lib/warehouse/initial-data";
import { getWarehouse, getWarehouseZone, WAREHOUSES, WAREHOUSE_ZONES } from "@/lib/warehouse/branches";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ branch?: string; zone?: string }> }) {
  const params = await searchParams;
  const warehouse = getWarehouse(params.branch);
  const zone = getWarehouseZone(params.zone, warehouse);
  const result = await loadWarehouseInitialData(warehouse.id, zone);
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none bg-slate-100">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b bg-white px-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Warehouse Layout · {warehouse.name}</p>
          <p className="text-xs text-slate-500">Giai đoạn 1 · Nền tảng</p>
        </div>
        <nav className="ml-auto flex gap-1 rounded-md bg-slate-100 p-1 text-xs">
          {Object.values(WAREHOUSES).map((item) => <Link key={item.slug} href={`/warehouse?branch=${item.slug}`} className={`rounded px-2 py-1 ${item.id === warehouse.id ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{item.name}</Link>)}
        </nav>
        {warehouse.id === WAREHOUSES.caoLanh.id && <nav className="ml-2 flex gap-1 rounded-md bg-amber-50 p-1 text-xs">
          {Object.values(WAREHOUSE_ZONES).map((item) => <Link key={item.id} href={`/warehouse?branch=${warehouse.slug}&zone=${item.id}`} className={`rounded px-2 py-1 ${zone === item.id ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{item.name}</Link>)}
        </nav>}
      </header>
      <WarehouseWorkspace result={result} branchId={warehouse.id} zone={zone} />
    </main>
  );
}
