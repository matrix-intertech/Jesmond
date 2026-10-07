ALTER TYPE "PaymentMethod" ADD VALUE 'ONLINE';

CREATE TABLE "OrganizationPaymentSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeConfigured" BOOLEAN NOT NULL DEFAULT false,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationPaymentSettings_organizationId_key" ON "OrganizationPaymentSettings"("organizationId");

ALTER TABLE "OrganizationPaymentSettings" ADD CONSTRAINT "OrganizationPaymentSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
