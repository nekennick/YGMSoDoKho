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
  pixelsPerMeter: number;
  usableAreaSquareMeters: number;
  excludedAreas: Array<FloorPlanRect & { name: string }>;
};

export const PRODUCT_CHIP_WIDTH = 256;
export const PRODUCT_CHIP_HEIGHT = 40;

const CAO_LANH_COLD_FLOOR_PLAN: WarehouseFloorPlan = {
  id: "cao-lanh-cold",
  name: "Kho Đông Cao Lãnh",
  canvasX: 240,
  canvasY: 240,
  widthMeters: 16,
  heightMeters: 16,
  pixelsPerMeter: 100,
  usableAreaSquareMeters: 226,
  excludedAreas: [
    {
      name: "Kho Mát",
      x: 11 * 100,
      y: 0,
      width: 5 * 100,
      height: 6 * 100,
    },
  ],
};

export function getWarehouseFloorPlan(branchId: number, zone: string): WarehouseFloorPlan | null {
  return branchId === WAREHOUSES.caoLanh.id && zone === "cold"
    ? CAO_LANH_COLD_FLOOR_PLAN
    : null;
}

export function getFloorPlanCanvasRect(plan: WarehouseFloorPlan): FloorPlanRect {
  return {
    x: plan.canvasX,
    y: plan.canvasY,
    width: plan.widthMeters * plan.pixelsPerMeter,
    height: plan.heightMeters * plan.pixelsPerMeter,
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
  const planRect = getFloorPlanCanvasRect(plan);
  const productRect: FloorPlanRect = {
    x: position.x,
    y: position.y,
    width: footprint.width,
    height: footprint.height,
  };

  const insideOuterBoundary = (
    productRect.x >= planRect.x
    && productRect.y >= planRect.y
    && productRect.x + productRect.width <= planRect.x + planRect.width
    && productRect.y + productRect.height <= planRect.y + planRect.height
  );

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
  const planRect = getFloorPlanCanvasRect(plan);
  const clamped = {
    x: clamp(position.x, planRect.x, planRect.x + planRect.width - footprint.width),
    y: clamp(position.y, planRect.y, planRect.y + planRect.height - footprint.height),
  };

  if (isPositionInsideFloorPlan(plan, clamped, footprint)) return clamped;

  const candidates = plan.excludedAreas.flatMap((area) => {
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
      x: clamp(candidate.x, planRect.x, planRect.x + planRect.width - footprint.width),
      y: clamp(candidate.y, planRect.y, planRect.y + planRect.height - footprint.height),
    }));
  }).filter((candidate) => isPositionInsideFloorPlan(plan, candidate, footprint));

  return candidates.reduce((nearest, candidate) => {
    const nearestDistance = Math.hypot(nearest.x - position.x, nearest.y - position.y);
    const candidateDistance = Math.hypot(candidate.x - position.x, candidate.y - position.y);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, candidates[0] ?? { x: planRect.x, y: planRect.y });
}
