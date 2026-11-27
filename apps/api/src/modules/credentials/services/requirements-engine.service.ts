import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionProvisioningService } from '../../subscriptions/services/subscription-provisioning.service';
import {
  BusinessCategory,
  CredentialStatus,
  AbnExemptionStatus,
  BusinessVerificationStatus,
} from '@prisma/client';

export interface ResolvedRequirement {
  requirementId: string;
  credentialTypeId: string;
  credentialCode: string;
  name: string;
  description?: string | null;
  issuer: string;
  jurisdiction: string;
  isMandatory: boolean;
  requiresDocument: boolean;
  requiresExpiryDate: boolean;
  requiresNumber: boolean;
  numberPattern?: string | null;
  isPublic: boolean;
  currentStatus: CredentialStatus;
  currentCredentialId?: string;
  credentialNumber?: string | null;
  holderName?: string | null;
  expiresAt?: Date | null;
  documentsCount: number;
  rejectionReason?: string | null;
  reviewerNotes?: string | null;
}

@Injectable()
export class RequirementsEngineService {
  private readonly logger = new Logger(RequirementsEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly subscriptionProvisioning?: SubscriptionProvisioningService,
  ) {}

  /**
   * Resolves the exact applicable requirements for an organization dynamically
   * based on Category + Selected Services + Branch State + ABN Exemption.
   */
  async resolveRequirementsForOrganization(
    organizationId: string,
  ): Promise<{
    organizationId: string;
    organizationName: string;
    businessCategory: BusinessCategory;
    state: string | null;
    branchAddress: string | null;
    selectedServices: string[];
    activeServices: string[];
    abn: string | null;
    abnStatus: string;
    abnExemptionStatus: AbnExemptionStatus;
    abnExemptionReason: string | null;
    overallStatus: BusinessVerificationStatus;
    dismissedUntil: string | null;
    requirements: ResolvedRequirement[];
    isCompleted: boolean;
    missingMandatoryCount: number;
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        RetailBranch: {
          select: { id: true, address: true },
          take: 1,
        },
        businessServices: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
        profileCompletion: true,
        credentials: {
          include: {
            credentialType: true,
            documents: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Extract state from branch address (e.g., "100 Business Way, Newcastle NSW 2299" -> "NSW")
    let branchState: string | null = null;
    const address = org.RetailBranch[0]?.address || '';
    const stateMatch = address.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i);
    if (stateMatch) {
      branchState = stateMatch[1].toUpperCase();
    }

    // Normalize active service slugs
    const activeServiceSlugs = org.businessServices.map((s) =>
      s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    );

    // Fetch master rules matching category and state
    const rules = await this.prisma.credentialRequirement.findMany({
      where: {
        businessCategory: org.businessCategory,
        OR: [
          { state: null },
          ...(branchState ? [{ state: branchState }] : []),
        ],
      },
      include: {
        credentialType: true,
      },
    });

    const completion = org.profileCompletion;
    const abnExemptionStatus =
      completion?.abnExemptionStatus || AbnExemptionStatus.NOT_REQUESTED;

    const credentialsMap = new Map(
      org.credentials.map((c) => [c.credentialTypeId, c]),
    );

    const resolvedRequirements: ResolvedRequirement[] = [];
    let missingMandatoryCount = 0;

    for (const rule of rules) {
      // Check service condition:
      // If serviceName is defined, the business must have an active service containing this slug keyword
      if (rule.serviceName) {
        const requiredSlugKeyword = rule.serviceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        const matchesService = activeServiceSlugs.some((slug) =>
          slug.includes(requiredSlugKeyword),
        );
        if (!matchesService) {
          continue; // Service not offered by this business; requirement is NOT_APPLICABLE
        }
      }

      const existingCred = credentialsMap.get(rule.credentialTypeId);
      let status: CredentialStatus =
        existingCred?.status || CredentialStatus.NOT_SUBMITTED;

      // Special handling for ABN requirement:
      if (rule.credentialType.code === 'ABN') {
        if (org.abn && org.abn.trim().length > 0) {
          status = existingCred?.status === CredentialStatus.VERIFIED
            ? CredentialStatus.VERIFIED
            : CredentialStatus.PENDING;
        } else if (abnExemptionStatus === AbnExemptionStatus.APPROVED) {
          status = CredentialStatus.VERIFIED;
        } else if (abnExemptionStatus === AbnExemptionStatus.PENDING_REVIEW) {
          status = CredentialStatus.PENDING;
        } else if (abnExemptionStatus === AbnExemptionStatus.REJECTED) {
          status = CredentialStatus.REJECTED;
        } else {
          status = CredentialStatus.NOT_SUBMITTED;
        }
      }

      const hasRequiredData =
        (!rule.credentialType.requiresNumber ||
          !!existingCred?.credentialNumber) &&
        (!rule.credentialType.requiresDocument ||
          (existingCred?.documents?.length || 0) > 0);

      const isSatisfied =
        status === CredentialStatus.VERIFIED ||
        status === CredentialStatus.PENDING ||
        (status === CredentialStatus.DRAFT && hasRequiredData);

      if (rule.isMandatory && !isSatisfied) {
        missingMandatoryCount++;
      }

      resolvedRequirements.push({
        requirementId: rule.id,
        credentialTypeId: rule.credentialType.id,
        credentialCode: rule.credentialType.code,
        name: rule.credentialType.name,
        description: rule.credentialType.description,
        issuer: rule.credentialType.issuer,
        jurisdiction: rule.credentialType.jurisdiction,
        isMandatory: rule.isMandatory,
        requiresDocument: rule.credentialType.requiresDocument,
        requiresExpiryDate: rule.credentialType.requiresExpiryDate,
        requiresNumber: rule.credentialType.requiresNumber,
        numberPattern: rule.credentialType.numberPattern,
        isPublic: rule.credentialType.isPublic,
        currentStatus: status,
        currentCredentialId: existingCred?.id,
        credentialNumber:
          rule.credentialType.code === 'ABN'
            ? org.abn
            : existingCred?.credentialNumber,
        holderName: existingCred?.holderName,
        expiresAt: existingCred?.expiresAt,
        documentsCount: existingCred?.documents?.length || 0,
        rejectionReason: existingCred?.rejectionReason,
        reviewerNotes: existingCred?.reviewerNotes,
      });
    }

    let abnStatus = 'NOT_PROVIDED';
    const abnCred = org.credentials.find(
      (c) => c.credentialType.code === 'ABN',
    );
    if (abnCred?.status === CredentialStatus.VERIFIED) {
      abnStatus = 'VERIFIED';
    } else if (abnExemptionStatus === AbnExemptionStatus.APPROVED) {
      abnStatus = 'EXEMPTION_APPROVED';
    } else if (abnExemptionStatus === AbnExemptionStatus.PENDING_REVIEW) {
      abnStatus = 'EXEMPTION_PENDING';
    } else if (abnCred?.status === CredentialStatus.PENDING) {
      abnStatus = 'PENDING_REVIEW';
    } else if (org.abn && org.abn.trim().length > 0) {
      abnStatus = 'PENDING_REVIEW';
    }

    return {
      organizationId,
      organizationName: org.name,
      businessCategory: org.businessCategory,
      state: branchState,
      branchAddress: org.RetailBranch[0]?.address || null,
      selectedServices: org.businessServices.map((s) => s.name),
      activeServices: activeServiceSlugs,
      abn: org.abn,
      abnStatus,
      abnExemptionStatus,
      abnExemptionReason: completion?.abnExemptionReason || null,
      overallStatus:
        completion?.overallStatus || BusinessVerificationStatus.NOT_SUBMITTED,
      isCompleted: completion?.isCompleted || false,
      dismissedUntil: completion?.dismissedUntil?.toISOString() || null,
      requirements: resolvedRequirements,
      missingMandatoryCount,
    };
  }

  /**
   * Recalculates the authoritative organization-level verification status
   * using all applicable statutory requirements resolved by the requirements engine.
   *
   * Rules:
   * 1. If any requirement is REJECTED or NEEDS_INFORMATION, or ABN exemption is REJECTED -> ACTION_REQUIRED.
   * 2. If every applicable mandatory requirement is VERIFIED (or approved ABN exemption) -> VERIFIED.
   * 3. If some requirements are VERIFIED or PENDING -> PARTIALLY_VERIFIED (or PENDING_REVIEW).
   * 4. Optional requirements never block overall verification.
   * 5. ABN verification alone never marks the organization VERIFIED if other mandatory requirements exist.
   */
  async recalculateOrganizationVerificationStatus(
    organizationId: string,
  ): Promise<BusinessVerificationStatus> {
    const resolution = await this.resolveRequirementsForOrganization(organizationId);
    const { requirements, abnExemptionStatus } = resolution;

    const hasRejected = requirements.some(
      (r) => r.currentStatus === CredentialStatus.REJECTED,
    );
    const hasNeedsInfo = requirements.some(
      (r) => r.currentStatus === CredentialStatus.NEEDS_INFORMATION,
    );
    const hasPendingReview = requirements.some(
      (r) => r.currentStatus === CredentialStatus.PENDING,
    );

    let overallStatus: BusinessVerificationStatus;

    if (
      hasRejected ||
      hasNeedsInfo ||
      abnExemptionStatus === AbnExemptionStatus.REJECTED
    ) {
      overallStatus = BusinessVerificationStatus.ACTION_REQUIRED;
    } else {
      const mandatoryReqs = requirements.filter((r) => r.isMandatory);

      const allMandatoryVerified =
        mandatoryReqs.length === 0
          ? requirements.length > 0 &&
            requirements.some((r) => r.currentStatus === CredentialStatus.VERIFIED)
          : mandatoryReqs.every(
              (r) => r.currentStatus === CredentialStatus.VERIFIED,
            );

      if (allMandatoryVerified) {
        overallStatus = BusinessVerificationStatus.VERIFIED;
      } else {
        const someVerified = requirements.some(
          (r) => r.currentStatus === CredentialStatus.VERIFIED,
        );
        if (someVerified) {
          overallStatus = BusinessVerificationStatus.PARTIALLY_VERIFIED;
        } else if (
          hasPendingReview ||
          abnExemptionStatus === AbnExemptionStatus.PENDING_REVIEW
        ) {
          overallStatus = BusinessVerificationStatus.PENDING_REVIEW;
        } else {
          overallStatus = BusinessVerificationStatus.NOT_SUBMITTED;
        }
      }
    }

    await this.prisma.businessProfileCompletion.upsert({
      where: { organizationId },
      update: { overallStatus },
      create: {
        organizationId,
        overallStatus,
        isCompleted: false,
      },
    });

    if (
      overallStatus === BusinessVerificationStatus.VERIFIED &&
      this.subscriptionProvisioning
    ) {
      try {
        await this.subscriptionProvisioning.provisionFreePlanForOrganization(
          organizationId,
          {
            reason: 'Organization verified via credentials requirements engine',
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Post-verification Free-plan provisioning failed safely for ${organizationId}: ${err?.message || err}`,
        );
      }
    }

    return overallStatus;
  }
}
