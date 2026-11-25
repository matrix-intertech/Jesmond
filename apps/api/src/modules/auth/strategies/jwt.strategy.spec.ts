import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserRole, OrgType, AccountStatus } from '@prisma/client';

describe('JwtStrategy - Multi-Organization Context & Tenant Isolation', () => {
  let strategy: JwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('Single Organization User', () => {
    it('should automatically resolve organization context when user has exactly one membership and no header', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'staff@org-a.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [
          {
            id: 'staff-1',
            organizationId: 'org-a',
            role: UserRole.ORG_STAFF,
            createdAt: new Date('2025-01-01'),
            organization: { id: 'org-a', type: OrgType.PROVIDER },
          },
        ],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = { headers: {} };
      const payload = { sub: 'user-1' };

      const result = await strategy.validate(req, payload);

      expect(result).toEqual({
        id: 'user-1',
        email: 'staff@org-a.com',
        role: UserRole.ORG_STAFF,
        organizationId: 'org-a',
        orgType: OrgType.PROVIDER,
        orgRole: UserRole.ORG_STAFF,
        permissions: [],
        retailBranchId: undefined,
      });
    });
  });

  describe('Multiple Organizations Without Header (Explicit Selection Required)', () => {
    it('should throw ForbiddenException when no X-Organization-Id header is passed for user with multiple active memberships', async () => {
      const orgA = {
        id: 'staff-1',
        organizationId: 'org-a',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'), // Earlier
        organization: { id: 'org-a', type: OrgType.PROVIDER },
      };
      const orgB = {
        id: 'staff-2',
        organizationId: 'org-b',
        role: UserRole.ADMIN,
        createdAt: new Date('2025-01-01'), // Later
        organization: { id: 'org-b', type: OrgType.RETAIL },
      };

      // User belongs to both Org A and Org B
      const mockUserMulti = {
        id: 'user-multi',
        email: 'multi@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgB, orgA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUserMulti);

      const req = { headers: {} };
      const payload = { sub: 'user-multi' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should automatically select active organization when user belongs to exactly one organization', async () => {
      const orgA = {
        id: 'staff-1',
        organizationId: 'org-a',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'),
        organization: { id: 'org-a', type: OrgType.PROVIDER },
      };

      const mockUserSingle = {
        id: 'user-single',
        email: 'single@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUserSingle);

      const req = { headers: {} };
      const payload = { sub: 'user-single' };

      const result = await strategy.validate(req, payload);

      expect(result.organizationId).toBe('org-a');
      expect(result.orgType).toBe(OrgType.PROVIDER);
      expect(result.orgRole).toBe(UserRole.ORG_STAFF);
    });
  });

  describe('Multiple Organizations With Valid X-Organization-Id Header', () => {
    it('should switch active organization context to Org B when requested via X-Organization-Id header', async () => {
      const orgA = {
        id: 'staff-1',
        organizationId: 'org-a',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'),
        organization: { id: 'org-a', type: OrgType.PROVIDER },
      };
      const orgB = {
        id: 'staff-2',
        organizationId: 'org-b',
        role: UserRole.ADMIN,
        createdAt: new Date('2025-01-01'),
        organization: { id: 'org-b', type: OrgType.RETAIL },
      };

      const mockUser = {
        id: 'user-multi',
        email: 'multi@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgA, orgB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = { headers: { 'x-organization-id': 'org-b' } };
      const payload = { sub: 'user-multi' };

      const result = await strategy.validate(req, payload);

      expect(result.organizationId).toBe('org-b');
      expect(result.orgType).toBe(OrgType.RETAIL);
      expect(result.orgRole).toBe(UserRole.ADMIN);
      expect(result.role).toBe(UserRole.ORG_STAFF); // Global role intact
    });

    it('should support header retrieval via req.header() or req.get() methods', async () => {
      const orgA = {
        id: 'staff-1',
        organizationId: 'org-a',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'),
        organization: { id: 'org-a', type: OrgType.PROVIDER },
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = {
        header: jest.fn().mockReturnValue('org-a'),
      };
      const payload = { sub: 'user-1' };

      const result = await strategy.validate(req, payload);
      expect(result.organizationId).toBe('org-a');
    });
  });

  describe('Multiple Organizations With Unauthorized Header', () => {
    it('should throw ForbiddenException if user requests an organization they are not a member of', async () => {
      const orgA = {
        id: 'staff-1',
        organizationId: 'org-a',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'),
        organization: { id: 'org-a', type: OrgType.PROVIDER },
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = {
        headers: { 'x-organization-id': 'org-unauthorized-target' },
      };
      const payload = { sub: 'user-1' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('No Organization Membership (e.g. Student)', () => {
    it('should leave organizationId, orgType, and orgRole undefined for non-org users', async () => {
      const mockStudent = {
        id: 'student-1',
        email: 'student@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(mockStudent);

      const req = { headers: {} };
      const payload = { sub: 'student-1' };

      const result = await strategy.validate(req, payload);

      expect(result).toEqual({
        id: 'student-1',
        email: 'student@example.com',
        role: UserRole.STUDENT,
        orgType: undefined,
        orgRole: undefined,
        organizationId: undefined,
        permissions: [],
        retailBranchId: undefined,
      });
    });
  });

  describe('Account Status & Session Validation', () => {
    it('should throw UnauthorizedException if user is deletedAt is set', async () => {
      const deletedUser = {
        id: 'user-deleted',
        email: 'deleted@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: new Date(),
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(deletedUser);

      await expect(
        strategy.validate({}, { sub: 'user-deleted' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should ignore soft-deleted organizations and revoked memberships', async () => {
      const deletedOrgStaff = {
        id: 'staff-deleted',
        organizationId: 'org-deleted',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-01-01'),
        deletedAt: new Date(),
        organization: { id: 'org-deleted', type: OrgType.PROVIDER },
      };
      const orgWithDeletedOrg = {
        id: 'staff-active-deleted-org',
        organizationId: 'org-soft-deleted',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-02-01'),
        organization: { id: 'org-soft-deleted', type: OrgType.PROVIDER, deletedAt: new Date() },
      };
      const activeOrgStaff = {
        id: 'staff-active',
        organizationId: 'org-active',
        role: UserRole.ORG_STAFF,
        createdAt: new Date('2024-03-01'),
        organization: { id: 'org-active', type: OrgType.RETAIL },
      };

      const mockUser = {
        id: 'user-mixed',
        email: 'mixed@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [deletedOrgStaff, orgWithDeletedOrg, activeOrgStaff],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate({}, { sub: 'user-mixed' });

      // Only activeOrgStaff should be selected; deleted staff and soft-deleted orgs are ignored
      expect(result.organizationId).toBe('org-active');
      expect(result.orgType).toBe(OrgType.RETAIL);
    });

    it('should throw UnauthorizedException if user is SUSPENDED or DEACTIVATED', async () => {
      const suspendedUser = {
        id: 'user-suspended',
        email: 'suspended@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.SUSPENDED,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(
        strategy.validate({}, { sub: 'user-suspended' }),
      ).rejects.toThrow(UnauthorizedException);

      const deactivatedUser = {
        id: 'user-deactivated',
        email: 'deactivated@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.DEACTIVATED,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(deactivatedUser);

      await expect(
        strategy.validate({}, { sub: 'user-deactivated' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session is revoked or expired', async () => {
      const mockUser = {
        id: 'user-session',
        email: 'session@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-revoked',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        strategy.validate(
          {},
          { sub: 'user-session', sessionId: 'session-revoked' },
        ),
      ).rejects.toThrow(UnauthorizedException);

      prisma.session.findUnique.mockResolvedValue({
        id: 'session-expired',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 100000),
      });

      await expect(
        strategy.validate(
          {},
          { sub: 'user-session', sessionId: 'session-expired' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate and attach sessionId to user when present', async () => {
      const mockUser = {
        id: 'user-valid-session',
        email: 'validsession@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-active-123',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });

      const result = await strategy.validate(
        {},
        { sub: 'user-valid-session', sessionId: 'session-active-123' },
      );

      expect(result.id).toBe('user-valid-session');
      expect(result.sessionId).toBe('session-active-123');
    });

    it('should preserve legacy JWT compatibility when sessionId is absent', async () => {
      const mockUser = {
        id: 'user-legacy',
        email: 'legacy@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(
        {},
        { sub: 'user-legacy' }, // No sessionId in legacy token
      );

      expect(result.id).toBe('user-legacy');
      expect(result.role).toBe(UserRole.STUDENT);
      expect(result.sessionId).toBeUndefined();
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('extractJwtFromCookie (Portal Isolation & Disambiguation)', () => {
    // Dynamic import of extractJwtFromCookie
    const { extractJwtFromCookie } = require('./jwt.strategy');

    it('should extract __Host-business-session when request is from business portal host', () => {
      const req = {
        headers: {
          host: 'business.jesmond.com.au',
          cookie: '__Host-business-session=biz.jwt.token; other=123',
        },
      };
      expect(extractJwtFromCookie(req)).toBe('biz.jwt.token');
    });

    it('should extract __Host-student-session when request is from student portal host', () => {
      const req = {
        headers: {
          host: 'jesmond.com.au',
          cookie: '__Host-student-session=student.jwt.token',
        },
      };
      expect(extractJwtFromCookie(req)).toBe('student.jwt.token');
    });

    it('should reject ambiguous conflicting cookies if host is untrusted or unapproved', () => {
      const req = {
        headers: {
          host: 'untrusted-proxy.attacker.com',
          cookie:
            '__Host-business-session=biz.jwt.token; __Host-student-session=student.jwt.token',
        },
      };
      // Must reject ambiguous differing cookies from untrusted host
      expect(extractJwtFromCookie(req)).toBeNull();
    });

    it('should resolve to business cookie when both are present but host is verified business portal', () => {
      const req = {
        headers: {
          host: 'business.jesmond.com.au',
          cookie:
            '__Host-business-session=biz.jwt.token; __Host-student-session=student.jwt.token',
        },
      };
      expect(extractJwtFromCookie(req)).toBe('biz.jwt.token');
    });

    it('should extract fallback jesmond_session cookie', () => {
      const req = {
        headers: {
          cookie: 'jesmond_session=fallback.jwt.token',
        },
      };
      expect(extractJwtFromCookie(req)).toBe('fallback.jwt.token');
    });
  });
});
