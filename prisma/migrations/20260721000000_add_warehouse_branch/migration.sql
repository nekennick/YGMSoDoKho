ALTER TABLE "ProductLayout" ADD COLUMN "branchId" INTEGER NOT NULL DEFAULT 385885;
DROP INDEX "ProductLayout_productId_key";
CREATE UNIQUE INDEX "ProductLayout_branchId_productId_key" ON "ProductLayout"("branchId", "productId");
ALTER TABLE "ProductLayout" ALTER COLUMN "branchId" DROP DEFAULT;
