-- A product can belong to only one layout zone inside the same warehouse branch.
CREATE UNIQUE INDEX "ProductLayout_branchId_productId_key"
  ON "ProductLayout"("branchId", "productId");
