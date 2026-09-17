import { WarehouseWorkspace } from "@/app/warehouse/components/WarehouseWorkspace";
import { loadWarehouseInitialData } from "@/lib/warehouse/initial-data";
import { getWarehouse, getWarehouseZone, WAREHOUSES } from "@/lib/warehouse/branches";
import Link from "next/link";
import { WarehouseSettingsButton, WarehouseSettingsProvider } from "@/app/warehouse/components/WarehouseSettings";

export const dynamic = "force-dynamic";

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ branch?: string; zone?: string }> }) {
  const params = await searchParams;
  const warehouse = getWarehouse(params.branch);
  const zone = getWarehouseZone(params.zone, warehouse);
  const result = await loadWarehouseInitialData(warehouse.id, zone);
  return (
    <WarehouseSettingsProvider>
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none bg-slate-100">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b bg-white px-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">Sơ đồ kho · {warehouse.name}</p>
            <p className="truncate text-xs text-slate-500">Powered by Khoa Trần</p>
          </div>
          <nav className="ml-auto flex shrink-0 gap-1 rounded-md bg-slate-100 p-1 text-xs">
            {Object.values(WAREHOUSES).map((item) => <Link key={item.slug} href={`/warehouse?branch=${item.slug}`} className={`rounded px-2 py-1 ${item.id === warehouse.id ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{item.name}</Link>)}
          </nav>
          {warehouse.id === WAREHOUSES.caoLanh.id && <span className="ml-2 hidden rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 sm:inline">Kho Đông + Kho Khô</span>}
          <WarehouseSettingsButton />
        </header>
        <WarehouseWorkspace key={`${warehouse.id}:${zone}`} result={result} branchId={warehouse.id} zone={zone} />
      </main>
    </WarehouseSettingsProvider>
  );
}
