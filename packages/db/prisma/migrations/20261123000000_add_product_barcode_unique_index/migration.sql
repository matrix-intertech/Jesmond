-- CreateIndex: Enforce barcode uniqueness within organization (PostgreSQL standard allows multiple NULL barcodes)
CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");

-- CreateIndex: Standalone index for direct barcode queries
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");
