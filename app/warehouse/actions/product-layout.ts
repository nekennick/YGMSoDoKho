"use server";

import { z } from "zod";
import { updateProductPosition } from "@/lib/product-layout/repository";

const updatePositionSchema = z.object({
  productId: z.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
});

export type ProductLayoutActionResult =
  | { ok: true; data: { productId: number; x: number; y: number } }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string } };

export async function updateProductPositionAction(input: unknown): Promise<ProductLayoutActionResult> {
  const parsed = updatePositionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Vị trí sản phẩm không hợp lệ." } };
  }

  try {
    const layout = await updateProductPosition(parsed.data);
    return { ok: true, data: { productId: layout.productId, x: layout.x, y: layout.y } };
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Record to update not found")
      ? "Sản phẩm không còn trên canvas."
      : "Không thể lưu vị trí sản phẩm.";
    return { ok: false, error: { code: message.includes("không còn") ? "NOT_FOUND" : "PERSISTENCE_ERROR", message } };
  }
}
