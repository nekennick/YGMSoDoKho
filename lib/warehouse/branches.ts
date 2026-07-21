export const WAREHOUSES = {
  binhDuong: { id: 421136, slug: "binh-duong", name: "Bình Dương" },
  caoLanh: { id: 385885, slug: "cao-lanh", name: "Cao Lãnh" },
} as const;

export type Warehouse = (typeof WAREHOUSES)[keyof typeof WAREHOUSES];

export function getWarehouse(slug: string | undefined): Warehouse {
  return slug === WAREHOUSES.binhDuong.slug ? WAREHOUSES.binhDuong : WAREHOUSES.caoLanh;
}
