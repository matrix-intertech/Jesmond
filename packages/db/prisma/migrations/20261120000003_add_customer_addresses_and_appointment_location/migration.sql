-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ServiceLocationType" AS ENUM ('AT_BRANCH', 'CUSTOMER_LOCATION', 'FLEXIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable BusinessService
ALTER TABLE "BusinessService" ADD COLUMN IF NOT EXISTS "locationType" "ServiceLocationType" NOT NULL DEFAULT 'AT_BRANCH';

-- CreateTable CustomerAddress
CREATE TABLE IF NOT EXISTS "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "recipientName" TEXT,
    "phone" TEXT,
    "streetAddress" TEXT NOT NULL,
    "unitNumber" TEXT,
    "suburb" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Australia',
    "instructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- AlterTable Appointment
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "locationType" "ServiceLocationType" NOT NULL DEFAULT 'AT_BRANCH';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customerAddressId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addressSnapshot" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");
CREATE INDEX IF NOT EXISTS "CustomerAddress_userId_isDefault_idx" ON "CustomerAddress"("userId", "isDefault");
CREATE INDEX IF NOT EXISTS "Appointment_customerAddressId_idx" ON "Appointment"("customerAddressId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
