-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'TAKEAWAY', 'IN_STORE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "RetailBranch" ADD COLUMN     "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "takeawayEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "deliveryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'IN_STORE';
