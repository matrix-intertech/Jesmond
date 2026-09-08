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
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
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
      });
    });
  });

  describe('Multiple Organizations Without Header (Deterministic Fallback)', () => {
    it('should select earliest created organization as deterministic primary when no header is passed, regardless of array order', async () => {
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

      // Case 1: Array has Org B first
      const mockUserReversed = {
        id: 'user-multi',
        email: 'multi@example.com',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        orgStaffRoles: [orgB, orgA], // Org B is index 0
      };

      prisma.user.findUnique.mockResolvedValue(mockUserReversed);

      const req = { headers: {} };
      const payload = { sub: 'user-multi' };

      const result = await strategy.validate(req, payload);

      // Must deterministically pick Org A because its createdAt is earlier
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

      const req = { headers: { 'x-organization-id': 'org-unauthorized-target' } };
      const payload = { sub: 'user-1' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(ForbiddenException);
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
        organizationId: undefined,
        orgType: undefined,
        orgRole: undefined,
      });
    });
  });

  describe('Account Status & Session Validation', () => {
    it('should throw UnauthorizedException if user is SUSPENDED or DEACTIVATED', async () => {
      const suspendedUser = {
        id: 'user-suspended',
        email: 'suspended@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.SUSPENDED,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(strategy.validate({}, { sub: 'user-suspended' })).rejects.toThrow(UnauthorizedException);

      const deactivatedUser = {
        id: 'user-deactivated',
        email: 'deactivated@example.com',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.DEACTIVATED,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(deactivatedUser);

      await expect(strategy.validate({}, { sub: 'user-deactivated' })).rejects.toThrow(UnauthorizedException);
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

      await expect(strategy.validate({}, { sub: 'user-session', sessionId: 'session-revoked' })).rejects.toThrow(
        UnauthorizedException,
      );

      prisma.session.findUnique.mockResolvedValue({
        id: 'session-expired',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 100000),
      });

      await expect(strategy.validate({}, { sub: 'user-session', sessionId: 'session-expired' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
