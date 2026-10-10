-- CreateEnum
CREATE TYPE "TimeOffType" AS ENUM ('LEAVE', 'BREAK', 'OFFLINE_WORK', 'COMMITMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "StaffTimeOff" DROP CONSTRAINT IF EXISTS "StaffTimeOff_staffId_fkey";

-- AlterTable: Add nullable organizationId first for safe backfill
ALTER TABLE "StaffTimeOff"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "recurrence" "RecurrenceRule" NOT NULL DEFAULT 'NONE',
ADD COLUMN "recurrenceEnd" TIMESTAMP(3),
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
ADD COLUMN "type" "TimeOffType" NOT NULL DEFAULT 'LEAVE';

-- Backfill organizationId from OrgStaff if any existing records exist
UPDATE "StaffTimeOff" sto
SET "organizationId" = os."organizationId"
FROM "OrgStaff" os
WHERE sto."staffId" = os."id" AND sto."organizationId" IS NULL;

-- Delete orphaned records if any (where staff was already deleted)
DELETE FROM "StaffTimeOff" WHERE "organizationId" IS NULL;

-- Make organizationId NOT NULL now that it is backfilled
ALTER TABLE "StaffTimeOff" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "StaffTimeOff_organizationId_idx" ON "StaffTimeOff"("organizationId");

-- CreateIndex
CREATE INDEX "StaffTimeOff_deletedAt_idx" ON "StaffTimeOff"("deletedAt");

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrgStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
