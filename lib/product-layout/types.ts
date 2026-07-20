export type ProductLayoutRecord = {
  id: string;
  productId: number;
  x: number;
  y: number;
  color: string;
  updatedAt: Date;
  createdAt: Date;
};

export type CreateProductLayoutInput = {
  productId: number;
  x: number;
  y: number;
  color?: string;
};

export type UpdateProductPositionInput = {
  productId: number;
  x: number;
  y: number;
};

export type UpdateProductColorInput = {
  productId: number;
  color: string;
};
