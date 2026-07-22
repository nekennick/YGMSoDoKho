export const WAREHOUSES = {
  binhDuong: { id: 421136, slug: "binh-duong", name: "Bình Dương" },
  caoLanh: { id: 385885, slug: "cao-lanh", name: "Cao Lãnh" },
} as const;

export type Warehouse = (typeof WAREHOUSES)[keyof typeof WAREHOUSES];

export const WAREHOUSE_ZONES = {
  dry: { id: "dry", name: "Kho Khô" },
  cold: { id: "cold", name: "Kho Đông" },
} as const;

export type WarehouseZoneId = keyof typeof WAREHOUSE_ZONES;

export function getWarehouse(slug: string | undefined): Warehouse {
  return slug === WAREHOUSES.binhDuong.slug ? WAREHOUSES.binhDuong : WAREHOUSES.caoLanh;
}

export function getWarehouseZone(zone: string | undefined, warehouse: Warehouse): WarehouseZoneId {
  if (warehouse.id === WAREHOUSES.caoLanh.id && zone === WAREHOUSE_ZONES.cold.id) return "cold";
  return "dry";
}
