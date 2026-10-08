-- CreateTable
CREATE TABLE "FoodOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "foodOrderId" TEXT NOT NULL,
    "fromStatus" "FoodOrderStatus",
    "toStatus" "FoodOrderStatus" NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodOrderStatusHistory_foodOrderId_idx" ON "FoodOrderStatusHistory"("foodOrderId");

-- CreateIndex
CREATE INDEX "FoodOrderStatusHistory_changedByUserId_idx" ON "FoodOrderStatusHistory"("changedByUserId");

-- AddForeignKey
ALTER TABLE "FoodOrderStatusHistory" ADD CONSTRAINT "FoodOrderStatusHistory_foodOrderId_fkey" FOREIGN KEY ("foodOrderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderStatusHistory" ADD CONSTRAINT "FoodOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
