"use client";

import { memo, useEffect, useRef } from "react";
import type { WarehouseFloorPlan as WarehouseFloorPlanConfig } from "@/lib/warehouse/floor-plans";
import { getFloorPlanCanvasRect, PRODUCT_CHIP_HEIGHT, PRODUCT_CHIP_WIDTH } from "@/lib/warehouse/floor-plans";
import { useWarehouseSettings } from "@/app/warehouse/components/WarehouseSettings";

function traceUsableArea(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  excludedArea: WarehouseFloorPlanConfig["excludedAreas"][number] | undefined,
) {
  context.beginPath();
  context.moveTo(0, 0);
  if (excludedArea) {
    context.lineTo(excludedArea.x, 0);
    context.lineTo(excludedArea.x, excludedArea.height);
    context.lineTo(width, excludedArea.height);
  } else {
    context.lineTo(width, 0);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
}

function drawFloorPlan(canvas: HTMLCanvasElement, plan: WarehouseFloorPlanConfig, showGrid: boolean) {
  const planRect = getFloorPlanCanvasRect(plan);
  const context = canvas.getContext("2d");
  if (!context) return;

  canvas.width = planRect.width;
  canvas.height = planRect.height;
  const excludedArea = plan.excludedAreas[0];

  traceUsableArea(context, planRect.width, planRect.height, excludedArea);
  context.fillStyle = "#eff6ff";
  context.fill();

  context.save();
  traceUsableArea(context, planRect.width, planRect.height, excludedArea);
  context.clip();

  if (showGrid) {
    const minorGridSize = plan.pixelsPerMeter / 2;
    context.beginPath();
    for (let x = minorGridSize; x < planRect.width; x += minorGridSize) {
      context.moveTo(x, 0);
      context.lineTo(x, planRect.height);
    }
    for (let y = minorGridSize; y < planRect.height; y += minorGridSize) {
      context.moveTo(0, y);
      context.lineTo(planRect.width, y);
    }
    context.strokeStyle = "#cbd5e1";
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    for (let x = plan.pixelsPerMeter; x < planRect.width; x += plan.pixelsPerMeter) {
      context.moveTo(x, 0);
      context.lineTo(x, planRect.height);
    }
    for (let y = plan.pixelsPerMeter; y < planRect.height; y += plan.pixelsPerMeter) {
      context.moveTo(0, y);
      context.lineTo(planRect.width, y);
    }
    context.strokeStyle = "#94a3b8";
    context.lineWidth = 2;
    context.stroke();
  }
  context.restore();

  traceUsableArea(context, planRect.width, planRect.height, excludedArea);
  context.strokeStyle = "#1e3a8a";
  context.lineWidth = 12;
  context.lineJoin = "round";
  context.stroke();

  for (const area of plan.excludedAreas) {
    context.fillStyle = "#fee2e2";
    context.fillRect(area.x, area.y, area.width, area.height);

    context.save();
    context.beginPath();
    context.rect(area.x, area.y, area.width, area.height);
    context.clip();
    context.beginPath();
    for (
      let offset = -area.height;
      offset < area.width + area.height;
      offset += 32
    ) {
      context.moveTo(area.x + offset, area.y + area.height);
      context.lineTo(area.x + offset + area.height, area.y);
    }
    context.strokeStyle = "#fecaca";
    context.lineWidth = 10;
    context.stroke();
    context.restore();

    context.strokeStyle = "#b91c1c";
    context.lineWidth = 8;
    context.strokeRect(area.x, area.y, area.width, area.height);

    context.fillStyle = "#991b1b";
    context.font = "700 54px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(area.name, area.x + area.width / 2, area.y + area.height / 2 - 28);

    context.fillStyle = "#b91c1c";
    context.font = "600 34px system-ui, sans-serif";
    context.fillText("Không sử dụng · 5 × 6 m", area.x + area.width / 2, area.y + area.height / 2 + 38);
  }
}

export const WarehouseFloorPlan = memo(function WarehouseFloorPlan({ plan }: { plan: WarehouseFloorPlanConfig }) {
  const { settings } = useWarehouseSettings();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planRect = getFloorPlanCanvasRect(plan);
  const chipWidthMeters = PRODUCT_CHIP_WIDTH / plan.pixelsPerMeter;
  const chipHeightMeters = PRODUCT_CHIP_HEIGHT / plan.pixelsPerMeter;

  useEffect(() => {
    if (canvasRef.current) drawFloorPlan(canvasRef.current, plan, settings.showFloorGrid);
  }, [plan, settings.showFloorGrid]);

  return (
    <div
      aria-label={`${plan.name}, diện tích sử dụng ${plan.usableAreaSquareMeters} mét vuông`}
      className="pointer-events-none absolute"
      style={{
        left: plan.canvasX,
        top: plan.canvasY,
        width: planRect.width,
        height: planRect.height,
      }}
    >
      {settings.showFloorPlanInfo && <div className="absolute bottom-full left-0 mb-3 whitespace-nowrap rounded-lg border border-blue-200 bg-white/95 px-4 py-2 shadow-sm">
        <div className="text-[52px] font-extrabold leading-none tracking-tight text-blue-900">
          KHO ĐÔNG · 226 m²
        </div>
        <div className="mt-2 text-[30px] font-semibold leading-none text-slate-600">
          Mặt bằng 16 × 16 m · mỗi ô lớn 1 m
        </div>
      </div>}

      <canvas
        ref={canvasRef}
        aria-label={`Mặt bằng ${plan.name}`}
        className="block h-full w-full"
        role="img"
        style={{
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      />

      {settings.showFloorPlanInfo && <div className="absolute left-0 top-full mt-3 rounded-lg border border-blue-200 bg-white/90 px-4 py-2 text-[26px] font-semibold text-slate-700 shadow-sm">
        Ô chip chuẩn: {chipWidthMeters.toFixed(2)} × {chipHeightMeters.toFixed(2)} m
      </div>}
    </div>
  );
});
