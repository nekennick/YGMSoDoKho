import { WarehouseWorkspace } from "@/app/warehouse/components/WarehouseWorkspace";
import { loadWarehouseInitialData } from "@/lib/warehouse/initial-data";
import { getWarehouse, WAREHOUSES } from "@/lib/warehouse/branches";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const params = await searchParams;
  const warehouse = getWarehouse(params.branch);
  const result = await loadWarehouseInitialData(warehouse.id);
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex h-14 items-center border-b bg-white px-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Warehouse Layout · {warehouse.name}</p>
          <p className="text-xs text-slate-500">Giai đoạn 1 · Nền tảng</p>
        </div>
        <nav className="ml-auto flex gap-1 rounded-md bg-slate-100 p-1 text-xs">
          {Object.values(WAREHOUSES).map((item) => <Link key={item.slug} href={`/warehouse?branch=${item.slug}`} className={`rounded px-2 py-1 ${item.id === warehouse.id ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>{item.name}</Link>)}
        </nav>
      </header>
      <WarehouseWorkspace result={result} branchId={warehouse.id} />
    </main>
  );
}
