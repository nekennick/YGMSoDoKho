import { WarehouseWorkspace } from "@/app/warehouse/components/WarehouseWorkspace";
import { loadWarehouseInitialData } from "@/lib/warehouse/initial-data";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const result = await loadWarehouseInitialData();
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex h-14 items-center border-b bg-white px-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Warehouse Layout</p>
          <p className="text-xs text-slate-500">Giai đoạn 1 · Nền tảng</p>
        </div>
      </header>
      <WarehouseWorkspace result={result} />
    </main>
  );
}
