import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/services/auth.service';
import { UserRole, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async createEmployee(organizationId: string, requesterUserId: string, data: any) {
    const { email, firstName, lastName, role, branchId } = data;

    // Check if email is already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    // Verify branch belongs to organization
    if (branchId) {
      const branch = await this.prisma.retailBranch.findUnique({
        where: { id: branchId },
      });
      if (!branch || branch.organizationId !== organizationId) {
        throw new ForbiddenException('Invalid branch assignment');
      }
    }

    // Generate random secure password for the new employee
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName: lastName || firstName,
          role: UserRole.ORG_STAFF, // Map employee to ORG_STAFF globally
          accountStatus: AccountStatus.PENDING_VERIFICATION,
        },
      });

      // Enforce permission granting rules
      let finalRole: UserRole = UserRole.ORG_STAFF;
      let finalPermissions: string[] = [];

      if (role || (data.permissions && data.permissions.length > 0)) {
        const requesterStaff = await tx.orgStaff.findUnique({
          where: { userId_organizationId: { userId: requesterUserId, organizationId } }
        });

        if (!requesterStaff) throw new ForbiddenException('Requester not found');

        const hasAdminPower = requesterStaff.role === UserRole.ADMIN || Boolean(requesterStaff.permissions?.includes('*'));

        if (!hasAdminPower) {
          throw new ForbiddenException('Only ADMIN can create employees with specific roles or permissions');
        }

        finalRole = role === 'ADMIN' ? UserRole.ADMIN : UserRole.ORG_STAFF;
        finalPermissions = data.permissions || [];
      }

      const orgStaff = await tx.orgStaff.create({
        data: {
          userId: user.id,
          organizationId,
          retailBranchId: branchId || null,
          role: finalRole,
          permissions: finalPermissions,
        },
      });

      return { user, orgStaff };
    });

    // Trigger forgot password so they get an email to set their actual password
    try {
      await this.authService.forgotPassword({ email: email.toLowerCase() });
    } catch (error) {
      console.error('Failed to send welcome email to new employee:', error);
      // We don't fail the creation, but log the error
    }

    // Omit sensitive data
    const { password, ...userWithoutPassword } = result.user;
    return { ...userWithoutPassword, orgStaff: result.orgStaff };
  }

  async listEmployees(organizationId: string) {
    return this.prisma.orgStaff.findMany({
      where: { organizationId, user: { deletedAt: null } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            accountStatus: true,
          },
        },
        retailBranch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getEmployee(organizationId: string, employeeId: string) {
    const employee = await this.prisma.orgStaff.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            accountStatus: true,
          },
        },
        retailBranch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    return employee;
  }

  async updateEmployee(organizationId: string, requesterUserId: string, employeeId: string, data: any) {
    const employee = await this.getEmployee(organizationId, employeeId);

    const { branchId, role, accountStatus, permissions } = data;

    if (branchId) {
      const branch = await this.prisma.retailBranch.findUnique({
        where: { id: branchId },
      });
      if (!branch || branch.organizationId !== organizationId) {
        throw new ForbiddenException('Invalid branch assignment');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let finalRole = employee.role;
      let finalPermissions = employee.permissions;

      if (role !== undefined || permissions !== undefined) {
        if (employee.userId === requesterUserId) {
          throw new ForbiddenException('Cannot modify your own role or permissions');
        }

        const requesterStaff = await tx.orgStaff.findUnique({
          where: { userId_organizationId: { userId: requesterUserId, organizationId } }
        });

        const hasAdminPower = Boolean(
          requesterStaff && (requesterStaff.role === UserRole.ADMIN || requesterStaff.permissions?.includes('*'))
        );

        if (!hasAdminPower) {
          if (role !== undefined && role !== employee.role) {
            throw new ForbiddenException('Only ADMIN can modify employee roles');
          }
          if (permissions !== undefined) {
            const requesterPerms = requesterStaff?.permissions || [];
            const addedPerms = permissions.filter((p: string) => !employee.permissions.includes(p));
            const removedPerms = employee.permissions.filter((p: string) => !permissions.includes(p));
            const unauthorizedChanges = [...addedPerms, ...removedPerms].some((p: string) => !requesterPerms.includes(p));
            if (unauthorizedChanges) {
              throw new ForbiddenException('You can only manage permissions that you possess');
            }
          }
        }

        if (role !== undefined) finalRole = role;
        if (permissions !== undefined) finalPermissions = permissions;
      }

      // Update OrgStaff
      const updatedStaff = await tx.orgStaff.update({
        where: { id: employeeId },
        data: {
          retailBranchId: branchId !== undefined ? branchId : employee.retailBranchId,
          role: finalRole,
          permissions: finalPermissions,
        },
      });

      // Update User if needed (like accountStatus)
      if (accountStatus) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { accountStatus },
        });
      }

      return updatedStaff;
    });
  }

  async deactivateEmployee(organizationId: string, employeeId: string) {
    const employee = await this.getEmployee(organizationId, employeeId);

    // Deactivate User
    await this.prisma.user.update({
      where: { id: employee.userId },
      data: {
        accountStatus: AccountStatus.DEACTIVATED,
      },
    });

    return { success: true, message: 'Employee deactivated' };
  }
}
