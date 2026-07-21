"use server";

import { z } from "zod";
import { updateProductPosition } from "@/lib/product-layout/repository";
import { createProductLayout } from "@/lib/product-layout/repository";
import { getProductCatalogService } from "@/lib/warehouse/catalog-service";

const updatePositionSchema = z.object({
  productId: z.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
});

export type ProductLayoutActionResult =
  | { ok: true; data: { productId: number; x: number; y: number } }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string } };

export type CreateProductLayoutActionResult =
  | { ok: true; data: { productId: number; x: number; y: number; color: string } }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "DUPLICATE" | "PERSISTENCE_ERROR"; message: string } };

const createLayoutSchema = z.object({
  productId: z.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
});

export async function createProductLayoutAction(input: unknown): Promise<CreateProductLayoutActionResult> {
  const parsed = createLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Sản phẩm không hợp lệ." } };
  try {
    const product = await getProductCatalogService().getProductById(parsed.data.productId);
    if (!product) return { ok: false, error: { code: "NOT_FOUND", message: "Không tìm thấy sản phẩm trên KiotViet." } };
    const layout = await createProductLayout(parsed.data);
    return { ok: true, data: { productId: layout.productId, x: layout.x, y: layout.y, color: layout.color } };
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("Unique constraint");
    return { ok: false, error: { code: duplicate ? "DUPLICATE" : "PERSISTENCE_ERROR", message: duplicate ? "Sản phẩm đã có trên canvas." : "Không thể thêm sản phẩm." } };
  }
}

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
