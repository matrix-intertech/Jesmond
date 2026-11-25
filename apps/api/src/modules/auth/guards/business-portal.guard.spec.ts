import { Test, TestingModule } from '@nestjs/testing';
import { BusinessPortalGuard } from './business-portal.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('BusinessPortalGuard (Backend Business Authorization)', () => {
  let guard: BusinessPortalGuard;
  let prisma: any;

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    prisma = {
      orgStaff: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessPortalGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<BusinessPortalGuard>(BusinessPortalGuard);
  });

  it('should allow access to SUPER_ADMIN without checking organizations', async () => {
    const context = createMockContext({
      id: 'super-admin-1',
      role: UserRole.SUPER_ADMIN,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.orgStaff.findFirst).not.toHaveBeenCalled();
  });

  it('should allow access to ADMIN without checking organizations', async () => {
    const context = createMockContext({
      id: 'admin-1',
      role: UserRole.ADMIN,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.orgStaff.findFirst).not.toHaveBeenCalled();
  });

  it('should allow access if user already has verified organizationId and orgRole on request', async () => {
    const context = createMockContext({
      id: 'staff-user-1',
      role: UserRole.ORG_STAFF,
      organizationId: 'org-abc-123',
      orgRole: 'MANAGER',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.orgStaff.findFirst).not.toHaveBeenCalled();
  });

  it('should query DB and allow access if user has active OrgStaff record', async () => {
    const userObj: any = {
      id: 'staff-user-2',
      role: UserRole.ORG_STAFF,
    };
    const context = createMockContext(userObj);

    prisma.orgStaff.findFirst.mockResolvedValueOnce({
      id: 'membership-1',
      userId: 'staff-user-2',
      organizationId: 'org-hotel-77',
      role: 'OWNER',
      permissions: ['MANAGE_PROPERTIES'],
      retailBranchId: null,
      organization: {
        id: 'org-hotel-77',
        name: 'Jesmond Grand Hotel',
        deletedAt: null,
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.orgStaff.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'staff-user-2',
        deletedAt: null,
        organization: { deletedAt: null },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });
    // Verifies that context was hydrated
    expect(userObj.organizationId).toBe('org-hotel-77');
    expect(userObj.orgRole).toBe('OWNER');
  });

  it('should throw UnauthorizedException if req.user is missing', async () => {
    const context = createMockContext(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw ForbiddenException for pure customer/student with no business orgs', async () => {
    const context = createMockContext({
      id: 'student-99',
      role: UserRole.STUDENT,
    });

    prisma.orgStaff.findFirst.mockResolvedValueOnce(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user org staff is soft-deleted or organization missing', async () => {
    const context = createMockContext({
      id: 'ex-employee-1',
      role: UserRole.ORG_STAFF,
    });

    prisma.orgStaff.findFirst.mockResolvedValueOnce(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
