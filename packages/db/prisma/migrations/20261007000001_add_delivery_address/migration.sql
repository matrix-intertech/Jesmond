ALTER TABLE "SalesOrder" ADD COLUMN "deliveryAddress" JSONB;
ALTER TABLE "SalesOrder" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "SalesOrder_idempotencyKey_key" ON "SalesOrder"("idempotencyKey");
