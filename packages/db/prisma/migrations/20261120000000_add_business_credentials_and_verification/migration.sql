-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CredentialStatus" AS ENUM ('NOT_SUBMITTED', 'DRAFT', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'NEEDS_INFORMATION', 'UNABLE_TO_VERIFY', 'NOT_APPLICABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BusinessVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'PARTIALLY_VERIFIED', 'VERIFIED', 'ACTION_REQUIRED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "VerificationMethod" AS ENUM ('AUTOMATED_ABR', 'AUTOMATED_REGISTRY', 'MANUAL_ADMIN', 'SYSTEM_EXEMPTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AbnExemptionStatus" AS ENUM ('NOT_REQUESTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CredentialType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "BusinessCategory",
    "issuer" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'ALL',
    "requiresDocument" BOOLEAN NOT NULL DEFAULT true,
    "requiresExpiryDate" BOOLEAN NOT NULL DEFAULT false,
    "requiresNumber" BOOLEAN NOT NULL DEFAULT true,
    "numberPattern" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CredentialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CredentialRequirement" (
    "id" TEXT NOT NULL,
    "credentialTypeId" TEXT NOT NULL,
    "businessCategory" "BusinessCategory" NOT NULL,
    "serviceName" TEXT,
    "state" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialTypeId" TEXT NOT NULL,
    "credentialNumber" TEXT,
    "holderName" TEXT,
    "issuingAuthority" TEXT,
    "state" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "status" "CredentialStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verificationMethod" "VerificationMethod",
    "reviewerNotes" TEXT,
    "internalNotes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CredentialDocument" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CredentialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessProfileCompletion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "dismissedUntil" TIMESTAMP(3),
    "lastPromptedAt" TIMESTAMP(3),
    "dismissCount" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedSteps" JSONB,
    "missingRequirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overallStatus" "BusinessVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "abnExempt" BOOLEAN NOT NULL DEFAULT false,
    "abnExemptionStatus" "AbnExemptionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "abnExemptionReason" TEXT,
    "abnExemptionRequestedAt" TIMESTAMP(3),
    "abnExemptionReviewedAt" TIMESTAMP(3),
    "abnExemptionReviewedBy" TEXT,
    "abnExemptionReviewNotes" TEXT,
    "abnExemptionInternalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessProfileCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CredentialType_code_key" ON "CredentialType"("code");
CREATE INDEX IF NOT EXISTS "CredentialType_category_jurisdiction_idx" ON "CredentialType"("category", "jurisdiction");
CREATE INDEX IF NOT EXISTS "CredentialType_code_idx" ON "CredentialType"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CredentialRequirement_credentialTypeId_businessCategory_serviceName_state_key" ON "CredentialRequirement"("credentialTypeId", "businessCategory", "serviceName", "state");
CREATE INDEX IF NOT EXISTS "CredentialRequirement_businessCategory_state_idx" ON "CredentialRequirement"("businessCategory", "state");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessCredential_organizationId_credentialTypeId_key" ON "BusinessCredential"("organizationId", "credentialTypeId");
CREATE INDEX IF NOT EXISTS "BusinessCredential_organizationId_status_idx" ON "BusinessCredential"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "BusinessCredential_credentialTypeId_idx" ON "BusinessCredential"("credentialTypeId");
CREATE INDEX IF NOT EXISTS "BusinessCredential_verifiedByUserId_idx" ON "BusinessCredential"("verifiedByUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CredentialDocument_credentialId_idx" ON "CredentialDocument"("credentialId");
CREATE INDEX IF NOT EXISTS "CredentialDocument_organizationId_idx" ON "CredentialDocument"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessProfileCompletion_organizationId_key" ON "BusinessProfileCompletion"("organizationId");
CREATE INDEX IF NOT EXISTS "BusinessProfileCompletion_organizationId_idx" ON "BusinessProfileCompletion"("organizationId");
CREATE INDEX IF NOT EXISTS "BusinessProfileCompletion_overallStatus_idx" ON "BusinessProfileCompletion"("overallStatus");
CREATE INDEX IF NOT EXISTS "BusinessProfileCompletion_dismissedUntil_idx" ON "BusinessProfileCompletion"("dismissedUntil");
CREATE INDEX IF NOT EXISTS "BusinessProfileCompletion_abnExemptionStatus_idx" ON "BusinessProfileCompletion"("abnExemptionStatus");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CredentialRequirement" ADD CONSTRAINT "CredentialRequirement_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "CredentialType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessCredential" ADD CONSTRAINT "BusinessCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessCredential" ADD CONSTRAINT "BusinessCredential_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "CredentialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessCredential" ADD CONSTRAINT "BusinessCredential_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CredentialDocument" ADD CONSTRAINT "CredentialDocument_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "BusinessCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CredentialDocument" ADD CONSTRAINT "CredentialDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "CredentialDocument" ADD CONSTRAINT "CredentialDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BusinessProfileCompletion" ADD CONSTRAINT "BusinessProfileCompletion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
