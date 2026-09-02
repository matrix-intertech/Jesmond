-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'MISMATCHED', 'PENDING', 'MANUAL_REVIEW');

-- AlterEnum
ALTER TYPE "RetailPaymentStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "TerminalStatus" ADD VALUE 'BUSY';
ALTER TYPE "TerminalStatus" ADD VALUE 'UPDATING';
ALTER TYPE "TerminalStatus" ADD VALUE 'DISABLED';
ALTER TYPE "TerminalStatus" ADD VALUE 'UNKNOWN';
ALTER TYPE "TerminalStatus" ADD VALUE 'DISCOVERED';
ALTER TYPE "TerminalStatus" ADD VALUE 'PAIRED';
ALTER TYPE "TerminalStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "TerminalStatus" ADD VALUE 'RETIRED';

-- PosTerminal
ALTER TABLE "PosTerminal"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerTerminalId" TEXT;

-- RetailPayment
ALTER TABLE "RetailPayment"
  ADD COLUMN "internalPaymentIntentId" TEXT,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING';

-- Existing schema alignment
ALTER TABLE "Suburb" DROP CONSTRAINT "Suburb_cityId_fkey";

ALTER TABLE "City" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "State" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Suburb" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Suburb"
  ADD CONSTRAINT "Suburb_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
