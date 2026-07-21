export type ProductLayoutRecord = {
  id: string;
  productId: number;
  branchId: number;
  groupId?: string | null;
  x: number;
  y: number;
  color: string;
  updatedAt: Date;
  createdAt: Date;
};

export type CreateProductLayoutInput = {
  productId: number;
  branchId: number;
  x: number;
  y: number;
  color?: string;
};

export type UpdateProductPositionInput = {
  productId: number;
  branchId: number;
  x: number;
  y: number;
};

export type UpdateProductColorInput = {
  productId: number;
  branchId: number;
  color: string;
};
