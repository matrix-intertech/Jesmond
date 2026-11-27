-- CreateEnum
CREATE TYPE "SubscriptionProfileType" AS ENUM ('ACCOMMODATION', 'RETAIL', 'FOOD', 'MECHANICS', 'SERVICES', 'RENTALS');

-- CreateEnum
CREATE TYPE "SubscriptionPlanTier" AS ENUM ('FREE', 'STANDARD', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('FREE', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('FREE_AUTO', 'MANUAL_ADMIN', 'ONLINE_CHECKOUT', 'ENTERPRISE_CONTRACT');

-- CreateEnum
CREATE TYPE "SubscriptionFeatureValueType" AS ENUM ('BOOLEAN', 'NUMERIC_LIMIT');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SubscriptionBillingPeriodStatus" AS ENUM ('OPEN', 'PAID', 'PAST_DUE', 'VOID');

-- CreateEnum
CREATE TYPE "SubscriptionTaxBehavior" AS ENUM ('EXCLUSIVE', 'INCLUSIVE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "SubscriptionActorType" AS ENUM ('USER', 'SYSTEM', 'API_KEY');

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "profileType" "SubscriptionProfileType" NOT NULL,
    "code" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" "SubscriptionPlanTier" NOT NULL DEFAULT 'FREE',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isEnterprise" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "priceVersion" INTEGER NOT NULL DEFAULT 1,
    "interval" "SubscriptionBillingInterval" NOT NULL,
    "unitAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "currencyDecimals" INTEGER NOT NULL DEFAULT 2,
    "taxBehavior" "SubscriptionTaxBehavior" NOT NULL DEFAULT 'UNSPECIFIED',
    "taxRateBps" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalPriceId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionFeature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueType" "SubscriptionFeatureValueType" NOT NULL DEFAULT 'BOOLEAN',
    "applicableProfiles" "SubscriptionProfileType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeatureLimit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanFeatureLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "planPriceId" TEXT,
    "profileType" "SubscriptionProfileType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingInterval" "SubscriptionBillingInterval" NOT NULL DEFAULT 'FREE',
    "source" "SubscriptionSource" NOT NULL DEFAULT 'FREE_AUTO',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "currentSnapshotId" TEXT,
    "replacedBySubscriptionId" TEXT,
    "enterpriseBillingDetails" JSONB,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationEntitlementOverride" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationEntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEntitlementSnapshot" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "planId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "overridesSnapshot" JSONB NOT NULL,
    "resolvedEntitlements" JSONB NOT NULL,
    "actorId" TEXT,
    "actorType" "SubscriptionActorType" NOT NULL DEFAULT 'SYSTEM',
    "reason" TEXT,
    "previousSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEntitlementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionUsageCounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionBillingPeriod" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planPriceId" TEXT,
    "unitAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "taxAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionBillingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionBillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPaymentTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "billingPeriodId" TEXT,
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "taxAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "SubscriptionWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "actorId" TEXT,
    "actorType" "SubscriptionActorType" NOT NULL DEFAULT 'SYSTEM',
    "action" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionPlan_profileType_isActive_isPublic_idx" ON "SubscriptionPlan"("profileType", "isActive", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_profileType_code_key" ON "SubscriptionPlan"("profileType", "code");

-- CreateIndex
CREATE INDEX "SubscriptionPlanPrice_planId_isActive_idx" ON "SubscriptionPlanPrice"("planId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanPrice_planId_interval_currency_priceVersion_key" ON "SubscriptionPlanPrice"("planId", "interval", "currency", "priceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionFeature_key_key" ON "SubscriptionFeature"("key");

-- CreateIndex
CREATE INDEX "PlanFeatureLimit_planId_idx" ON "PlanFeatureLimit"("planId");

-- CreateIndex
CREATE INDEX "PlanFeatureLimit_featureId_idx" ON "PlanFeatureLimit"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeatureLimit_planId_planVersion_featureId_key" ON "PlanFeatureLimit"("planId", "planVersion", "featureId");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_organizationId_status_idx" ON "OrganizationSubscription"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_currentPeriodEnd_status_idx" ON "OrganizationSubscription"("currentPeriodEnd", "status");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_profileType_status_idx" ON "OrganizationSubscription"("profileType", "status");

-- CreateIndex
CREATE INDEX "OrganizationEntitlementOverride_organizationId_idx" ON "OrganizationEntitlementOverride"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationEntitlementOverride_subscriptionId_idx" ON "OrganizationEntitlementOverride"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationEntitlementOverride_subscriptionId_featureId_key" ON "OrganizationEntitlementOverride"("subscriptionId", "featureId");

-- CreateIndex
CREATE INDEX "SubscriptionEntitlementSnapshot_organizationId_effectiveFro_idx" ON "SubscriptionEntitlementSnapshot"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SubscriptionEntitlementSnapshot_subscriptionId_effectiveFro_idx" ON "SubscriptionEntitlementSnapshot"("subscriptionId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEntitlementSnapshot_subscriptionId_version_key" ON "SubscriptionEntitlementSnapshot"("subscriptionId", "version");

-- CreateIndex
CREATE INDEX "SubscriptionUsageCounter_organizationId_idx" ON "SubscriptionUsageCounter"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionUsageCounter_organizationId_featureKey_key" ON "SubscriptionUsageCounter"("organizationId", "featureKey");

-- CreateIndex
CREATE INDEX "SubscriptionBillingPeriod_organizationId_periodStart_period_idx" ON "SubscriptionBillingPeriod"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionBillingPeriod_subscriptionId_idx" ON "SubscriptionBillingPeriod"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPaymentTransaction_externalPaymentId_key" ON "SubscriptionPaymentTransaction"("externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPaymentTransaction_idempotencyKey_key" ON "SubscriptionPaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentTransaction_organizationId_idx" ON "SubscriptionPaymentTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentTransaction_subscriptionId_idx" ON "SubscriptionPaymentTransaction"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionWebhookEvent_status_receivedAt_idx" ON "SubscriptionWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionWebhookEvent_provider_externalEventId_key" ON "SubscriptionWebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "SubscriptionAuditEvent_organizationId_createdAt_idx" ON "SubscriptionAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionAuditEvent_subscriptionId_createdAt_idx" ON "SubscriptionAuditEvent"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionPlanPrice" ADD CONSTRAINT "SubscriptionPlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeatureLimit" ADD CONSTRAINT "PlanFeatureLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeatureLimit" ADD CONSTRAINT "PlanFeatureLimit_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SubscriptionFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "SubscriptionPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEntitlementOverride" ADD CONSTRAINT "OrganizationEntitlementOverride_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEntitlementOverride" ADD CONSTRAINT "OrganizationEntitlementOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEntitlementOverride" ADD CONSTRAINT "OrganizationEntitlementOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SubscriptionFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntitlementSnapshot" ADD CONSTRAINT "SubscriptionEntitlementSnapshot_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntitlementSnapshot" ADD CONSTRAINT "SubscriptionEntitlementSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntitlementSnapshot" ADD CONSTRAINT "SubscriptionEntitlementSnapshot_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "SubscriptionEntitlementSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionUsageCounter" ADD CONSTRAINT "SubscriptionUsageCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionBillingPeriod" ADD CONSTRAINT "SubscriptionBillingPeriod_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionBillingPeriod" ADD CONSTRAINT "SubscriptionBillingPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionBillingPeriod" ADD CONSTRAINT "SubscriptionBillingPeriod_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "SubscriptionPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentTransaction" ADD CONSTRAINT "SubscriptionPaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentTransaction" ADD CONSTRAINT "SubscriptionPaymentTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentTransaction" ADD CONSTRAINT "SubscriptionPaymentTransaction_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "SubscriptionBillingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAuditEvent" ADD CONSTRAINT "SubscriptionAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionAuditEvent" ADD CONSTRAINT "SubscriptionAuditEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial Unique Index: One current or blocking subscription per organization (includes SUSPENDED)
CREATE UNIQUE INDEX "OrgSub_one_current_per_org_idx"
ON "OrganizationSubscription"("organizationId")
WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED');

-- Partial Unique Index: One active price per plan/interval/currency variant
CREATE UNIQUE INDEX "PlanPrice_one_active_per_variant_idx"
ON "SubscriptionPlanPrice"("planId", "interval", "currency")
WHERE "isActive" = true;


