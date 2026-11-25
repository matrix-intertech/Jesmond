import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { RolesGuard } from './roles.guard';
import { BusinessPortalGuard } from './business-portal.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { UserRole, OrgType, BusinessCategory, AccountStatus } from '@prisma/client';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';

describe('Phase 4 — Dual-Role Authorization Matrix & Boundary Gating Suite', () => {
  let strategy: JwtStrategy;
  let rolesGuard: RolesGuard;
  let portalGuard: BusinessPortalGuard;
  let prisma: any;
  let reflector: Reflector;

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

  describe('1. Active ORG_STAFF User State', () => {
    it('1.1 should grant access to business portal and retain customer actions', async () => {
      const activeOrg = {
        id: 'org-hotel-1',
        name: 'Jesmond Hotel',
        type: OrgType.PROVIDER,
        businessCategory: BusinessCategory.RENTALS,
        deletedAt: null,
      };
      const activeStaff = {
        id: 'staff-1',
        userId: 'user-active-org-staff',
        organizationId: activeOrg.id,
        role: UserRole.ADMIN,
        permissions: ['*'],
        deletedAt: null,
        organization: activeOrg,
        createdAt: new Date(),
      };
      const user = {
        id: 'user-active-org-staff',
        email: 'host@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [activeStaff],
      };

      prisma.user.findUnique.mockResolvedValue(user);

      const validated = await strategy.validate({}, { sub: user.id });

      // Permitted on BusinessPortalGuard
      const portalContext = createExecutionContext(validated);
      expect(await portalGuard.canActivate(portalContext)).toBe(true);

      // Permitted on dual-role student endpoints (e.g. saving properties, applying)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT, UserRole.ORG_STAFF]);
      const customerContext = createExecutionContext(validated);
      expect(rolesGuard.canActivate(customerContext)).toBe(true);

      // Permitted on business operations
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ORG_STAFF]);
      const businessContext = createExecutionContext(validated);
      expect(rolesGuard.canActivate(businessContext)).toBe(true);
    });
  });

  describe('2. Suspended Organization State', () => {
    it('2.1 should reject access when organization is soft-deleted or suspended', async () => {
      const suspendedOrg = {
        id: 'org-suspended-1',
        name: 'Suspended Lodge',
        type: OrgType.PROVIDER,
        deletedAt: new Date(), // Soft-deleted / suspended
      };
      const staffRecord = {
        id: 'staff-susp',
        userId: 'user-susp-org',
        organizationId: suspendedOrg.id,
        role: UserRole.ORG_STAFF,
        deletedAt: null,
        organization: suspendedOrg,
        createdAt: new Date(),
      };
      const user = {
        id: 'user-susp-org',
        email: 'host@suspended.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [staffRecord],
      };

      prisma.user.findUnique.mockResolvedValue(user);

      // JwtStrategy filters out suspended organizations
      const validated = await strategy.validate({}, { sub: user.id });
      expect(validated.organizationId).toBeUndefined();

      // BusinessPortalGuard rejects
      prisma.orgStaff.findFirst.mockResolvedValue(null);
      const portalContext = createExecutionContext(validated);
      await expect(portalGuard.canActivate(portalContext)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Deactivated Membership State', () => {
    it('3.1 should reject access when OrgStaff record is terminated', async () => {
      const terminatedStaff = {
        id: 'staff-terminated',
        userId: 'user-ex-employee',
        organizationId: 'org-retail-1',
        role: UserRole.ORG_STAFF,
        deletedAt: new Date(), // Staff membership removed
        organization: { id: 'org-retail-1', deletedAt: null },
        createdAt: new Date(),
      };
      const user = {
        id: 'user-ex-employee',
        email: 'ex@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [terminatedStaff],
      };

      prisma.user.findUnique.mockResolvedValue(user);

      const validated = await strategy.validate({}, { sub: user.id });
      expect(validated.organizationId).toBeUndefined();

      prisma.orgStaff.findFirst.mockResolvedValue(null);
      const portalContext = createExecutionContext(validated);
      await expect(portalGuard.canActivate(portalContext)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Deactivated User Account State', () => {
    it('4.1 should throw UnauthorizedException on any request if accountStatus is DEACTIVATED or SUSPENDED', async () => {
      const deactivatedUser = {
        id: 'user-deactivated',
        email: 'deactivated@jesmond.com.au',
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.DEACTIVATED,
        deletedAt: null,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(deactivatedUser);

      await expect(
        strategy.validate({}, { sub: deactivatedUser.id }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('5. Ordinary STUDENT User State', () => {
    it('5.1 should permit student operations but strictly reject business portal access', async () => {
      const studentUser = {
        id: 'student-pure',
        email: 'purestudent@jesmond.demo',
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        orgStaffRoles: [],
      };

      prisma.user.findUnique.mockResolvedValue(studentUser);

      const validated = await strategy.validate({}, { sub: studentUser.id });

      // Permitted on customer student endpoints
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STUDENT, UserRole.ORG_STAFF]);
      const customerContext = createExecutionContext(validated);
      expect(rolesGuard.canActivate(customerContext)).toBe(true);

      // Rejected on business-only endpoints
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ORG_STAFF]);
      const businessContext = createExecutionContext(validated);
      expect(rolesGuard.canActivate(businessContext)).toBe(false);

      // Rejected on BusinessPortalGuard
      prisma.orgStaff.findFirst.mockResolvedValue(null);
      const portalContext = createExecutionContext(validated);
      await expect(portalGuard.canActivate(portalContext)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. Platform ADMIN & SUPER_ADMIN Restrictions', () => {
    it('6.1 should strictly block commercial business owners from platform administrative endpoints', () => {
      const businessOwner = {
        id: 'owner-not-superadmin',
        role: UserRole.ORG_STAFF, // Commercial owner
        orgRole: UserRole.ADMIN,  // Organization administrator
      };

      // Platform admin endpoint requiring global ADMIN or SUPER_ADMIN
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

      const context = createExecutionContext(businessOwner);
      const isAllowed = rolesGuard.canActivate(context);

      expect(isAllowed).toBe(false);
    });
  });
});
