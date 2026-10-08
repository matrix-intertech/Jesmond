-- CreateEnum
CREATE TYPE "FoodOrderFulfillmentType" AS ENUM ('DELIVERY', 'TAKEAWAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FoodOrderStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "FoodOrderStatus" ADD VALUE 'PREPARING';
ALTER TYPE "FoodOrderStatus" ADD VALUE 'READY';
ALTER TYPE "FoodOrderStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "FoodOrder" ADD COLUMN     "deliveryAddress" JSONB,
ADD COLUMN     "fulfillmentType" "FoodOrderFulfillmentType" NOT NULL DEFAULT 'TAKEAWAY',
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
