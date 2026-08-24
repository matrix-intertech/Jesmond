-- CreateEnum
CREATE TYPE "PropertyListingMode" AS ENUM ('MULTI_UNIT', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "listingMode" "PropertyListingMode" NOT NULL DEFAULT 'MULTI_UNIT';
