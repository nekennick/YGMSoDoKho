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

export async function listProductLayouts(branchId: number, zone: string): Promise<ProductLayoutRecord[]> {
  const layouts = await prisma.productLayout.findMany({ where: { branchId, zone }, orderBy: { createdAt: "asc" } });
  return layouts.map(toRecord);
}

export async function listProductLayoutsByBranch(branchId: number): Promise<ProductLayoutRecord[]> {
  const layouts = await prisma.productLayout.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } });
  return layouts.map(toRecord);
}

export async function findProductLayoutInBranch(productId: number, branchId: number): Promise<ProductLayoutRecord | null> {
  const layout = await prisma.productLayout.findUnique({ where: { branchId_productId: { branchId, productId } } });
  return layout ? toRecord(layout) : null;
}

export async function findProductLayout(productId: number, branchId: number, zone: string): Promise<ProductLayoutRecord | null> {
  const layout = await prisma.productLayout.findUnique({ where: { branchId_zone_productId: { branchId, zone, productId } } });
  return layout ? toRecord(layout) : null;
}

export async function createProductLayout(input: CreateProductLayoutInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.create({
    data: {
      productId: input.productId,
      branchId: input.branchId,
      zone: input.zone,
      x: input.x,
      y: input.y,
      ...(input.color === undefined ? {} : { color: input.color }),
    },
  });
  return toRecord(layout);
}

export async function createProductLayouts(inputs: CreateProductLayoutInput[]): Promise<ProductLayoutRecord[]> {
  const layouts = await prisma.$transaction(inputs.map((input) => prisma.productLayout.create({
    data: {
      productId: input.productId,
      branchId: input.branchId,
      zone: input.zone,
      x: input.x,
      y: input.y,
      ...(input.color === undefined ? {} : { color: input.color }),
    },
  })));
  return layouts.map(toRecord);
}

export async function findProductLayoutsInBranch(productIds: number[], branchId: number): Promise<ProductLayoutRecord[]> {
  const layouts = await prisma.productLayout.findMany({
    where: {
      branchId,
      productId: { in: productIds },
    },
  });
  return layouts.map(toRecord);
}

export async function updateProductPosition(input: UpdateProductPositionInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.update({
    where: { branchId_zone_productId: { branchId: input.branchId, zone: input.zone, productId: input.productId } },
    data: { x: input.x, y: input.y },
  });
  return toRecord(layout);
}

export async function updateProductPositions(inputs: UpdateProductPositionInput[]): Promise<void> {
  await prisma.$transaction(inputs.map((input) => prisma.productLayout.update({
    where: { branchId_zone_productId: { branchId: input.branchId, zone: input.zone, productId: input.productId } },
    data: { x: input.x, y: input.y },
  })));
}

export async function updateProductColor(input: UpdateProductColorInput): Promise<ProductLayoutRecord> {
  const layout = await prisma.productLayout.update({
    where: { branchId_zone_productId: { branchId: input.branchId, zone: input.zone, productId: input.productId } },
    data: { color: input.color },
  });
  return toRecord(layout);
}

export async function deleteProductLayout(productId: number, branchId: number, zone: string): Promise<void> {
  await prisma.productLayout.delete({ where: { branchId_zone_productId: { branchId, zone, productId } } });
}

export async function setProductLayoutsGroup(productIds: number[], branchId: number, zone: string, groupId: string | null): Promise<void> {
  await prisma.productLayout.updateMany({ where: { branchId, zone, productId: { in: productIds } }, data: { groupId } });
}
