import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import {
  BusinessCategory,
  OrgStatus,
  OrgType,
  UserRole,
  AccountStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('OrganizationsService — Server-Verified Onboarding & Origin Spoofing Defense', () => {
  let service: OrganizationsService;
  let prisma: any;
  let jwtService: any;
  let redisService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
      },
      orgStaff: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    redisService = {
      set: jest.fn(),
      getDel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('1. initiateBusinessOnboarding (Server Verification & Eligibility Gate)', () => {
    it('1.1 should generate single-use signed onboardingToken for verified active customer', async () => {
      const userId = 'verified-student-1';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'student@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.sign.mockReturnValue('mock.server.onboarding.token');
      redisService.set.mockResolvedValue('OK');

      const result = await service.initiateBusinessOnboarding(userId);

      expect(result).toEqual({
        onboardingToken: 'mock.server.onboarding.token',
        expiresIn: 900,
      });

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^onboarding:nonce:/),
        { userId },
        900,
      );

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: userId,
          email: 'student@jesmond.com.au',
          purpose: 'business_onboarding',
          nonce: expect.any(String),
        }),
        { expiresIn: '15m' },
      );
    });

    it('1.2 should REJECT unverified user attempting to initiate onboarding', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'unverified-student',
        email: 'unverified@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        emailVerified: false,
        deletedAt: null,
        orgStaffRoles: [],
      });

      await expect(
        service.initiateBusinessOnboarding('unverified-student'),
      ).rejects.toThrow(ForbiddenException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('1.3 should REJECT suspended user attempting to initiate onboarding', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'suspended-user',
        email: 'suspended@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.SUSPENDED,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      await expect(
        service.initiateBusinessOnboarding('suspended-user'),
      ).rejects.toThrow(ForbiddenException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('1.4 should REJECT user who already owns an active organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-owner',
        email: 'owner@matrixstore.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [
          {
            organizationId: 'existing-org-1',
            organization: { id: 'existing-org-1', deletedAt: null },
            deletedAt: null,
          },
        ],
      });

      await expect(
        service.initiateBusinessOnboarding('existing-owner'),
      ).rejects.toThrow(ConflictException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('2. createOrganizationForUser (Token Verification, Single-Use & Role Isolation)', () => {
    it('2.1 should REJECT non-admin customer if onboardingToken is missing (Origin Spoofing Defense)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'spoofing-attacker',
        email: 'attacker@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      await expect(
        service.createOrganizationForUser(
          'spoofing-attacker',
          { name: 'Spoofed Corp' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
      expect(prisma.orgStaff.create).not.toHaveBeenCalled();
    });

    it('2.2 should REJECT if onboardingToken is invalid or expired', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-with-invalid-token',
        email: 'user@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.createOrganizationForUser(
          'user-with-invalid-token',
          { name: 'Expired Corp', onboardingToken: 'expired.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2.3 should REJECT if onboardingToken belongs to another user (token theft defense)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'victim-user-1',
        email: 'victim@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      // Token sub does not match calling user ID
      jwtService.verify.mockReturnValue({
        sub: 'other-user-999',
        purpose: 'business_onboarding',
        nonce: 'nonce-123',
      });

      await expect(
        service.createOrganizationForUser(
          'victim-user-1',
          { name: 'Stolen Token Corp', onboardingToken: 'stolen.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2.4 should REJECT if onboardingToken has already been consumed (Replay Attack Defense)', async () => {
      const userId = 'replay-user-1';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'replay@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'burned-nonce-xyz',
      });

      // Redis getDel returns null because the nonce was already burned on previous call
      redisService.getDel.mockResolvedValue(null);

      await expect(
        service.createOrganizationForUser(
          userId,
          { name: 'Replayed Request Corp', onboardingToken: 'replayed.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('2.5 should successfully create organization and atomically burn nonce when valid token is supplied', async () => {
      const userId = 'legit-verified-user';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'verified@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });
      prisma.orgStaff.findFirst.mockResolvedValue(null);

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'valid-nonce-abc',
      });

      // Redis atomically deletes and returns the stored nonce
      redisService.getDel.mockResolvedValue({ userId });

      const mockOrg = {
        id: 'org-created-legit',
        name: 'Legitimate Provider Corp',
        type: OrgType.PROVIDER,
        businessCategory: BusinessCategory.ACCOMMODATION,
        status: OrgStatus.PENDING,
      };
      prisma.organization.create.mockResolvedValue(mockOrg);
      prisma.orgStaff.create.mockResolvedValue({
        id: 'staff-created',
        userId,
        organizationId: mockOrg.id,
        role: UserRole.ADMIN,
        permissions: ['*'],
      });
      prisma.user.update.mockResolvedValue({
        id: userId,
        role: UserRole.ORG_STAFF,
      });

      const result = await service.createOrganizationForUser(
        userId,
        {
          name: 'Legitimate Provider Corp',
          type: OrgType.PROVIDER,
          businessCategory: BusinessCategory.ACCOMMODATION,
          onboardingToken: 'valid.onboarding.token',
        },
        UserRole.STUDENT,
      );

      expect(result).toEqual(mockOrg);
      expect(redisService.getDel).toHaveBeenCalledWith('onboarding:nonce:valid-nonce-abc');

      // Verify OrgStaff is created with ADMIN role and ['*'] strictly for the new organization
      expect(prisma.orgStaff.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: mockOrg.id,
          role: UserRole.ADMIN,
          permissions: ['*'],
        },
      });

      // Verify user's global role on User table is updated strictly to ORG_STAFF, NOT ADMIN
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: UserRole.ORG_STAFF },
      });
    });

    it('2.6 should allow platform admin to create organization directly without onboardingToken', async () => {
      const adminId = 'platform-admin-1';
      prisma.user.findUnique.mockResolvedValue({
        id: adminId,
        email: 'admin@jesmond.com.au',
        role: UserRole.ADMIN,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });
      prisma.orgStaff.findFirst.mockResolvedValue(null);

      const mockOrg = {
        id: 'admin-created-org',
        name: 'Admin Direct Agency',
        type: OrgType.PROVIDER,
        businessCategory: BusinessCategory.ACCOMMODATION,
        status: OrgStatus.PENDING,
      };
      prisma.organization.create.mockResolvedValue(mockOrg);
      prisma.orgStaff.create.mockResolvedValue({});

      const result = await service.createOrganizationForUser(
        adminId,
        { name: 'Admin Direct Agency' },
        UserRole.ADMIN,
      );

      expect(result).toEqual(mockOrg);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('2.7 should handle concurrent creation attempts safely via atomic transaction check', async () => {
      const userId = 'concurrent-legit-user';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'concurrent@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'concurrent-nonce-1',
      });
      redisService.getDel.mockResolvedValue({ userId });

      const existingOrg = {
        id: 'org-race-winner',
        name: 'Race Winner Corp',
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.RETAIL,
        status: OrgStatus.PENDING,
      };

      // Inside transaction, a concurrent thread already created the staff record
      prisma.orgStaff.findFirst.mockResolvedValue({
        id: 'staff-first-thread',
        userId,
        organizationId: existingOrg.id,
        organization: existingOrg,
      });

      const result = await service.createOrganizationForUser(
        userId,
        {
          name: 'Second Concurrent Thread',
          onboardingToken: 'concurrent.token',
        },
        UserRole.STUDENT,
      );

      expect(result).toEqual(existingOrg);
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });
});
