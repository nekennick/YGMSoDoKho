"use server";

import { z } from "zod";
import { updateProductPosition } from "@/lib/product-layout/repository";
import { updateProductPositions } from "@/lib/product-layout/repository";
import { createProductLayout } from "@/lib/product-layout/repository";
import { createProductLayouts } from "@/lib/product-layout/repository";
import { deleteProductLayout } from "@/lib/product-layout/repository";
import { findProductLayoutInBranch } from "@/lib/product-layout/repository";
import { findProductLayoutsInBranch } from "@/lib/product-layout/repository";
import { setProductLayoutsGroup } from "@/lib/product-layout/repository";
import { getProductCatalogService } from "@/lib/warehouse/catalog-service";
import { getWarehouseFloorPlan, isPositionInsideFloorPlan } from "@/lib/warehouse/floor-plans";

const updatePositionSchema = z.object({
  productId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  zone: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

export type ProductLayoutActionResult =
  | { ok: true; data: { productId: number; x: number; y: number } }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string } };

export type CreateProductLayoutActionResult =
  | { ok: true; data: { productId: number; x: number; y: number; color: string; quantity: number } }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "DUPLICATE" | "PERSISTENCE_ERROR"; message: string } };

export type CreateProductLayoutsActionResult =
  | { ok: true; data: Array<{ productId: number; x: number; y: number; color: string; quantity: number }> }
  | { ok: false; error: { code: "INVALID_INPUT" | "NOT_FOUND" | "DUPLICATE" | "PERSISTENCE_ERROR"; message: string } };

const createLayoutSchema = z.object({
  productId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  zone: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

export async function createProductLayoutAction(input: unknown): Promise<CreateProductLayoutActionResult> {
  const parsed = createLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Sản phẩm không hợp lệ." } };
  try {
    const existingLayout = await findProductLayoutInBranch(parsed.data.productId, parsed.data.branchId);
    if (existingLayout) {
      return { ok: false, error: { code: "DUPLICATE", message: "Sản phẩm đã nằm trong một vùng của kho này." } };
    }
    const product = await getProductCatalogService(parsed.data.branchId).getProductById(parsed.data.productId);
    if (!product) return { ok: false, error: { code: "NOT_FOUND", message: "Không tìm thấy sản phẩm trên KiotViet." } };
    const layout = await createProductLayout(parsed.data);
    return { ok: true, data: { productId: layout.productId, x: layout.x, y: layout.y, color: layout.color, quantity: product.quantity } };
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("Unique constraint");
    return { ok: false, error: { code: duplicate ? "DUPLICATE" : "PERSISTENCE_ERROR", message: duplicate ? "Sản phẩm đã nằm trong một vùng của kho này." : "Không thể thêm sản phẩm." } };
  }
}

const createLayoutsSchema = z.object({
  branchId: z.number().int().positive(),
  zone: z.string().min(1),
  products: z.array(z.object({
    productId: z.number().int().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
  })).min(1).max(100),
}).superRefine((value, context) => {
  const productIds = value.products.map((product) => product.productId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Danh sách sản phẩm bị trùng.",
      path: ["products"],
    });
  }
});

export async function createProductLayoutsAction(input: unknown): Promise<CreateProductLayoutsActionResult> {
  const parsed = createLayoutsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Danh sách sản phẩm không hợp lệ." } };
  }

  const { branchId, zone, products: requestedProducts } = parsed.data;
  const productIds = requestedProducts.map((product) => product.productId);
  const floorPlan = getWarehouseFloorPlan(branchId, zone);
  if (floorPlan && requestedProducts.some((product) => !isPositionInsideFloorPlan(floorPlan, product))) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Có sản phẩm nằm ngoài vùng sử dụng của kho." } };
  }

  try {
    const existingLayouts = await findProductLayoutsInBranch(productIds, branchId);
    if (existingLayouts.length > 0) {
      return { ok: false, error: { code: "DUPLICATE", message: "Có sản phẩm đã nằm trong một vùng của kho này." } };
    }

    const catalog = await getProductCatalogService(branchId).listProducts();
    const catalogById = new Map(catalog.filter((product) => product.isActive).map((product) => [product.id, product]));
    if (productIds.some((productId) => !catalogById.has(productId))) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Có sản phẩm không còn hoạt động trên KiotViet." } };
    }

    const layouts = await createProductLayouts(requestedProducts.map((product) => ({
      ...product,
      branchId,
      zone,
    })));

    return {
      ok: true,
      data: layouts.map((layout) => ({
        productId: layout.productId,
        x: layout.x,
        y: layout.y,
        color: layout.color,
        quantity: catalogById.get(layout.productId)?.quantity ?? 0,
      })),
    };
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("Unique constraint");
    return {
      ok: false,
      error: {
        code: duplicate ? "DUPLICATE" : "PERSISTENCE_ERROR",
        message: duplicate ? "Có sản phẩm đã nằm trong một vùng của kho này." : "Không thể thêm các sản phẩm.",
      },
    };
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
      ? "Sản phẩm không còn trên sơ đồ kho."
      : "Không thể lưu vị trí sản phẩm.";
    return { ok: false, error: { code: message.includes("không còn") ? "NOT_FOUND" : "PERSISTENCE_ERROR", message } };
  }
}

const batchPositionSchema = z.object({ branchId: z.number().int().positive(), zone: z.string().min(1), positions: z.array(z.object({ productId: z.number().int().positive(), x: z.number().finite(), y: z.number().finite() })).min(1) });
export async function updateProductPositionsAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = batchPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Vị trí nhóm không hợp lệ." };
  try { await updateProductPositions(parsed.data.positions.map((position) => ({ ...position, branchId: parsed.data.branchId, zone: parsed.data.zone }))); return { ok: true }; } catch { return { ok: false, message: "Không thể lưu vị trí nhóm." }; }
}

const deleteLayoutSchema = z.object({ productId: z.number().int().positive(), branchId: z.number().int().positive(), zone: z.string().min(1) });

export async function deleteProductLayoutAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Sản phẩm không hợp lệ." };
  try {
    await deleteProductLayout(parsed.data.productId, parsed.data.branchId, parsed.data.zone);
    return { ok: true };
  } catch {
    return { ok: false, message: "Không thể xóa sản phẩm khỏi sơ đồ kho." };
  }
}

const groupSchema = z.object({ productIds: z.array(z.number().int().positive()).min(1), branchId: z.number().int().positive(), zone: z.string().min(1), groupId: z.string().nullable() });
export async function setProductLayoutsGroupAction(input: unknown): Promise<{ ok: true; groupId: string | null } | { ok: false; message: string }> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Nhóm sản phẩm không hợp lệ." };
  try {
    await setProductLayoutsGroup(parsed.data.productIds, parsed.data.branchId, parsed.data.zone, parsed.data.groupId);
    return { ok: true, groupId: parsed.data.groupId };
  } catch {
    return { ok: false, message: "Không thể cập nhật nhóm sản phẩm." };
  }
}
