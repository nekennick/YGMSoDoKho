import { WarehouseWorkspace } from "@/app/warehouse/components/WarehouseWorkspace";
import { loadWarehouseInitialData } from "@/lib/warehouse/initial-data";
import { getWarehouse, getWarehouseZone } from "@/lib/warehouse/branches";
import { WarehouseSettingsProvider } from "@/app/warehouse/components/WarehouseSettings";
import { WarehouseHeader } from "@/app/warehouse/components/WarehouseHeader";

export const dynamic = "force-dynamic";

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ branch?: string; zone?: string }> }) {
  const params = await searchParams;
  const warehouse = getWarehouse(params.branch);
  const zone = getWarehouseZone(params.zone, warehouse);
  const result = await loadWarehouseInitialData(warehouse.id, zone);
  return (
    <WarehouseSettingsProvider>
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none bg-slate-100">
        <WarehouseHeader warehouseId={warehouse.id} warehouseName={warehouse.name} />
        <WarehouseWorkspace key={`${warehouse.id}:${zone}`} result={result} branchId={warehouse.id} zone={zone} />
      </main>
    </WarehouseSettingsProvider>
  );
}
