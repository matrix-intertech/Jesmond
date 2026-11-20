import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaModule } from '../../src/modules/prisma/prisma.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { BusinessNameRequestsModule } from '../../src/modules/business-name-requests/business-name-requests.module';
import { BusinessNameRequestsService } from '../../src/modules/business-name-requests/business-name-requests.service';
import { AdminNameRequestsService } from '../../src/modules/business-name-requests/admin-name-requests.service';
import { ProviderSettingsService } from '../../src/modules/settings/provider-settings.service';
import {
  OrgType,
  UserRole,
  BusinessCategory,
  BusinessNameChangeStatus,
} from '@prisma/client';

describe('Business Name Change Workflow (E2E Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let businessService: BusinessNameRequestsService;
  let adminService: AdminNameRequestsService;
  let providerSettingsService: ProviderSettingsService;

  let testOrgId: string;
  let testUserId: string;
  let independentAdminId: string;
  let affiliatedAdminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, BusinessNameRequestsModule],
      providers: [ProviderSettingsService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    businessService = app.get<BusinessNameRequestsService>(BusinessNameRequestsService);
    adminService = app.get<AdminNameRequestsService>(AdminNameRequestsService);
    providerSettingsService = app.get<ProviderSettingsService>(ProviderSettingsService);

    // 1. Create Test Organization
    const org = await prisma.organization.create({
      data: {
        name: 'Original Test Bakery',
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.FOOD,
      },
    });
    testOrgId = org.id;

    // 2. Create Test Business User
    const businessUser = await prisma.user.create({
      data: {
        email: `bname_user_${Date.now()}@test.local`,
        password: 'hashedpassword',
        firstName: 'Bob',
        lastName: 'Baker',
        role: UserRole.ORG_STAFF,
        orgStaffRoles: {
          create: {
            organizationId: testOrgId,
            role: UserRole.ORG_STAFF,
          },
        },
      },
    });
    testUserId = businessUser.id;

    // 3. Create Affiliated Admin (Staff of the same organization)
    const affAdmin = await prisma.user.create({
      data: {
        email: `bname_aff_admin_${Date.now()}@test.local`,
        password: 'hashedpassword',
        firstName: 'Affiliated',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        orgStaffRoles: {
          create: {
            organizationId: testOrgId,
            role: UserRole.ADMIN,
          },
        },
      },
    });
    affiliatedAdminId = affAdmin.id;

    // 4. Create Independent Admin (Not associated with the organization)
    const indAdmin = await prisma.user.create({
      data: {
        email: `bname_ind_admin_${Date.now()}@test.local`,
        password: 'hashedpassword',
        firstName: 'Indy',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    independentAdminId = indAdmin.id;
  });

  afterAll(async () => {
    // Cleanup test records
    await prisma.businessNameChangeDocument.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.businessNameChangeRequest.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.auditLog.deleteMany({
      where: { resourceId: testOrgId },
    });
    await prisma.orgStaff.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [testUserId, affiliatedAdminId, independentAdminId] },
      },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });

    await app.close();
  });

  describe('1. Direct Organization Name Mutation Protection', () => {
    it('should NOT allow business user to change Organization.name directly via providerSettingsService', async () => {
      await providerSettingsService.updateBusinessProfile(testOrgId, {
        name: 'Hacked Name Bypass',
        timezone: 'Australia/Melbourne',
      });

      const orgAfter = await prisma.organization.findUnique({
        where: { id: testOrgId },
      });

      expect(orgAfter?.name).toBe('Original Test Bakery'); // Unchanged!
      expect(orgAfter?.timezone).toBe('Australia/Melbourne'); // Allowed field updated
    });
  });

  describe('2. Request Submission & Duplicate Protection', () => {
    it('should reject request if proposed name is identical to current approved name', async () => {
      await expect(
        businessService.submitRequest(testOrgId, testUserId, {
          proposedName: 'Original Test Bakery',
          reason: 'Same name testing',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully submit name change request', async () => {
      const req = await businessService.submitRequest(testOrgId, testUserId, {
        proposedName: 'Golden Crust Artisan Bakery',
        reason: 'Rebranding to premium artisan bakery brand',
      });

      expect(req.id).toBeDefined();
      expect(req.status).toBe(BusinessNameChangeStatus.SUBMITTED);
      expect(req.currentName).toBe('Original Test Bakery');
      expect(req.proposedName).toBe('Golden Crust Artisan Bakery');
    });

    it('should reject duplicate active request while existing request is SUBMITTED', async () => {
      await expect(
        businessService.submitRequest(testOrgId, testUserId, {
          proposedName: 'Another Bakery Name',
          reason: 'Duplicate test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Admin Queue & Review Progression', () => {
    it('should list submitted requests in admin queue', async () => {
      const queue = await adminService.getQueue({ status: BusinessNameChangeStatus.SUBMITTED });
      const found = queue.items.find((i) => i.organizationId === testOrgId);
      expect(found).toBeDefined();
      expect(found?.proposedName).toBe('Golden Crust Artisan Bakery');
    });

    it('should move request to UNDER_REVIEW', async () => {
      const active = await businessService.getCurrentRequest(testOrgId);
      expect(active).toBeDefined();

      const updated = await adminService.startReview(active!.id, independentAdminId);
      expect(updated.status).toBe(BusinessNameChangeStatus.UNDER_REVIEW);
    });
  });

  describe('4. Administrative Self-Approval Prohibition', () => {
    it('should reject approval attempt by an administrator affiliated with the organization', async () => {
      const active = await businessService.getCurrentRequest(testOrgId);
      expect(active).toBeDefined();

      await expect(
        adminService.approveRequest(active!.id, affiliatedAdminId, {
          reviewerNotes: 'Self approval attempt',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Verify organization name is STILL unchanged
      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.name).toBe('Original Test Bakery');
    });
  });

  describe('5. Transactional Approval', () => {
    it('should approve request and update Organization.name transactionally', async () => {
      const active = await businessService.getCurrentRequest(testOrgId);
      expect(active).toBeDefined();

      const approved = await adminService.approveRequest(active!.id, independentAdminId, {
        reviewerNotes: 'Verified against ASIC business name registry documentation.',
      });

      expect(approved.status).toBe(BusinessNameChangeStatus.APPROVED);
      expect(approved.reviewedByUserId).toBe(independentAdminId);
      expect(approved.reviewedAt).toBeDefined();

      // Organization.name must now be updated!
      const orgAfter = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(orgAfter?.name).toBe('Golden Crust Artisan Bakery');

      // Verify immutable audit log exists
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: testOrgId,
          action: 'organization.name_change_approved',
        },
      });
      expect(audit).toBeDefined();
      expect((audit?.changes as any)?.newName).toBe('Golden Crust Artisan Bakery');
    });

    it('should reject subsequent approval on an already finalized request', async () => {
      const history = await businessService.getRequestHistory(testOrgId);
      const approvedReq = history.find((h) => h.status === BusinessNameChangeStatus.APPROVED);

      await expect(
        adminService.approveRequest(approvedReq!.id, independentAdminId, {
          reviewerNotes: 'Attempting second approval',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Rejection Workflow & Re-submission', () => {
    let secondRequestId: string;

    it('should allow business to submit a new request after previous is finalized', async () => {
      const req = await businessService.submitRequest(testOrgId, testUserId, {
        proposedName: 'Bad Name Idea Pty',
        reason: 'Testing rejection workflow',
      });

      expect(req.status).toBe(BusinessNameChangeStatus.SUBMITTED);
      expect(req.currentName).toBe('Golden Crust Artisan Bakery');
      secondRequestId = req.id;
    });

    it('should fail rejection without mandatory reviewer notes', async () => {
      await expect(
        adminService.rejectRequest(secondRequestId, independentAdminId, {
          reviewerNotes: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject request with valid notes and leave Organization.name untouched', async () => {
      const rejected = await adminService.rejectRequest(secondRequestId, independentAdminId, {
        reviewerNotes: 'Contains Pty without appropriate proprietary limited company status.',
      });

      expect(rejected.status).toBe(BusinessNameChangeStatus.REJECTED);

      // Organization.name must remain unchanged!
      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.name).toBe('Golden Crust Artisan Bakery');

      // Audit log recorded
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: testOrgId,
          action: 'organization.name_change_rejected',
        },
      });
      expect(audit).toBeDefined();
    });
  });
});
