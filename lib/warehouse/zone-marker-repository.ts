import { prisma } from "@/lib/prisma";
import { DRY_ZONE_MARKER_COLOR, DRY_ZONE_MARKER_LOCKED_GROUP, DRY_ZONE_MARKER_UNLOCKED_GROUP, getWarehouseZoneMarkerProductId, type WarehouseZoneMarkerKey, type ZoneMarkerLayout } from "@/lib/warehouse/zone-markers";

export async function findWarehouseZoneMarker(branchId: number, zone: string, key: WarehouseZoneMarkerKey): Promise<ZoneMarkerLayout | null> {
  const marker = await prisma.productLayout.findUnique({
    where: { branchId_productId: { branchId, productId: getWarehouseZoneMarkerProductId(key) } },
  });
  if (!marker || marker.zone !== zone || ![DRY_ZONE_MARKER_LOCKED_GROUP, DRY_ZONE_MARKER_UNLOCKED_GROUP].includes(marker.groupId ?? "")) return null;
  return { x: marker.x, y: marker.y, locked: marker.groupId === DRY_ZONE_MARKER_LOCKED_GROUP };
}

export async function saveWarehouseZoneMarker(branchId: number, zone: string, key: WarehouseZoneMarkerKey, layout: ZoneMarkerLayout): Promise<ZoneMarkerLayout> {
  const groupId = layout.locked ? DRY_ZONE_MARKER_LOCKED_GROUP : DRY_ZONE_MARKER_UNLOCKED_GROUP;
  const marker = await prisma.productLayout.upsert({
    where: { branchId_productId: { branchId, productId: getWarehouseZoneMarkerProductId(key) } },
    create: { branchId, zone, productId: getWarehouseZoneMarkerProductId(key), x: layout.x, y: layout.y, color: DRY_ZONE_MARKER_COLOR, groupId },
    update: { zone, x: layout.x, y: layout.y, color: DRY_ZONE_MARKER_COLOR, groupId },
  });
  return { x: marker.x, y: marker.y, locked: marker.groupId === DRY_ZONE_MARKER_LOCKED_GROUP };
}
