import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { UserRole, AccountStatus, OrgType, BusinessCategory, OrgStatus } from '@prisma/client';
import { ServiceUnavailableException, ForbiddenException } from '@nestjs/common';

describe('Phase 4 — Redis Production Safety & Fail-Closed Gating Suite', () => {
  let service: OrganizationsService;
  let prisma: any;
  let jwtService: any;
  let redisService: any;
  const originalEnv = process.env.NODE_ENV;

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
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
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

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('1. Production Fail-Closed Requirements', () => {
    it('1.1 should throw ServiceUnavailableException in production if Redis set fails on ticket initiate', async () => {
      process.env.NODE_ENV = 'production';

      prisma.user.findUnique.mockResolvedValue({
        id: 'prod-user-1',
        email: 'prod@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      // Redis is offline / throwing
      redisService.set.mockRejectedValue(new Error('Connection refused to redis:6379'));

      await expect(
        service.initiateBusinessOnboarding('prod-user-1'),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('1.2 should strictly prohibit in-memory fallback from silently activating in production', async () => {
      process.env.NODE_ENV = 'production';

      const userId = 'prod-attacker-1';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'attacker@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'offline-nonce-123',
      });

      // Redis getDel returns null (e.g. key missing or expired in Redis)
      redisService.getDel.mockResolvedValue(null);

      // Attempting to consume must throw ForbiddenException, NOT fall back to memory
      await expect(
        service.createOrganizationForUser(
          userId,
          { name: 'Prod Exploit Corp', onboardingToken: 'some.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('1.3 should throw ServiceUnavailableException in production if Redis getDel errors out', async () => {
      process.env.NODE_ENV = 'production';

      const userId = 'prod-user-2';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'user2@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'redis-error-nonce',
      });

      redisService.getDel.mockRejectedValue(new Error('Redis cluster connection lost'));

      await expect(
        service.createOrganizationForUser(
          userId,
          { name: 'Cluster Down Corp', onboardingToken: 'valid.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('2. Multi-Instance Atomic Nonce Consumption & Replay Prevention', () => {
    it('2.1 should atomically burn nonce via Redis getDel and succeed on first instance', async () => {
      const userId = 'prod-verified-user';
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
        nonce: 'shared-cluster-nonce-777',
      });

      // First call: Redis getDel returns the nonce and burns it
      redisService.getDel.mockResolvedValueOnce({ userId });

      const mockOrg = {
        id: 'org-created-1',
        name: 'Instance 1 Created Corp',
        type: OrgType.PROVIDER,
        businessCategory: BusinessCategory.RENTALS,
        status: OrgStatus.PENDING,
      };
      prisma.organization.create.mockResolvedValue(mockOrg);
      prisma.orgStaff.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await service.createOrganizationForUser(
        userId,
        { name: 'Instance 1 Created Corp', onboardingToken: 'instance1.token' },
        UserRole.STUDENT,
      );

      expect(result).toEqual(mockOrg);
      expect(redisService.getDel).toHaveBeenCalledWith('onboarding:nonce:shared-cluster-nonce-777');
    });

    it('2.2 should reject second concurrent/replay call on Instance 2 because nonce is already burned', async () => {
      const userId = 'prod-verified-user';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'verified@jesmond.com.au',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
        orgStaffRoles: [],
      });

      jwtService.verify.mockReturnValue({
        sub: userId,
        purpose: 'business_onboarding',
        nonce: 'shared-cluster-nonce-777',
      });

      // Second call to Redis on Instance 2: key has already been deleted by getDel
      redisService.getDel.mockResolvedValueOnce(null);

      await expect(
        service.createOrganizationForUser(
          userId,
          { name: 'Replay Attacker Corp', onboardingToken: 'replayed.token' },
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });
});
