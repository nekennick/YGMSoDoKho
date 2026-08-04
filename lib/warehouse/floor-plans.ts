import { WAREHOUSES } from "@/lib/warehouse/branches";

export type FloorPlanRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WarehouseFloorPlan = {
  id: string;
  name: string;
  canvasX: number;
  canvasY: number;
  widthMeters: number;
  heightMeters: number;
  usableHeightMeters: number;
  pixelsPerMeter: number;
  usableAreaSquareMeters: number;
  notchedBoundary?: boolean;
  displayTitle?: string;
  displaySubtitle?: string;
  showPackingLabel?: boolean;
  excludedAreas: Array<FloorPlanRect & { name: string; muted?: boolean }>;
  overviewAreas?: Array<FloorPlanRect & { name: string; muted?: boolean }>;
  highlightAreas?: Array<FloorPlanRect & { name: string }>;
  additionalUsableAreas: Array<FloorPlanRect & { name: string }>;
};

export const PRODUCT_CHIP_WIDTH = 205;
export const PRODUCT_CHIP_HEIGHT = 40;

const CAO_LANH_COLD_FLOOR_PLAN: WarehouseFloorPlan = {
  id: "cao-lanh-cold",
  name: "Kho Đông Cao Lãnh",
  canvasX: 240,
  canvasY: 240,
  widthMeters: 16,
  heightMeters: 22,
  usableHeightMeters: 16,
  pixelsPerMeter: 100,
  usableAreaSquareMeters: 250,
  notchedBoundary: true,
  showPackingLabel: true,
  excludedAreas: [
    {
      name: "Kho Mát",
      x: 11 * 100,
      y: 0,
      width: 5 * 100,
      height: 6 * 100,
    },
  ],
  additionalUsableAreas: [
    {
      name: "Kho Mát 1",
      x: 0,
      y: 16 * 100,
      width: 4 * 100,
      height: 6 * 100,
    },
  ],
};

const CAO_LANH_DRY_FLOOR_PLAN: WarehouseFloorPlan = {
  id: "cao-lanh-dry",
  name: "Kho Khô Cao Lãnh",
  canvasX: 0,
  canvasY: 0,
  widthMeters: 29.91,
  heightMeters: 65,
  usableHeightMeters: 65,
  pixelsPerMeter: 100,
  usableAreaSquareMeters: 910,
  displayTitle: "KHO KHÔ CAO LÃNH",
  displaySubtitle: "Mặt bằng tổng thể · khu đặt chip bên phải khoảng 13,91 × 65 m",
  showPackingLabel: false,
  excludedAreas: [
    { name: "Kho Đông", x: 0, y: 0, width: 16 * 100, height: 16 * 100, muted: true },
    { name: "Khu Soạn Hàng", x: 0, y: 16 * 100, width: 16 * 100, height: 10 * 100, muted: true },
  ],
  overviewAreas: [
    { name: "Kho Mát 2", x: 11 * 100, y: 0, width: 5 * 100, height: 6 * 100, muted: true },
    { name: "Kho Mát 1", x: 0, y: 16 * 100, width: 4 * 100, height: 6 * 100, muted: true },
  ],
  highlightAreas: [
    { name: "Kho Khô", x: 16 * 100, y: 0, width: 13.91 * 100, height: 65 * 100 },
  ],
  additionalUsableAreas: [],
};

export function getWarehouseFloorPlan(branchId: number, zone: string): WarehouseFloorPlan | null {
  if (branchId !== WAREHOUSES.caoLanh.id) return null;
  if (zone === "cold") return CAO_LANH_COLD_FLOOR_PLAN;
  if (zone === "dry") return CAO_LANH_DRY_FLOOR_PLAN;
  return null;
}

export function getFloorPlanCanvasRect(plan: WarehouseFloorPlan): FloorPlanRect {
  return {
    x: plan.canvasX,
    y: plan.canvasY,
    width: plan.widthMeters * plan.pixelsPerMeter,
    height: plan.heightMeters * plan.pixelsPerMeter,
  };
}

export function getFloorPlanUsableRect(plan: WarehouseFloorPlan): FloorPlanRect {
  return {
    x: plan.canvasX,
    y: plan.canvasY,
    width: plan.widthMeters * plan.pixelsPerMeter,
    height: plan.usableHeightMeters * plan.pixelsPerMeter,
  };
}

function rectanglesOverlap(first: FloorPlanRect, second: FloorPlanRect): boolean {
  return (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  );
}

export function isPositionInsideFloorPlan(
  plan: WarehouseFloorPlan,
  position: { x: number; y: number },
  footprint: { width: number; height: number } = {
    width: PRODUCT_CHIP_WIDTH,
    height: PRODUCT_CHIP_HEIGHT,
  },
): boolean {
  const planRect = getFloorPlanUsableRect(plan);
  const allowedRects = [
    planRect,
    ...plan.additionalUsableAreas.map((area) => ({
      x: plan.canvasX + area.x,
      y: plan.canvasY + area.y,
      width: area.width,
      height: area.height,
    })),
  ];
  const productRect: FloorPlanRect = {
    x: position.x,
    y: position.y,
    width: footprint.width,
    height: footprint.height,
  };

  const insideOuterBoundary = allowedRects.some((allowedRect) => (
    productRect.x >= allowedRect.x
    && productRect.y >= allowedRect.y
    && productRect.x + productRect.width <= allowedRect.x + allowedRect.width
    && productRect.y + productRect.height <= allowedRect.y + allowedRect.height
  ));

  if (!insideOuterBoundary) return false;

  return plan.excludedAreas.every((area) => !rectanglesOverlap(productRect, {
    x: plan.canvasX + area.x,
    y: plan.canvasY + area.y,
    width: area.width,
    height: area.height,
  }));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function findNearestValidFloorPlanPosition(
  plan: WarehouseFloorPlan,
  position: { x: number; y: number },
  footprint: { width: number; height: number } = {
    width: PRODUCT_CHIP_WIDTH,
    height: PRODUCT_CHIP_HEIGHT,
  },
): { x: number; y: number } {
  const planRect = getFloorPlanUsableRect(plan);
  const allowedRects = [
    planRect,
    ...plan.additionalUsableAreas.map((area) => ({
      x: plan.canvasX + area.x,
      y: plan.canvasY + area.y,
      width: area.width,
      height: area.height,
    })),
  ];
  const canvasRect = getFloorPlanCanvasRect(plan);
  const clamped = {
    x: clamp(position.x, canvasRect.x, canvasRect.x + canvasRect.width - footprint.width),
    y: clamp(position.y, canvasRect.y, canvasRect.y + canvasRect.height - footprint.height),
  };

  if (isPositionInsideFloorPlan(plan, clamped, footprint)) return clamped;

  const allowedCandidates = allowedRects.map((allowedRect) => ({
    x: clamp(position.x, allowedRect.x, allowedRect.x + allowedRect.width - footprint.width),
    y: clamp(position.y, allowedRect.y, allowedRect.y + allowedRect.height - footprint.height),
  }));
  const excludedCandidates = plan.excludedAreas.flatMap((area) => {
    const excluded = {
      x: plan.canvasX + area.x,
      y: plan.canvasY + area.y,
      width: area.width,
      height: area.height,
    };

    return [
      {
        x: excluded.x - footprint.width,
        y: clamped.y,
      },
      {
        x: excluded.x + excluded.width,
        y: clamped.y,
      },
      {
        x: clamped.x,
        y: excluded.y - footprint.height,
      },
      {
        x: clamped.x,
        y: excluded.y + excluded.height,
      },
    ].map((candidate) => ({
      x: clamp(candidate.x, canvasRect.x, canvasRect.x + canvasRect.width - footprint.width),
      y: clamp(candidate.y, canvasRect.y, canvasRect.y + canvasRect.height - footprint.height),
    }));
  });
  const candidates = [...allowedCandidates, ...excludedCandidates]
    .filter((candidate) => isPositionInsideFloorPlan(plan, candidate, footprint));

  return candidates.reduce((nearest, candidate) => {
    const nearestDistance = Math.hypot(nearest.x - position.x, nearest.y - position.y);
    const candidateDistance = Math.hypot(candidate.x - position.x, candidate.y - position.y);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, candidates[0] ?? { x: planRect.x, y: planRect.y });
}
