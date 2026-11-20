import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaModule } from '../../src/modules/prisma/prisma.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { RedisService } from '../../src/modules/redis/redis.service';
import { CredentialsModule } from '../../src/modules/credentials/credentials.module';
import { BusinessCredentialsService } from '../../src/modules/credentials/business-credentials.service';
import { AdminCredentialsService } from '../../src/modules/credentials/admin-credentials.service';
import {
  BusinessCategory,
  OrgType,
  UserRole,
  CredentialStatus,
  BusinessVerificationStatus,
  AbnExemptionStatus,
  VerificationMethod,
} from '@prisma/client';

describe('Credentials & Verification API End-to-End', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let businessService: BusinessCredentialsService;
  let adminService: AdminCredentialsService;

  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, CredentialsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    businessService = app.get<BusinessCredentialsService>(
      BusinessCredentialsService,
    );
    adminService = app.get<AdminCredentialsService>(AdminCredentialsService);

    // Clean up any leftover test ABN from previous test runs
    await prisma.organization.updateMany({
      where: { abn: '51824753556' },
      data: { abn: null },
    });

    const suffix = Date.now().toString();

    // Create Org A (Mechanics in NSW)
    const orgA = await prisma.organization.create({
      data: {
        name: `E2E Mechanics NSW ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
        RetailBranch: {
          create: {
            name: 'Newcastle Workshop',
            address: '100 Business Way, Newcastle NSW 2300',
          },
        },
        profileCompletion: {
          create: {
            isCompleted: false,
            overallStatus: BusinessVerificationStatus.NOT_SUBMITTED,
          },
        },
      },
    });
    orgAId = orgA.id;

    // Create Org B (Retail in VIC)
    const orgB = await prisma.organization.create({
      data: {
        name: `E2E Retail VIC ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.RETAIL,
        RetailBranch: {
          create: {
            name: 'Melbourne Store',
            address: '50 Collins St, Melbourne VIC 3000',
          },
        },
        profileCompletion: {
          create: {
            isCompleted: false,
            overallStatus: BusinessVerificationStatus.NOT_SUBMITTED,
          },
        },
      },
    });
    orgBId = orgB.id;

    // Create test users
    const userA = await prisma.user.create({
      data: {
        email: `usera_${suffix}@test.com`,
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Manager',
        role: UserRole.ORG_STAFF,
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `userb_${suffix}@test.com`,
        password: 'Password123!',
        firstName: 'Bob',
        lastName: 'Retailer',
        role: UserRole.ORG_STAFF,
      },
    });
    userBId = userB.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin_${suffix}@test.com`,
        password: 'Password123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    // Cleanup test organizations and users
    await prisma.organization.updateMany({
      where: { abn: { in: ['51824753556', '53004085616'] } },
      data: { abn: null },
    });
    if (orgAId) await prisma.organization.delete({ where: { id: orgAId } }).catch(() => {});
    if (orgBId) await prisma.organization.delete({ where: { id: orgBId } }).catch(() => {});
    if (userAId) await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
    if (userBId) await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
    if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    const redisService = app.get(RedisService);
    if (redisService) await redisService.onModuleDestroy();
    await app.close();
    await prisma.$disconnect();
  });

  describe('1. Dynamic Requirements Resolution', () => {
    it('should resolve NSW_MVRL and ABN for Mechanics business in NSW', async () => {
      const requirements = await businessService.getRequirements(orgAId);
      expect(requirements.businessCategory).toBe(BusinessCategory.MECHANICS);
      expect(requirements.state).toBe('NSW');

      const codes = requirements.requirements.map((r) => r.credentialCode);
      expect(codes).toContain('ABN');
      expect(codes).toContain('NSW_MVRL');
      // VIC_LVT should not be present for NSW
      expect(codes).not.toContain('VIC_LVT');
    });

    it('should resolve ABN for general Retail business in VIC', async () => {
      const requirements = await businessService.getRequirements(orgBId);
      expect(requirements.businessCategory).toBe(BusinessCategory.RETAIL);
      expect(requirements.state).toBe('VIC');

      const codes = requirements.requirements.map((r) => r.credentialCode);
      expect(codes).toContain('ABN');
      // No MVRL or trade licence for retail
      expect(codes).not.toContain('NSW_MVRL');
    });
  });

  describe('2. ABN Verification & Organization.abn Deduplication', () => {
    it('should verify valid Modulus 89 ABN and store on Organization.abn directly', async () => {
      // 51 824 753 556 is valid Modulus 89
      const result = await businessService.verifyAbn(orgAId, {
        abn: '51 824 753 556',
      });

      expect(result.isValid).toBe(true);
      expect(result.abn).toBe('51824753556');

      // Verify that Organization.abn has been updated
      const updatedOrg = await prisma.organization.findUnique({
        where: { id: orgAId },
        select: { abn: true },
      });
      expect(updatedOrg?.abn).toBe('51824753556');

      // Verify BusinessCredential record
      const cred = await prisma.businessCredential.findFirst({
        where: {
          organizationId: orgAId,
          credentialType: { code: 'ABN' },
        },
      });
      expect(cred?.status).toBe(CredentialStatus.VERIFIED);
      expect(cred?.credentialNumber).toBe('51824753556');

      // Proves requirement: ABN verification alone MUST NOT mark the business as overall VERIFIED
      const completionA = await prisma.businessProfileCompletion.findUnique({
        where: { organizationId: orgAId },
      });
      expect(completionA?.overallStatus).toBe(BusinessVerificationStatus.PARTIALLY_VERIFIED);
      expect(completionA?.overallStatus).not.toBe(BusinessVerificationStatus.VERIFIED);
    });

    it('should reject invalid ABN checksums with BadRequestException', async () => {
      await expect(
        businessService.verifyAbn(orgAId, { abn: '12345678901' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should queue ABN for manual admin review when ENABLE_AUTOMATED_ABR is disabled', async () => {
      const originalEnv = process.env.ENABLE_AUTOMATED_ABR;
      try {
        process.env.ENABLE_AUTOMATED_ABR = 'false';

        const result = await businessService.verifyAbn(orgBId, {
          abn: '53 004 085 616',
        });

        // 1. Result indicates manual admin review is required
        expect(result.isValid).toBe(true);
        expect(result.verified).toBe(false);
        expect(result.manualReviewRequired).toBe(true);
        expect(result.status).toBe('Pending Admin Review');

        // 2. ABN stored on Organization.abn
        const orgBRecord = await prisma.organization.findUnique({
          where: { id: orgBId },
          select: { abn: true },
        });
        expect(orgBRecord?.abn).toBe('53004085616');

        // 3. Credential is created with PENDING status (NOT verified by checksum alone)
        const cred = await prisma.businessCredential.findFirst({
          where: {
            organizationId: orgBId,
            credentialType: { code: 'ABN' },
          },
        });
        expect(cred?.status).toBe(CredentialStatus.PENDING);
        expect(cred?.verificationMethod).toBeNull();

        // 4. Admin reviews and approves the ABN in the compliance queue
        const adminReview = await adminService.reviewCredential(cred!.id, adminUserId, {
          decision: 'VERIFIED',
          notes: 'Manually verified on official ABR public register abr.business.gov.au',
        });
        expect(adminReview.status).toBe(CredentialStatus.VERIFIED);
        expect(adminReview.verificationMethod).toBe(VerificationMethod.MANUAL_ADMIN);

        // 5. AuditLog tracks manual verification
        const log = await prisma.auditLog.findFirst({
          where: {
            resourceId: cred!.id,
            action: 'credential.review',
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(log).toBeDefined();
        expect(log?.actorId).toBe(adminUserId);
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENABLE_AUTOMATED_ABR = originalEnv;
        } else {
          delete process.env.ENABLE_AUTOMATED_ABR;
        }
      }
    });
  });

  describe('3. Controlled ABN Exemption Workflow', () => {
    it('should submit ABN exemption request and set status to PENDING_REVIEW', async () => {
      const res = await businessService.requestAbnExemption(orgBId, userBId, {
        reason: 'Operating under turnover threshold as an educational startup demonstration account.',
      });

      expect(res.abnExemptionStatus).toBe(AbnExemptionStatus.PENDING_REVIEW);

      const completion = await prisma.businessProfileCompletion.findUnique({
        where: { organizationId: orgBId },
      });
      expect(completion?.abnExemptionStatus).toBe(AbnExemptionStatus.PENDING_REVIEW);
      expect(completion?.abnExempt).toBe(true);
    });

    it('should list pending exemptions in the Admin queue', async () => {
      const queue = await adminService.getAbnExemptionQueue({ page: 1, limit: 10 });
      const found = queue.data.find((item) => item.organizationId === orgBId);
      expect(found).toBeDefined();
      expect(found?.abnExemptionStatus).toBe(AbnExemptionStatus.PENDING_REVIEW);
    });

    it('should allow Admin to approve ABN exemption with review notes', async () => {
      const review = await adminService.reviewAbnExemption(orgBId, adminUserId, {
        decision: 'APPROVED',
        notes: 'Approved under startup educational demonstration policy.',
      });

      expect(review.abnExemptionStatus).toBe(AbnExemptionStatus.APPROVED);
      expect(review.abnExemptionReviewedBy).toBe(adminUserId);

      // Verify that Requirements Engine now marks ABN requirement as satisfied
      const reqs = await businessService.getRequirements(orgBId);
      const abnReq = reqs.requirements.find((r) => r.credentialCode === 'ABN');
      expect(abnReq?.currentStatus).toBe(CredentialStatus.VERIFIED);
      expect(reqs.missingMandatoryCount).toBe(0);
    });
  });

  describe('4. Draft Saving, Document Upload & Security', () => {
    let mvrlCredentialId: string;
    let uploadedDocId: string;

    it('should save credential draft with licence number and expiry', async () => {
      const draft = await businessService.saveDraft(orgAId, 'NSW_MVRL', {
        credentialNumber: 'MVRL54321',
        holderName: 'Newcastle Mechanical Workshop Pty Ltd',
        issuingAuthority: 'NSW Fair Trading',
        state: 'NSW',
        expiresAt: '2027-11-20T00:00:00.000Z',
        isDraft: true,
      });

      expect(draft.credentialNumber).toBe('MVRL54321');
      expect(draft.isDraft).toBe(true);
      expect(draft.status).toBe(CredentialStatus.DRAFT);
      mvrlCredentialId = draft.id;
    });

    it('should reject document uploads with fake MIME types or wrong magic bytes', async () => {
      const fakeFile = {
        originalname: 'licence.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('NOT_A_REAL_PDF_HEADER'),
        size: 21,
      } as Express.Multer.File;

      await expect(
        businessService.uploadDocument(orgAId, mvrlCredentialId, userAId, fakeFile),
      ).rejects.toThrow(/magic bytes validation failed/i);
    });

    it('should upload valid PDF document to private storage', async () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n%test'),
        Buffer.alloc(100),
      ]);

      const validFile = {
        originalname: 'mvrl_card.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
      } as Express.Multer.File;

      const doc = await businessService.uploadDocument(
        orgAId,
        mvrlCredentialId,
        userAId,
        validFile,
      );

      expect(doc.id).toBeDefined();
      expect(doc.filename).toBe('mvrl_card.pdf');
      expect(doc.mimeType).toBe('application/pdf');
      uploadedDocId = doc.id;
    });

    it('should generate short-lived signed URL (15-min TTL) for authorized staff', async () => {
      const result = await businessService.getSignedDocumentUrl(
        orgAId,
        mvrlCredentialId,
        uploadedDocId,
        userAId,
      );

      expect(result.signedUrl).toBeDefined();
      expect(result.expiresIn).toBe(900); // 15 mins
    });

    it('should enforce multi-tenant isolation and reject unauthorized org document access', async () => {
      // User from Org B attempts to generate signed URL for Org A's document
      await expect(
        businessService.getSignedDocumentUrl(
          orgBId, // Wrong organization context
          mvrlCredentialId,
          uploadedDocId,
          userBId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Profile Completion Dismissal & Submit', () => {
    it('should persist 14-day dismissal at the organization level', async () => {
      const dismissal = await businessService.dismissCompletionReminder(orgAId);
      expect(dismissal.dismissedUntil).toBeDefined();
      expect(dismissal.dismissCount).toBe(1);

      const completion = await prisma.businessProfileCompletion.findUnique({
        where: { organizationId: orgAId },
      });
      const expectedMinDate = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
      expect(new Date(completion!.dismissedUntil!)).toBeInstanceOf(Date);
      expect(new Date(completion!.dismissedUntil!).getTime()).toBeGreaterThan(
        expectedMinDate.getTime(),
      );
    });

    it('should submit credentials and transition status to PENDING_REVIEW', async () => {
      const submitRes = await businessService.submitCredentials(orgAId, userAId);
      expect(submitRes.isCompleted).toBe(true);
      expect(submitRes.overallStatus).toBe(BusinessVerificationStatus.PENDING_REVIEW);
    });
  });

  describe('6. Admin Review Queue & Audit Logging', () => {
    it('should display submitted credential in Admin Queue', async () => {
      const queue = await adminService.getQueue({ status: CredentialStatus.PENDING });
      const found = queue.data.find((item) => item.organization.id === orgAId);
      expect(found).toBeDefined();
      expect(found?.credentialType.code).toBe('NSW_MVRL');
      expect(found?.documents.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow Admin to approve credential and log to AuditLog', async () => {
      const cred = await prisma.businessCredential.findFirst({
        where: {
          organizationId: orgAId,
          credentialType: { code: 'NSW_MVRL' },
        },
      });

      const reviewed = await adminService.reviewCredential(cred!.id, adminUserId, {
        decision: 'VERIFIED',
        notes: 'Verified against NSW Fair Trading public register.',
        internalNotes: 'Licence active until Nov 2027.',
      });

      expect(reviewed.status).toBe(CredentialStatus.VERIFIED);
      expect(reviewed.verifiedAt).toBeDefined();

      // Check overall organization verification status
      const completion = await prisma.businessProfileCompletion.findUnique({
        where: { organizationId: orgAId },
      });
      expect(completion?.overallStatus).toBe(BusinessVerificationStatus.VERIFIED);

      // Verify that action was recorded in AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'credential.review',
          resourceId: cred!.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe(adminUserId);
    });

    it('should reject review attempts when reviewer is associated with the organization (self-approval prevention)', async () => {
      // Create an internal staff role linking adminUserId to orgBId
      const orgStaff = await prisma.orgStaff.create({
        data: {
          userId: adminUserId,
          organizationId: orgBId,
          role: UserRole.ADMIN,
        },
      });

      // Org B ABN credential
      const abnType = await prisma.credentialType.findUnique({ where: { code: 'ABN' } });
      const credB = await prisma.businessCredential.upsert({
        where: {
          organizationId_credentialTypeId: {
            organizationId: orgBId,
            credentialTypeId: abnType!.id,
          },
        },
        update: { status: CredentialStatus.PENDING },
        create: {
          organizationId: orgBId,
          credentialTypeId: abnType!.id,
          status: CredentialStatus.PENDING,
        },
      });

      await expect(
        adminService.reviewCredential(credB.id, adminUserId, {
          decision: 'VERIFIED',
          notes: 'Attempting self-approval',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Clean up staff link
      await prisma.orgStaff.delete({ where: { id: orgStaff.id } });
    });
  });
});
