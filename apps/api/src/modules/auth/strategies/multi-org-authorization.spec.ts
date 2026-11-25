import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../guards/roles.guard';
import { BusinessPortalGuard } from '../guards/business-portal.guard';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  UserRole,
  OrgType,
  BusinessCategory,
  AccountStatus,
} from '@prisma/client';
import { ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';

describe('Phase 4 — Multi-Organization Authorization & Boundary Isolation Suite', () => {
  let strategy: JwtStrategy;
  let rolesGuard: RolesGuard;
  let portalGuard: BusinessPortalGuard;
  let prisma: any;
  let reflector: Reflector;

  const mockOrgA = {
    id: 'org-accommodation-alpha',
    name: 'Alpha Student Accommodation',
    type: OrgType.PROVIDER,
    businessCategory: BusinessCategory.RENTALS,
    deletedAt: null,
  };

  const mockOrgB = {
    id: 'org-retail-beta',
    name: 'Beta Campus Store',
    type: OrgType.RETAIL,
    businessCategory: BusinessCategory.RETAIL,
    deletedAt: null,
  };

  const mockStaffMembershipA = {
    id: 'staff-alpha',
    userId: 'user-multi-org-owner',
    organizationId: mockOrgA.id,
    role: UserRole.ADMIN, // Owner in Org A
    permissions: ['*'],
    retailBranchId: null,
    createdAt: new Date('2024-01-10T00:00:00Z'), // Earlier
    deletedAt: null,
    organization: mockOrgA,
  };

  const mockStaffMembershipB = {
    id: 'staff-beta',
    userId: 'user-multi-org-owner',
    organizationId: mockOrgB.id,
    role: UserRole.ORG_STAFF, // Employee in Org B
    permissions: ['pos:scan', 'inventory:view'],
    retailBranchId: 'branch-register-1',
    createdAt: new Date('2024-06-20T00:00:00Z'), // Later
    deletedAt: null,
    organization: mockOrgB,
  };

  const createExecutionContext = (user: any, requiredRoles?: UserRole[]): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
      orgStaff: {
        findFirst: jest.fn(),
      },
    };

    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        BusinessPortalGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    portalGuard = module.get<BusinessPortalGuard>(BusinessPortalGuard);
  });

  describe('1. One User Belonging to Multiple Organizations', () => {
    it('1.1 should require explicit X-Organization-Id selection and reject missing header for multi-org users', async () => {
      const mockUser = {
        id: 'user-multi-org-owner',
        email: 'partner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [mockStaffMembershipA, mockStaffMembershipB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = { headers: {} };
      const payload = { sub: 'user-multi-org-owner' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('1.1b should automatically select active organization when user belongs to exactly one organization', async () => {
      const mockUser = {
        id: 'user-single-org',
        email: 'single@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [mockStaffMembershipA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const req = { headers: {} };
      const payload = { sub: 'user-single-org' };

      const result = await strategy.validate(req, payload);

      expect(result.organizationId).toBe(mockOrgA.id);
      expect(result.orgRole).toBe(UserRole.ADMIN);
      expect(result.permissions).toEqual(['*']);
      expect(result.orgType).toBe(OrgType.PROVIDER);
      expect(result.businessCategory).toBe(BusinessCategory.RENTALS);
    });

    it('1.2 should support different OrgStaff roles across those organizations via explicit X-Organization-Id', async () => {
      const mockUser = {
        id: 'user-multi-org-owner',
        email: 'partner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [mockStaffMembershipA, mockStaffMembershipB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Request Org B explicitly
      const req = { headers: { 'x-organization-id': mockOrgB.id } };
      const payload = { sub: 'user-multi-org-owner' };

      const result = await strategy.validate(req, payload);

      // Switched to Org B: role is ORG_STAFF with granular permissions, NOT ADMIN
      expect(result.organizationId).toBe(mockOrgB.id);
      expect(result.orgRole).toBe(UserRole.ORG_STAFF);
      expect(result.permissions).toEqual(['pos:scan', 'inventory:view']);
      expect(result.retailBranchId).toBe('branch-register-1');
      expect(result.orgType).toBe(OrgType.RETAIL);
      expect(result.businessCategory).toBe(BusinessCategory.RETAIL);
    });
  });

  describe('2. Access Isolation Between Organizations', () => {
    it('2.1 should reject attempt to access a foreign organization with 403 Forbidden', async () => {
      const mockUser = {
        id: 'user-multi-org-owner',
        email: 'partner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [mockStaffMembershipA, mockStaffMembershipB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Attempt to access an unauthorized third organization
      const req = { headers: { 'x-organization-id': 'unauthorized-foreign-org-999' } };
      const payload = { sub: 'user-multi-org-owner' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Membership Removal / Deactivation in One Organization', () => {
    it('3.1 should reject access to deactivated Org A while continuing to allow access to active Org B', async () => {
      const deactivatedStaffA = {
        ...mockStaffMembershipA,
        deletedAt: new Date('2026-11-01T00:00:00Z'), // Membership terminated
      };

      const mockUser = {
        id: 'user-multi-org-owner',
        email: 'partner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [deactivatedStaffA, mockStaffMembershipB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Attempt to access deactivated Org A -> Must reject
      const reqA = { headers: { 'x-organization-id': mockOrgA.id } };
      await expect(strategy.validate(reqA, { sub: 'user-multi-org-owner' })).rejects.toThrow(
        ForbiddenException,
      );

      // Access active Org B -> Must succeed cleanly
      const reqB = { headers: { 'x-organization-id': mockOrgB.id } };
      const resultB = await strategy.validate(reqB, { sub: 'user-multi-org-owner' });
      expect(resultB.organizationId).toBe(mockOrgB.id);
      expect(resultB.orgRole).toBe(UserRole.ORG_STAFF);
    });

    it('3.2 should ignore soft-deleted organizations during default primary selection', async () => {
      const softDeletedOrgA = {
        ...mockOrgA,
        deletedAt: new Date('2026-11-15T00:00:00Z'), // Org shut down
      };
      const staffA = {
        ...mockStaffMembershipA,
        organization: softDeletedOrgA,
      };

      const mockUser = {
        id: 'user-multi-org-owner',
        email: 'partner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [staffA, mockStaffMembershipB],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // No header passed: Org A is earlier, but its organization is deleted, so Org B is selected
      const result = await strategy.validate({ headers: {} }, { sub: 'user-multi-org-owner' });
      expect(result.organizationId).toBe(mockOrgB.id);
    });
  });

  describe('4. Student / Customer Functionality After Business Onboarding', () => {
    it('4.1 should allow ORG_STAFF user to access dual-role customer endpoints', () => {
      const user = {
        id: 'user-multi-org-owner',
        role: UserRole.ORG_STAFF,
      };

      // Mock endpoint with dual roles: STUDENT and ORG_STAFF (e.g. StudentActionsController)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT, UserRole.ORG_STAFF]);

      const context = createExecutionContext(user);
      const isAllowed = rolesGuard.canActivate(context);

      expect(isAllowed).toBe(true);
    });

    it('4.2 should maintain customer user ID across all personal interactions', async () => {
      const mockUser = {
        id: 'original-customer-uuid-1234',
        email: 'customer-turned-owner@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [mockStaffMembershipA],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate({ headers: {} }, { sub: 'original-customer-uuid-1234' });

      // Original user ID is strictly preserved for student enquiries, saved properties, and applications
      expect(result.id).toBe('original-customer-uuid-1234');
    });
  });

  describe('5. Platform Admin Privilege Escalation Prevention', () => {
    it('5.1 should REJECT onboarded business owner from platform ADMIN endpoints', () => {
      const businessOwnerUser = {
        id: 'user-multi-org-owner',
        role: UserRole.ORG_STAFF, // Global role
        orgRole: UserRole.ADMIN,  // Organization-scoped role
      };

      // Platform admin endpoint requiring global ADMIN or SUPER_ADMIN
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

      const context = createExecutionContext(businessOwnerUser);
      const isAllowed = rolesGuard.canActivate(context);

      // Strict rejection: org admin has NO platform admin privileges
      expect(isAllowed).toBe(false);
    });
  });
});
