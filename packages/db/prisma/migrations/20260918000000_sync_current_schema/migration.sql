-- CreateEnum
CREATE TYPE "PropertyListingType" AS ENUM ('NORMAL', 'ROOM_RENTAL', 'ENTIRE_PLACE', 'STUDENT_ACCOMMODATION', 'CO_LIVING');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'STUDIO', 'GRANNY_FLAT', 'TOWNHOUSE', 'UNIT', 'DUPLEX', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyOfferingType" AS ENUM ('ROOM_IN_SHARED_SPACE', 'ENTIRE_PLACE');

-- CreateEnum
CREATE TYPE "FurnishingType" AS ENUM ('UNFURNISHED', 'FULLY_FURNISHED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'CLOSED');

-- DropForeignKey
ALTER TABLE "Enquiry" DROP CONSTRAINT "Enquiry_studentId_fkey";

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "seekerEmail" TEXT,
ADD COLUMN     "seekerName" TEXT,
ADD COLUMN     "seekerPhone" TEXT,
ADD COLUMN     "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "configuration" JSONB,
ADD COLUMN     "furnishingFeatures" JSONB,
ADD COLUMN     "furnishingType" "FurnishingType",
ADD COLUMN     "hasExistingResidents" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listingType" "PropertyListingType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "maximumOccupancy" INTEGER,
ADD COLUMN     "maximumStay" INTEGER,
ADD COLUMN     "maximumStayUnit" TEXT,
ADD COLUMN     "minimumStay" INTEGER,
ADD COLUMN     "minimumStayUnit" TEXT,
ADD COLUMN     "offeringType" "PropertyOfferingType",
ADD COLUMN     "propertyType" "PropertyType",
ADD COLUMN     "showContactDetails" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "bathroomConfig" TEXT,
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "furnishing" TEXT,
ADD COLUMN     "occupiedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "ethnicity" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "age" INTEGER,
    "ethnicity" TEXT,
    "occupation" TEXT,
    "shortBio" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publicVisibility" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseRule" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "smoking" TEXT,
    "pets" TEXT,
    "parties" TEXT,
    "guests" TEXT,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "additionalRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resident_propertyId_idx" ON "Resident"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseRule_propertyId_key" ON "HouseRule"("propertyId");

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRule" ADD CONSTRAINT "HouseRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

