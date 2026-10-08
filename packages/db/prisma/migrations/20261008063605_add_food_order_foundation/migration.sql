-- CreateEnum
CREATE TYPE "FoodOrderStatus" AS ENUM ('PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "FoodOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "FoodOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderItem" (
    "id" TEXT NOT NULL,
    "foodOrderId" TEXT NOT NULL,
    "foodMenuItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_orderNumber_key" ON "FoodOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_idempotencyKey_key" ON "FoodOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FoodOrder_organizationId_idx" ON "FoodOrder"("organizationId");

-- CreateIndex
CREATE INDEX "FoodOrder_branchId_idx" ON "FoodOrder"("branchId");

-- CreateIndex
CREATE INDEX "FoodOrder_userId_idx" ON "FoodOrder"("userId");

-- CreateIndex
CREATE INDEX "FoodOrderItem_foodOrderId_idx" ON "FoodOrderItem"("foodOrderId");

-- CreateIndex
CREATE INDEX "FoodOrderItem_foodMenuItemId_idx" ON "FoodOrderItem"("foodMenuItemId");

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RetailBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_foodOrderId_fkey" FOREIGN KEY ("foodOrderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_foodMenuItemId_fkey" FOREIGN KEY ("foodMenuItemId") REFERENCES "FoodMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
