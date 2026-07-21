import { z } from "zod";

export const externalProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  isActive: z.boolean().default(true),
});

export type ExternalProduct = z.infer<typeof externalProductSchema>;

export interface ProductCatalogService {
  listProducts(): Promise<ExternalProduct[]>;
  getProductById(productId: number): Promise<ExternalProduct | null>;
}
