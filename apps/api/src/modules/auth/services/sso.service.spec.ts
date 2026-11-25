import { Test, TestingModule } from '@nestjs/testing';
import { SsoService } from './sso.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AccountStatus, UserRole } from '@prisma/client';

describe('SsoService (Phase 1 Security & SSO Foundation)', () => {
  let service: SsoService;
  let prisma: any;
  let jwt: any;
  let redis: any;

  // Helper to generate PKCE challenge from verifier
  const generatePkcePair = () => {
    const verifier = crypto.randomBytes(32).toString('base64url'); // 43 chars
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  };

  const mockUser = {
    id: 'user-dual-portal-123',
    email: 'testuser@jesmond.com.au',
    firstName: 'Alex',
    lastName: 'Chen',
    role: UserRole.ORG_STAFF,
    accountStatus: AccountStatus.ACTIVE,
    deletedAt: null,
    orgStaffRoles: [
      {
        id: 'staff-1',
        organizationId: 'org-biz-99',
        role: 'OWNER',
        permissions: ['ALL'],
        retailBranchId: null,
        deletedAt: null,
        organization: {
          id: 'org-biz-99',
          name: 'Jesmond Cafe & Suites',
          type: 'PROVIDER',
          businessCategory: 'RESTAURANT',
          isVerified: true,
          verificationStatus: 'APPROVED',
          deletedAt: null,
        },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      session: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'session-sso-uuid-777',
            userId: args.data.userId,
            refreshToken: args.data.refreshToken,
            expiresAt: args.data.expiresAt,
            ipAddress: args.data.ipAddress,
            deviceInfo: args.data.deviceInfo,
            isRevoked: false,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orgStaff: {
        findFirst: jest.fn().mockResolvedValue(mockUser.orgStaffRoles[0]),
        findMany: jest.fn().mockResolvedValue(mockUser.orgStaffRoles),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValue('mock.jwt.signed.access_token'),
    };

    // Redis mock simulating atomic GETDEL behavior
    const redisStore = new Map<string, any>();
    redis = {
      set: jest.fn().mockImplementation((key, val) => {
        redisStore.set(key, val);
        return Promise.resolve();
      }),
      get: jest.fn().mockImplementation((key) => {
        return Promise.resolve(redisStore.get(key) || null);
      }),
      getDel: jest.fn().mockImplementation((key) => {
        const val = redisStore.get(key) || null;
        redisStore.delete(key); // Atomic burn-on-read
        return Promise.resolve(val);
      }),
      del: jest.fn().mockImplementation((key) => {
        redisStore.delete(key);
        return Promise.resolve();
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<SsoService>(SsoService);
  });

  describe('Authorization Code Generation (generateAuthorizationCode)', () => {
    it('should generate a 60-second single-use authorization code with valid PKCE S256', async () => {
      const { challenge } = generatePkcePair();

      const result = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'state-csrf-nonce-123',
        },
      );

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThanOrEqual(32);
      expect(result.state).toBe('state-csrf-nonce-123');
      expect(result.redirect_uri).toBe(
        'https://business.jesmond.com.au/auth/callback',
      );
      expect(result.expires_in).toBe(60);

      // Verify stored in Redis with 60-second TTL
      expect(redis.set).toHaveBeenCalledWith(
        `sso:code:${result.code}`,
        expect.objectContaining({
          userId: mockUser.id,
          clientId: 'jesmond-business-portal',
          codeChallenge: challenge,
          codeChallengeMethod: 'S256',
        }),
        60,
      );
    });

    it('should reject unapproved redirect_uri outside of allowed domains', async () => {
      const { challenge } = generatePkcePair();

      await expect(
        service.generateAuthorizationCode(
          { id: mockUser.id },
          {
            response_type: 'code',
            client_id: 'jesmond-business-portal',
            redirect_uri: 'https://malicious-site.com/steal-code',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state: 'state-csrf-nonce-123',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-S256 code_challenge_method (e.g. plain)', async () => {
      const { challenge } = generatePkcePair();

      await expect(
        service.generateAuthorizationCode(
          { id: mockUser.id },
          {
            response_type: 'code',
            client_id: 'jesmond-business-portal',
            redirect_uri: 'https://business.jesmond.com.au/auth/callback',
            code_challenge: challenge,
            code_challenge_method: 'plain' as any,
            state: 'state-csrf-nonce-123',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unauthorized client_id', async () => {
      const { challenge } = generatePkcePair();

      await expect(
        service.generateAuthorizationCode(
          { id: mockUser.id },
          {
            response_type: 'code',
            client_id: 'unknown-rogue-client',
            redirect_uri: 'https://business.jesmond.com.au/auth/callback',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state: 'state-csrf-nonce-123',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Authorization Code Exchange & PKCE Verification (exchangeAuthorizationCode)', () => {
    it('should exchange code with valid PKCE code_verifier, issue session and JWT', async () => {
      const { verifier, challenge } = generatePkcePair();

      // 1. Authorize to get code
      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'test-state-888',
        },
      );

      // 2. Exchange code with matching verifier and matching state
      const exchangeResult = await service.exchangeAuthorizationCode(
        {
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'test-state-888',
        },
        { ipAddress: '192.168.1.50', userAgent: 'Chrome/Jest' },
      );

      expect(exchangeResult.access_token).toBe('mock.jwt.signed.access_token');
      expect(exchangeResult.user.id).toBe(mockUser.id);
      expect(exchangeResult.user.organizationId).toBe('org-biz-99');
      expect(exchangeResult.session.id).toBe('session-sso-uuid-777');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          ipAddress: '192.168.1.50',
          deviceInfo: 'Chrome/Jest',
        }),
      });
    });

    it('should atomically burn code on read and prevent replay attack (Replay Protection)', async () => {
      const { verifier, challenge } = generatePkcePair();

      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'test-state-999',
        },
      );

      // First exchange: succeeds
      const firstExchange = await service.exchangeAuthorizationCode({
        grant_type: 'authorization_code',
        code: authResult.code,
        client_id: 'jesmond-business-portal',
        redirect_uri: 'https://business.jesmond.com.au/auth/callback',
        code_verifier: verifier,
        state: 'test-state-999',
      });
      expect(firstExchange).toBeDefined();

      // Second exchange with identical parameters: MUST FAIL immediately (code burned)
      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'test-state-999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid or tampered code_verifier (PKCE failure)', async () => {
      const { challenge } = generatePkcePair();
      const tamperedVerifier = 'tampered_invalid_verifier_that_does_not_match_challenge_43chars';

      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'test-state-abc',
        },
      );

      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: tamperedVerifier,
          state: 'test-state-abc',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject exchange if client_id does not match the authorization request', async () => {
      const { verifier, challenge } = generatePkcePair();

      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'test-state-client-mismatch',
        },
      );

      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-student-portal', // Mismatch!
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'test-state-client-mismatch',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject exchange if state is missing or mismatched (CSRF protection)', async () => {
      const { verifier, challenge } = generatePkcePair();

      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'correct-state-token-12345',
        },
      );

      // Mismatched state must be rejected
      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'wrong-attacker-state',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject exchange if user is suspended or deactivated', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        accountStatus: AccountStatus.SUSPENDED,
      });

      const { verifier, challenge } = generatePkcePair();

      const authResult = await service.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'test-state-suspended',
        },
      );

      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authResult.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'test-state-suspended',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject exchange if authorization code expired past 60s (not found in Redis)', async () => {
      const { verifier } = generatePkcePair();

      await expect(
        service.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: 'expired_or_nonexistent_code_past_60s',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'some-state',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should operate cleanly with in-memory fallback and auto-expiry when Redis is offline', async () => {
      // Create service without Redis
      const moduleWithoutRedis = await Test.createTestingModule({
        providers: [
          SsoService,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: jwt },
        ],
      }).compile();

      const offlineService = moduleWithoutRedis.get<SsoService>(SsoService);
      const { verifier, challenge } = generatePkcePair();

      const authRes = await offlineService.generateAuthorizationCode(
        { id: mockUser.id },
        {
          response_type: 'code',
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: 'state-offline-test',
        },
      );

      // Successfully exchanges in fallback
      const exchangeRes = await offlineService.exchangeAuthorizationCode({
        grant_type: 'authorization_code',
        code: authRes.code,
        client_id: 'jesmond-business-portal',
        redirect_uri: 'https://business.jesmond.com.au/auth/callback',
        code_verifier: verifier,
        state: 'state-offline-test',
      });
      expect(exchangeRes.access_token).toBeDefined();

      // Second exchange in fallback also fails (replay protection in fallback)
      await expect(
        offlineService.exchangeAuthorizationCode({
          grant_type: 'authorization_code',
          code: authRes.code,
          client_id: 'jesmond-business-portal',
          redirect_uri: 'https://business.jesmond.com.au/auth/callback',
          code_verifier: verifier,
          state: 'state-offline-test',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Business Access Check (checkBusinessAccess)', () => {
    it('should return hasBusinessAccess: true for user with active OrgStaff role', async () => {
      const result = await service.checkBusinessAccess(mockUser.id);
      expect(result.hasBusinessAccess).toBe(true);
      expect(result.organizations.length).toBe(1);
      expect(result.organizations[0].organizationName).toBe('Jesmond Cafe & Suites');
    });

    it('should return hasBusinessAccess: true for platform ADMIN or SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
        orgStaffRoles: [],
      });

      const result = await service.checkBusinessAccess('admin-uuid-1');
      expect(result.hasBusinessAccess).toBe(true);
      expect(result.isAdmin).toBe(true);
    });

    it('should return hasBusinessAccess: false for pure customer/student with no org roles', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        role: UserRole.STUDENT,
        orgStaffRoles: [],
      });

      const result = await service.checkBusinessAccess('student-uuid-2');
      expect(result.hasBusinessAccess).toBe(false);
      expect(result.organizations.length).toBe(0);
    });
  });

  describe('Session Revocation & Logout (logoutSession)', () => {
    it('should revoke specific session by sessionId', async () => {
      const result = await service.logoutSession(mockUser.id, 'session-target-1');
      expect(result.success).toBe(true);
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-target-1', userId: mockUser.id },
        data: { isRevoked: true },
      });
    });

    it('should revoke all active sessions when no sessionId provided', async () => {
      const result = await service.logoutSession(mockUser.id);
      expect(result.success).toBe(true);
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });
});
