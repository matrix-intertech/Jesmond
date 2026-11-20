import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../properties/core/storage.service';
import { RequirementsEngineService } from './services/requirements-engine.service';
import { ReviewCredentialDto } from './dto/review-credential.dto';
import { ReviewAbnExemptionDto } from './dto/review-abn-exemption.dto';
import {
  CredentialStatus,
  BusinessVerificationStatus,
  VerificationMethod,
  AbnExemptionStatus,
  BusinessCategory,
  ActorType,
  UserRole,
} from '@prisma/client';

@Injectable()
export class AdminCredentialsService {
  private readonly logger = new Logger(AdminCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly requirementsEngine: RequirementsEngineService,
  ) {}

  private async validateReviewerEligibility(
    reviewerId: string,
    organizationId: string,
  ) {
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      include: { orgStaffRoles: true },
    });

    if (!reviewer) {
      throw new NotFoundException(`Reviewer user ${reviewerId} not found`);
    }

    if (
      reviewer.role !== UserRole.ADMIN &&
      reviewer.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Reviewer must hold an administrative role (ADMIN or SUPER_ADMIN).',
      );
    }

    // Prohibit self-approval: reviewer cannot approve credentials for their own organization
    const isAssociatedWithOrg = reviewer.orgStaffRoles.some(
      (staff) => staff.organizationId === organizationId,
    );

    if (isAssociatedWithOrg) {
      this.logger.warn(
        `Reviewer ${reviewerId} attempted self-approval for organization ${organizationId}`,
      );

      await this.prisma.auditLog.create({
        data: {
          actorId: reviewerId,
          actorType: ActorType.USER,
          action: 'credential.review_attempt_rejected',
          resourceType: 'Organization',
          resourceId: organizationId,
          changes: {
            reason:
              'Administrative self-approval prohibited: reviewer associated with target organization',
          },
        },
      });

      throw new ForbiddenException(
        'Administrative self-approval prohibited: reviewers cannot approve or reject credentials for an organization they are associated with.',
      );
    }
  }

  async getQueue(query: {
    status?: CredentialStatus;
    category?: BusinessCategory;
    state?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = {
        in: [
          CredentialStatus.PENDING,
          CredentialStatus.NEEDS_INFORMATION,
          CredentialStatus.UNABLE_TO_VERIFY,
        ],
      };
    }

    if (query.category) {
      where.organization = { businessCategory: query.category };
    }

    if (query.state) {
      where.state = query.state;
    }

    const [total, credentials] = await Promise.all([
      this.prisma.businessCredential.count({ where }),
      this.prisma.businessCredential.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              abn: true,
              businessCategory: true,
              type: true,
              RetailBranch: {
                select: { id: true, name: true, address: true },
                take: 1,
              },
            },
          },
          credentialType: true,
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      data: credentials.map((c) => ({
        id: c.id,
        organization: {
          id: c.organization.id,
          name: c.organization.name,
          abn: c.organization.abn,
          businessCategory: c.organization.businessCategory,
          branchAddress: c.organization.RetailBranch[0]?.address || null,
        },
        credentialType: {
          code: c.credentialType.code,
          name: c.credentialType.name,
          issuer: c.credentialType.issuer,
          jurisdiction: c.credentialType.jurisdiction,
        },
        credentialNumber: c.credentialNumber,
        holderName: c.holderName,
        issuingAuthority: c.issuingAuthority,
        state: c.state,
        status: c.status,
        submittedAt: c.submittedAt,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        documents: c.documents,
        reviewerNotes: c.reviewerNotes,
        internalNotes: c.internalNotes,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAbnExemptionQueue(query: { page?: number; limit?: number }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      abnExemptionStatus: AbnExemptionStatus.PENDING_REVIEW,
    };

    const [total, records] = await Promise.all([
      this.prisma.businessProfileCompletion.count({ where }),
      this.prisma.businessProfileCompletion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { abnExemptionRequestedAt: 'asc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              businessCategory: true,
              type: true,
              RetailBranch: {
                select: { id: true, address: true },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    return {
      data: records.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        organizationName: r.organization.name,
        businessCategory: r.organization.businessCategory,
        branchAddress: r.organization.RetailBranch[0]?.address || null,
        abnExemptionStatus: r.abnExemptionStatus,
        reason: r.abnExemptionReason,
        requestedAt: r.abnExemptionRequestedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async reviewAbnExemption(
    orgId: string,
    reviewerId: string,
    dto: ReviewAbnExemptionDto,
  ) {
    await this.validateReviewerEligibility(reviewerId, orgId);

    const completion = await this.prisma.businessProfileCompletion.findUnique({
      where: { organizationId: orgId },
    });

    if (!completion) {
      throw new NotFoundException(`Profile completion for org ${orgId} not found`);
    }

    const updated = await this.prisma.businessProfileCompletion.update({
      where: { organizationId: orgId },
      data: {
        abnExemptionStatus:
          dto.decision === 'APPROVED'
            ? AbnExemptionStatus.APPROVED
            : AbnExemptionStatus.REJECTED,
        abnExemptionReviewedAt: new Date(),
        abnExemptionReviewedBy: reviewerId,
        abnExemptionReviewNotes: dto.notes,
        abnExemptionInternalNotes: dto.internalNotes,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        actorType: ActorType.USER,
        action: 'abn_exemption.review',
        resourceType: 'Organization',
        resourceId: orgId,
        changes: {
          decision: dto.decision,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
        },
      },
    });

    // Authoritative overall status recalculation via requirements engine
    await this.requirementsEngine.recalculateOrganizationVerificationStatus(orgId);

    return updated;
  }

  async reviewCredential(
    credentialId: string,
    reviewerId: string,
    dto: ReviewCredentialDto,
  ) {
    const credential = await this.prisma.businessCredential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new NotFoundException(`BusinessCredential ${credentialId} not found`);
    }

    await this.validateReviewerEligibility(reviewerId, credential.organizationId);

    const newStatus = dto.decision as CredentialStatus;
    const isVerified = newStatus === CredentialStatus.VERIFIED;

    const updated = await this.prisma.businessCredential.update({
      where: { id: credentialId },
      data: {
        status: newStatus,
        verifiedAt: isVerified ? new Date() : null,
        verifiedByUserId: reviewerId,
        verificationMethod: VerificationMethod.MANUAL_ADMIN,
        reviewerNotes: dto.notes,
        internalNotes: dto.internalNotes,
        rejectionReason: newStatus === CredentialStatus.REJECTED ? dto.notes : null,
      },
    });

    // Authoritative overall status recalculation via requirements engine
    await this.requirementsEngine.recalculateOrganizationVerificationStatus(
      credential.organizationId,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        actorType: ActorType.USER,
        action: 'credential.review',
        resourceType: 'BusinessCredential',
        resourceId: credentialId,
        changes: {
          decision: dto.decision,
          previousStatus: credential.status,
          newStatus,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
        },
      },
    });

    return updated;
  }

  async getAdminSignedDocumentUrl(
    credentialId: string,
    documentId: string,
    adminUserId: string,
  ) {
    const document = await this.prisma.credentialDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException(`CredentialDocument ${documentId} not found`);
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(document.key, 900);

    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorType: ActorType.USER,
        action: 'credential.admin_document_view',
        resourceType: 'CredentialDocument',
        resourceId: documentId,
        changes: { credentialId, organizationId: document.organizationId },
      },
    });

    return {
      signedUrl,
      expiresIn: 900,
    };
  }
}
