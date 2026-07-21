import { prisma } from "@/lib/prisma";
import type {
  CreateProductLayoutInput,
  ProductLayoutRecord,
  UpdateProductColorInput,
  UpdateProductPositionInput,
} from "@/lib/product-layout/types";

function toRecord(layout: ProductLayoutRecord): ProductLayoutRecord {
  return layout;
}

export async function listProductLayouts(branchId: number): Promise<ProductLayoutRecord[]> {
  const layouts = await prisma.productLayout.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } });
  return layouts.map(toRecord);
}

export async function findProductLayout(productId: number, branchId: number): Promise<ProductLayoutRecord | null> {
  const layout = await prisma.productLayout.findUnique({ where: { branchId_productId: { branchId, productId } } });
  return layout ? toRecord(layout) : null;
}

export async function createProductLayout(input: CreateProductLayoutInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.create({
    data: {
      productId: input.productId,
      branchId: input.branchId,
      x: input.x,
      y: input.y,
      ...(input.color === undefined ? {} : { color: input.color }),
    },
  });
  return toRecord(layout);
}

export async function updateProductPosition(input: UpdateProductPositionInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.update({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    data: { x: input.x, y: input.y },
  });
  return toRecord(layout);
}

export async function updateProductColor(input: UpdateProductColorInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.update({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    data: { color: input.color },
  });
  return toRecord(layout);
}

export async function deleteProductLayout(productId: number, branchId: number): Promise<void> {
  await prisma.productLayout.delete({ where: { branchId_productId: { branchId, productId } } });
}
