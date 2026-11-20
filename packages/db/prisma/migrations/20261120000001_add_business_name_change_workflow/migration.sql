-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BusinessNameChangeStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessNameChangeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "currentName" TEXT NOT NULL,
    "proposedName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BusinessNameChangeStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerNotes" TEXT,
    "internalNotes" TEXT,
    "reviewedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessNameChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessNameChangeDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessNameChangeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessNameChangeRequest_organizationId_status_idx" ON "BusinessNameChangeRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "BusinessNameChangeRequest_status_idx" ON "BusinessNameChangeRequest"("status");
CREATE INDEX IF NOT EXISTS "BusinessNameChangeRequest_createdAt_idx" ON "BusinessNameChangeRequest"("createdAt" DESC);

-- Unique partial index enforcing maximum of ONE active request per organization at database level
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessNameChangeRequest_active_org_idx" ON "BusinessNameChangeRequest"("organizationId") WHERE "status" IN ('SUBMITTED', 'UNDER_REVIEW');

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessNameChangeDocument_requestId_idx" ON "BusinessNameChangeDocument"("requestId");
CREATE INDEX IF NOT EXISTS "BusinessNameChangeDocument_organizationId_idx" ON "BusinessNameChangeDocument"("organizationId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeRequest" ADD CONSTRAINT "BusinessNameChangeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeRequest" ADD CONSTRAINT "BusinessNameChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeRequest" ADD CONSTRAINT "BusinessNameChangeRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeDocument" ADD CONSTRAINT "BusinessNameChangeDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BusinessNameChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeDocument" ADD CONSTRAINT "BusinessNameChangeDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessNameChangeDocument" ADD CONSTRAINT "BusinessNameChangeDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
