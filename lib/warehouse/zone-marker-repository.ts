import { prisma } from "@/lib/prisma";
import { DRY_ZONE_MARKER_COLOR, DRY_ZONE_MARKER_KEY, DRY_ZONE_MARKER_LOCKED_GROUP, DRY_ZONE_MARKER_PRODUCT_ID, DRY_ZONE_MARKER_UNLOCKED_GROUP, type ZoneMarkerLayout } from "@/lib/warehouse/zone-markers";

export async function findWarehouseZoneMarker(branchId: number, zone: string, key: string): Promise<ZoneMarkerLayout | null> {
  if (key !== DRY_ZONE_MARKER_KEY) return null;
  const marker = await prisma.productLayout.findUnique({
    where: { branchId_productId: { branchId, productId: DRY_ZONE_MARKER_PRODUCT_ID } },
  });
  if (!marker || marker.zone !== zone || ![DRY_ZONE_MARKER_LOCKED_GROUP, DRY_ZONE_MARKER_UNLOCKED_GROUP].includes(marker.groupId ?? "")) return null;
  return { x: marker.x, y: marker.y, locked: marker.groupId === DRY_ZONE_MARKER_LOCKED_GROUP };
}

export async function saveWarehouseZoneMarker(branchId: number, zone: string, key: string, layout: ZoneMarkerLayout): Promise<ZoneMarkerLayout> {
  if (key !== DRY_ZONE_MARKER_KEY) throw new Error("Unknown warehouse marker");
  const groupId = layout.locked ? DRY_ZONE_MARKER_LOCKED_GROUP : DRY_ZONE_MARKER_UNLOCKED_GROUP;
  const marker = await prisma.productLayout.upsert({
    where: { branchId_productId: { branchId, productId: DRY_ZONE_MARKER_PRODUCT_ID } },
    create: { branchId, zone, productId: DRY_ZONE_MARKER_PRODUCT_ID, x: layout.x, y: layout.y, color: DRY_ZONE_MARKER_COLOR, groupId },
    update: { zone, x: layout.x, y: layout.y, color: DRY_ZONE_MARKER_COLOR, groupId },
  });
  return { x: marker.x, y: marker.y, locked: marker.groupId === DRY_ZONE_MARKER_LOCKED_GROUP };
}
