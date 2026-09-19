export const DRY_ZONE_MARKER_KEY = "dry-zone-labels";
export const DRY_ZONE_MARKER_PRODUCT_ID = 0;
export const DRY_ZONE_MARKER_LOCKED_GROUP = "system:dry-zone-marker:locked";
export const DRY_ZONE_MARKER_UNLOCKED_GROUP = "system:dry-zone-marker:unlocked";
export const DRY_ZONE_MARKER_COLOR = "#fbbf24";
export const DRY_ZONE_MARKER_LABELS = ["I", "H", "G", "F", "E", "D", "C", "B", "A"] as const;
export const DRY_ZONE_MARKER_SPACING = 600;
export const DRY_ZONE_MARKER_WIDTH = 1300;
export const DRY_ZONE_MARKER_HEIGHT = 80;

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
