import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { AccountStatus, OrgStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async getPendingProperties() {
    return this.prisma.property.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        organization: { select: { name: true, abn: true, status: true } },
        suburb: { select: { name: true, city: { select: { name: true } } } },
        media: { orderBy: { displayOrder: 'asc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getActiveProperties() {
    return this.prisma.property.findMany({
      where: { status: { in: ['PUBLISHED', 'UNLISTED'] } },
      include: {
        organization: { select: { name: true, abn: true, status: true } },
        suburb: { select: { name: true, city: { select: { name: true } } } },
        media: { orderBy: { displayOrder: 'asc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getPropertyDetails(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true, abn: true, status: true } },
        suburb: { select: { name: true, city: { select: { name: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: {
          include: {
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },
      }
    });

    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async approveProperty(id: string, adminId: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only PENDING_APPROVAL properties can be approved.');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'PUBLISHED' }
    });

    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'APPROVE', previousStatus: 'PENDING_APPROVAL', newStatus: 'PUBLISHED' },
        authorId: adminId,
      }
    });

    return updated;
  }

  async rejectProperty(id: string, adminId: string, reason?: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only PENDING_APPROVAL properties can be rejected.');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'DRAFT' }
    });

    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'REJECT', previousStatus: 'PENDING_APPROVAL', newStatus: 'DRAFT', reason },
        authorId: adminId,
      }
    });

    return updated;
  }

  async unpublishProperty(id: string, adminId: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== 'PUBLISHED') {
      throw new BadRequestException('Only PUBLISHED properties can be unpublished.');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'UNLISTED' }
    });

    await this.applicationsService.cancelPropertyApplications(id);

    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'UNPUBLISH', previousStatus: 'PUBLISHED', newStatus: 'UNLISTED' },
        authorId: adminId,
      }
    });

    return updated;
  }

  async republishProperty(id: string, adminId: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.status !== 'UNLISTED') {
      throw new BadRequestException('Only UNLISTED properties can be republished.');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'PUBLISHED' }
    });

    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'REPUBLISH', previousStatus: 'UNLISTED', newStatus: 'PUBLISHED' },
        authorId: adminId,
      }
    });

    return updated;
  }

  async updatePropertyVerificationStatus(propertyId: string, status: any, adminId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { organization: true }
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (!['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].includes(status)) {
      throw new BadRequestException('Invalid verification status');
    }

    const updatedProperty = await this.prisma.property.update({
      where: { id: propertyId },
      data: { verificationStatus: status }
    });

    return updatedProperty;
  }

  // ─── User Management ──────────────────────────────────────────────────────

  async getUsers(search?: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          accountStatus: true,
          createdAt: true,
          orgStaffRoles: {
            where: { deletedAt: null },
            select: {
              organization: {
                select: { id: true, name: true, type: true, status: true },
              },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = users.map((u) => {
      const orgStaff = u.orgStaffRoles?.[0];
      const org = orgStaff?.organization ?? null;
      let profileType: string = u.role;
      if (u.role === UserRole.ORG_STAFF && org) {
        const orgTypeMap: Record<string, string> = {
          PROVIDER: 'Host',
          RETAIL: 'Retailer',
          AGENCY: 'Agent',
          UNIVERSITY: 'University Staff',
        };
        profileType = orgTypeMap[org.type] ?? 'Staff';
      } else {
        const roleMap: Record<string, string> = {
          STUDENT: 'Student',
          PARENT: 'Parent',
          ADMIN: 'Admin',
          SUPER_ADMIN: 'Super Admin',
        };
        profileType = roleMap[u.role] ?? u.role;
      }
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        accountStatus: u.accountStatus,
        profileType,
        organization: org ? { id: org.id, name: org.name, type: org.type, status: org.status } : null,
        createdAt: u.createdAt,
      };
    });

    return {
      data: mapped,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async disableUser(targetUserId: string, adminId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        orgStaffRoles: {
          where: { deletedAt: null },
          include: { organization: true },
        },
      },
    });

    if (!target) throw new NotFoundException('User not found');

    // Prevent disabling other admins
    if (target.role === UserRole.ADMIN || target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot disable Admin or Super Admin accounts');
    }

    // Prevent self-disable
    if (target.id === adminId) {
      throw new ForbiddenException('Cannot disable your own account');
    }

    if (target.accountStatus === AccountStatus.DEACTIVATED) {
      throw new BadRequestException('User is already disabled');
    }

    return this.prisma.$transaction(async (tx) => {
      // Deactivate the user
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { accountStatus: AccountStatus.DEACTIVATED },
      });

      // For org staff (Hosts / Retailers): suspend the organization so it
      // disappears from all public queries that gate on status=VERIFIED.
      const orgStaff = target.orgStaffRoles?.[0];
      if (orgStaff?.organization && orgStaff.organization.status === OrgStatus.VERIFIED) {
        const orgType = orgStaff.organization.type;
        if (orgType === 'PROVIDER' || orgType === 'RETAIL') {
          await tx.organization.update({
            where: { id: orgStaff.organization.id },
            data: { status: OrgStatus.SUSPENDED },
          });
        }
      }

      return updatedUser;
    });
  }

  async enableUser(targetUserId: string, adminId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        orgStaffRoles: {
          where: { deletedAt: null },
          include: { organization: true },
        },
      },
    });

    if (!target) throw new NotFoundException('User not found');

    if (target.accountStatus !== AccountStatus.DEACTIVATED) {
      throw new BadRequestException('User is not currently disabled');
    }

    return this.prisma.$transaction(async (tx) => {
      // Reactivate the user
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { accountStatus: AccountStatus.ACTIVE },
      });

      // Restore org visibility: only if the org is currently SUSPENDED
      // (it may have been suspended for other reasons — only restore if we know
      //  we put it into SUSPENDED state, i.e., still SUSPENDED).
      const orgStaff = target.orgStaffRoles?.[0];
      if (orgStaff?.organization && orgStaff.organization.status === OrgStatus.SUSPENDED) {
        const orgType = orgStaff.organization.type;
        if (orgType === 'PROVIDER' || orgType === 'RETAIL') {
          await tx.organization.update({
            where: { id: orgStaff.organization.id },
            data: { status: OrgStatus.VERIFIED },
          });
        }
      }

      return updatedUser;
    });
  }
}
