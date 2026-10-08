-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('RETAIL', 'FOOD', 'MECHANICS', 'SERVICES', 'RENTALS');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "businessCategory" "BusinessCategory" NOT NULL DEFAULT 'RETAIL';

-- AlterTable
ALTER TABLE "RetailBranch" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;
