export const DRY_ZONE_MARKER_KEY = "dry-zone-labels";
export const DRY_TOP_ZONE_MARKER_KEY = "dry-top-zone-labels";
export const DRY_TOP_ZONE_MARKER_LABELS = ["6", "5", "4", "3", "2", "1"] as const;
export type DryTopZoneMarkerLabel = typeof DRY_TOP_ZONE_MARKER_LABELS[number];
export type DryTopZoneMarkerKey = `dry-top-zone-label-${DryTopZoneMarkerLabel}`;
export const DRY_TOP_ZONE_MARKER_KEYS = DRY_TOP_ZONE_MARKER_LABELS.map((label) => `dry-top-zone-label-${label}` as const);
export type WarehouseZoneMarkerKey = typeof DRY_ZONE_MARKER_KEY | typeof DRY_TOP_ZONE_MARKER_KEY | DryTopZoneMarkerKey;
export const DRY_ZONE_MARKER_PRODUCT_ID = 0;
export const DRY_TOP_ZONE_MARKER_PRODUCT_ID = -1;
export const DRY_TOP_ZONE_MARKER_PRODUCT_IDS = Object.fromEntries(DRY_TOP_ZONE_MARKER_LABELS.map((label, index) => [label, -10 - index])) as Record<DryTopZoneMarkerLabel, number>;
export const SYSTEM_MARKER_PRODUCT_IDS = [DRY_ZONE_MARKER_PRODUCT_ID, DRY_TOP_ZONE_MARKER_PRODUCT_ID, ...Object.values(DRY_TOP_ZONE_MARKER_PRODUCT_IDS)] as const;
export const DRY_ZONE_MARKER_LOCKED_GROUP = "system:dry-zone-marker:locked";
export const DRY_ZONE_MARKER_UNLOCKED_GROUP = "system:dry-zone-marker:unlocked";
export const DRY_ZONE_MARKER_COLOR = "#fbbf24";
export const DRY_ZONE_MARKER_LABELS = ["I", "H", "G", "F", "E", "D", "C", "B", "A"] as const;
export const DRY_ZONE_MARKER_SPACING = 600;
export const DRY_ZONE_MARKER_WIDTH = 1300;
export const DRY_ZONE_MARKER_HEIGHT = 80;
export const DRY_TOP_ZONE_MARKER_SPACING = 600;
export const DRY_TOP_ZONE_MARKER_HEIGHT = 6600;

export type ZoneMarkerLayout = {
  x: number;
  y: number;
  locked: boolean;
};

export const DEFAULT_DRY_ZONE_MARKER: ZoneMarkerLayout = {
  x: 1650,
  y: 300,
  locked: false,
};

export const DEFAULT_DRY_TOP_ZONE_MARKER: ZoneMarkerLayout = {
  x: 0,
  y: -140,
  locked: false,
};

export const DEFAULT_DRY_TOP_ZONE_MARKERS = Object.fromEntries(
  DRY_TOP_ZONE_MARKER_LABELS.map((label, index) => [label, { x: index * DRY_TOP_ZONE_MARKER_SPACING, y: -140, locked: false }]),
) as Record<DryTopZoneMarkerLabel, ZoneMarkerLayout>;

export function getDryTopZoneMarkerKey(label: DryTopZoneMarkerLabel): DryTopZoneMarkerKey {
  return `dry-top-zone-label-${label}`;
}

export function getDryTopZoneMarkerLabel(key: WarehouseZoneMarkerKey): DryTopZoneMarkerLabel | null {
  const label = key.replace("dry-top-zone-label-", "");
  return DRY_TOP_ZONE_MARKER_LABELS.includes(label as DryTopZoneMarkerLabel) ? label as DryTopZoneMarkerLabel : null;
}

export function getWarehouseZoneMarkerProductId(key: WarehouseZoneMarkerKey): number {
  if (key === DRY_ZONE_MARKER_KEY) return DRY_ZONE_MARKER_PRODUCT_ID;
  if (key === DRY_TOP_ZONE_MARKER_KEY) return DRY_TOP_ZONE_MARKER_PRODUCT_ID;
  const label = getDryTopZoneMarkerLabel(key);
  return label ? DRY_TOP_ZONE_MARKER_PRODUCT_IDS[label] : DRY_TOP_ZONE_MARKER_PRODUCT_ID;
}
