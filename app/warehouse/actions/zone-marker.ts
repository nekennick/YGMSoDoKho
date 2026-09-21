"use server";

import { z } from "zod";
import { saveWarehouseZoneMarker } from "@/lib/warehouse/zone-marker-repository";

const markerSchema = z.object({
  branchId: z.number().int().positive(),
  zone: z.literal("dry"),
  key: z.union([
    z.literal("dry-zone-labels"), z.literal("dry-top-zone-labels"),
    z.literal("dry-top-zone-label-1"), z.literal("dry-top-zone-label-2"), z.literal("dry-top-zone-label-3"),
    z.literal("dry-top-zone-label-4"), z.literal("dry-top-zone-label-5"), z.literal("dry-top-zone-label-6"),
  ]),
  x: z.number().finite(),
  y: z.number().finite(),
  locked: z.boolean(),
});

export async function saveWarehouseZoneMarkerAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = markerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dữ liệu dãy phân khu không hợp lệ." };
  try {
    await saveWarehouseZoneMarker(parsed.data.branchId, parsed.data.zone, parsed.data.key, parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, message: "Không thể lưu vị trí dãy phân khu." };
  }
}
