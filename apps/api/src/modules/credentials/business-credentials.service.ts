import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AbnLookupService } from './services/abn-lookup.service';
import { RequirementsEngineService } from './services/requirements-engine.service';
import { StorageService } from '../properties/core/storage.service';
import { VerifyAbnDto } from './dto/verify-abn.dto';
import { RequestAbnExemptionDto } from './dto/request-abn-exemption.dto';
import { SaveCredentialDraftDto } from './dto/save-credential-draft.dto';
import {
  CredentialStatus,
  BusinessVerificationStatus,
  VerificationMethod,
  AbnExemptionStatus,
  ActorType,
} from '@prisma/client';

@Injectable()
export class BusinessCredentialsService {
  private readonly logger = new Logger(BusinessCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly abnLookupService: AbnLookupService,
    private readonly requirementsEngine: RequirementsEngineService,
    private readonly storageService: StorageService,
  ) {}

  async getRequirements(orgId: string) {
    return this.requirementsEngine.resolveRequirementsForOrganization(orgId);
  }

  async verifyAbn(orgId: string, dto: VerifyAbnDto) {
    const cleanAbn = this.abnLookupService.cleanAbn(dto.abn);
    if (!this.abnLookupService.isValidAbnChecksum(cleanAbn)) {
      throw new BadRequestException(
        'Invalid Australian Business Number (failed Modulus 89 checksum validation)',
      );
    }

    const isAutomatedAbrEnabled =
      process.env.ENABLE_AUTOMATED_ABR !== 'false' &&
      (process.env.ENABLE_AUTOMATED_ABR === 'true' ||
        !!process.env.ABR_GUID ||
        process.env.NODE_ENV === 'test');

    if (isAutomatedAbrEnabled) {
      const abrResult = await this.abnLookupService.lookupAbn(dto.abn);
      if (
        !abrResult.isValid ||
        abrResult.status !== 'Active' ||
        abrResult.manualReviewRequired
      ) {
        throw new BadRequestException(
          `ABN is not listed as actively registered in the authoritative ABR registry. Status: ${abrResult.status}`,
        );
      }

      // Reuse existing Organization.abn without duplicate column
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { abn: abrResult.abn },
      });

      const abnType = await this.prisma.credentialType.findUnique({
        where: { code: 'ABN' },
      });

      if (abnType) {
        await this.prisma.businessCredential.upsert({
          where: {
            organizationId_credentialTypeId: {
              organizationId: orgId,
              credentialTypeId: abnType.id,
            },
          },
          update: {
            credentialNumber: abrResult.abn,
            holderName: abrResult.entityName,
            issuingAuthority: 'Australian Business Register',
            metadata: abrResult as any,
            status: CredentialStatus.VERIFIED,
            verifiedAt: new Date(),
            verificationMethod: VerificationMethod.AUTOMATED_ABR,
            isDraft: false,
          },
          create: {
            organizationId: orgId,
            credentialTypeId: abnType.id,
            credentialNumber: abrResult.abn,
            holderName: abrResult.entityName,
            issuingAuthority: 'Australian Business Register',
            metadata: abrResult as any,
            status: CredentialStatus.VERIFIED,
            verifiedAt: new Date(),
            verificationMethod: VerificationMethod.AUTOMATED_ABR,
            isDraft: false,
          },
        });
      }

      // Authoritative overall status recalculation via requirements engine
      await this.requirementsEngine.recalculateOrganizationVerificationStatus(orgId);

      return abrResult;
    }

    // Manual Admin Verification Mode (Staging / when automated ABR is disabled via configuration)
    // 1. Never mark ABN as verified automatically based on checksum or format validation alone
    // 2. Never use mock ABR responses
    // 3. Store the clean validated ABN on Organization.abn
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { abn: cleanAbn },
      select: { id: true, name: true },
    });

    const abnType = await this.prisma.credentialType.findUnique({
      where: { code: 'ABN' },
    });

    if (abnType) {
      await this.prisma.businessCredential.upsert({
        where: {
          organizationId_credentialTypeId: {
            organizationId: orgId,
            credentialTypeId: abnType.id,
          },
        },
        update: {
          credentialNumber: cleanAbn,
          holderName: org.name,
          issuingAuthority: 'Australian Business Register',
          status: CredentialStatus.PENDING,
          verificationMethod: null,
          isDraft: false,
          submittedAt: new Date(),
        },
        create: {
          organizationId: orgId,
          credentialTypeId: abnType.id,
          credentialNumber: cleanAbn,
          holderName: org.name,
          issuingAuthority: 'Australian Business Register',
          status: CredentialStatus.PENDING,
          verificationMethod: null,
          isDraft: false,
          submittedAt: new Date(),
        },
      });
    }

    // Recalculate status: ABN is now PENDING and submitted for admin review, NOT VERIFIED
    await this.requirementsEngine.recalculateOrganizationVerificationStatus(orgId);

    return {
      isValid: true,
      abn: cleanAbn,
      entityName: org.name,
      status: 'Pending Admin Review',
      gstRegistered: false,
      verified: false,
      manualReviewRequired: true,
      message: 'ABN recorded and submitted for manual administrator verification.',
    };
  }

  async requestAbnExemption(orgId: string, userId: string, dto: RequestAbnExemptionDto) {
    const completion = await this.prisma.businessProfileCompletion.upsert({
      where: { organizationId: orgId },
      update: {
        abnExempt: true,
        abnExemptionStatus: AbnExemptionStatus.PENDING_REVIEW,
        abnExemptionReason: dto.reason,
        abnExemptionRequestedAt: new Date(),
        abnExemptionReviewedAt: null,
        abnExemptionReviewedBy: null,
        abnExemptionReviewNotes: null,
      },
      create: {
        organizationId: orgId,
        abnExempt: true,
        abnExemptionStatus: AbnExemptionStatus.PENDING_REVIEW,
        abnExemptionReason: dto.reason,
        abnExemptionRequestedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'abn_exemption.request',
        resourceType: 'Organization',
        resourceId: orgId,
        changes: { reason: dto.reason },
      },
    });

    return {
      abnExemptionStatus: completion.abnExemptionStatus,
      reason: completion.abnExemptionReason,
      requestedAt: completion.abnExemptionRequestedAt,
    };
  }

  async getAllCredentials(orgId: string) {
    const [credentials, completion] = await Promise.all([
      this.prisma.businessCredential.findMany({
        where: { organizationId: orgId, deletedAt: null },
        include: {
          credentialType: true,
          documents: { where: { deletedAt: null } },
        },
      }),
      this.prisma.businessProfileCompletion.findUnique({
        where: { organizationId: orgId },
      }),
    ]);

    return {
      organizationId: orgId,
      overallStatus: completion?.overallStatus || BusinessVerificationStatus.NOT_SUBMITTED,
      isCompleted: completion?.isCompleted || false,
      currentStep: completion?.currentStep || 1,
      abnExemptionStatus: completion?.abnExemptionStatus || AbnExemptionStatus.NOT_REQUESTED,
      credentials: credentials.map((c) => ({
        id: c.id,
        code: c.credentialType.code,
        name: c.credentialType.name,
        credentialNumber: c.credentialNumber,
        holderName: c.holderName,
        issuingAuthority: c.issuingAuthority,
        state: c.state,
        status: c.status,
        isDraft: c.isDraft,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        verifiedAt: c.verifiedAt,
        reviewerNotes: c.reviewerNotes,
        rejectionReason: c.rejectionReason,
        documents: c.documents.map((d) => ({
          id: d.id,
          filename: d.filename,
          mimeType: d.mimeType,
          size: d.size,
          createdAt: d.createdAt,
        })),
      })),
    };
  }

  async saveDraft(orgId: string, credentialCode: string, dto: SaveCredentialDraftDto) {
    const credType = await this.prisma.credentialType.findUnique({
      where: { code: credentialCode },
    });

    if (!credType) {
      throw new NotFoundException(`CredentialType with code ${credentialCode} not found`);
    }

    const isDraft = dto.isDraft ?? true;

    return this.prisma.businessCredential.upsert({
      where: {
        organizationId_credentialTypeId: {
          organizationId: orgId,
          credentialTypeId: credType.id,
        },
      },
      update: {
        credentialNumber: dto.credentialNumber,
        holderName: dto.holderName,
        issuingAuthority: dto.issuingAuthority,
        state: dto.state,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isDraft,
        status: isDraft ? CredentialStatus.DRAFT : CredentialStatus.PENDING,
        submittedAt: isDraft ? undefined : new Date(),
      },
      create: {
        organizationId: orgId,
        credentialTypeId: credType.id,
        credentialNumber: dto.credentialNumber,
        holderName: dto.holderName,
        issuingAuthority: dto.issuingAuthority,
        state: dto.state,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isDraft,
        status: isDraft ? CredentialStatus.DRAFT : CredentialStatus.PENDING,
        submittedAt: isDraft ? undefined : new Date(),
      },
    });
  }

  async uploadDocument(
    orgId: string,
    credentialId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const credential = await this.prisma.businessCredential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new NotFoundException(`BusinessCredential ${credentialId} not found`);
    }

    if (credential.organizationId !== orgId) {
      throw new ForbiddenException('Cannot upload documents for another organization');
    }

    const upload = await this.storageService.uploadCredentialDocument(orgId, credentialId, file);

    const doc = await this.prisma.credentialDocument.create({
      data: {
        credentialId,
        organizationId: orgId,
        key: upload.key,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        uploadedByUserId: userId,
      },
    });

    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      createdAt: doc.createdAt,
    };
  }

  async getSignedDocumentUrl(
    orgId: string,
    credentialId: string,
    documentId: string,
    userId: string,
  ) {
    const document = await this.prisma.credentialDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException(`CredentialDocument ${documentId} not found`);
    }

    if (document.credentialId !== credentialId || document.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to requested credential document');
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(document.key, 900);

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'credential.document_view',
        resourceType: 'CredentialDocument',
        resourceId: documentId,
        changes: { organizationId: orgId },
      },
    });

    return {
      signedUrl,
      expiresIn: 900,
    };
  }

  async submitCredentials(orgId: string, userId: string) {
    const resolved = await this.requirementsEngine.resolveRequirementsForOrganization(orgId);

    if (resolved.missingMandatoryCount > 0) {
      const missingList = resolved.requirements
        .filter(
          (r) =>
            r.isMandatory &&
            r.currentStatus !== CredentialStatus.VERIFIED &&
            r.currentStatus !== CredentialStatus.PENDING,
        )
        .map((r) => r.name);

      throw new BadRequestException(
        `Cannot submit verification. Missing mandatory requirements: ${missingList.join(', ')}`,
      );
    }

    // Transition all drafts to PENDING
    await this.prisma.businessCredential.updateMany({
      where: {
        organizationId: orgId,
        isDraft: true,
      },
      data: {
        isDraft: false,
        status: CredentialStatus.PENDING,
        submittedAt: new Date(),
      },
    });

    const completion = await this.prisma.businessProfileCompletion.upsert({
      where: { organizationId: orgId },
      update: {
        isCompleted: true,
        completedAt: new Date(),
        overallStatus: BusinessVerificationStatus.PENDING_REVIEW,
      },
      create: {
        organizationId: orgId,
        isCompleted: true,
        completedAt: new Date(),
        overallStatus: BusinessVerificationStatus.PENDING_REVIEW,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'credential.submit_batch',
        resourceType: 'Organization',
        resourceId: orgId,
        changes: { status: 'PENDING_REVIEW' },
      },
    });

    return {
      isCompleted: completion.isCompleted,
      overallStatus: completion.overallStatus,
      completedAt: completion.completedAt,
    };
  }

  async dismissCompletionReminder(orgId: string) {
    const dismissedUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 Days

    const completion = await this.prisma.businessProfileCompletion.upsert({
      where: { organizationId: orgId },
      update: {
        dismissedUntil,
        lastPromptedAt: new Date(),
        dismissCount: { increment: 1 },
      },
      create: {
        organizationId: orgId,
        dismissedUntil,
        lastPromptedAt: new Date(),
        dismissCount: 1,
      },
    });

    return {
      dismissedUntil: completion.dismissedUntil,
      dismissCount: completion.dismissCount,
    };
  }
}
