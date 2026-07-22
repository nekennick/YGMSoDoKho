-- Add an independent layout zone for each warehouse branch.
ALTER TABLE "ProductLayout" ADD COLUMN "zone" TEXT NOT NULL DEFAULT 'dry';

DROP INDEX "ProductLayout_branchId_productId_key";

CREATE UNIQUE INDEX "ProductLayout_branchId_zone_productId_key"
  ON "ProductLayout"("branchId", "zone", "productId");
