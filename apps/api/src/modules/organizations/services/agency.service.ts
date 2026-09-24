import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AccountStatus, OrgType, PropertyPermission } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AgencyService {
  constructor(private prisma: PrismaService) {}

  async getMyAgency(organizationId: string) {
    const agency = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        staff: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } }
        },
        properties: {
          where: { deletedAt: null },
          select: { id: true, name: true, status: true, address: true, suburb: { select: { name: true, postcode: true, city: { select: { name: true, stateId: true } } } } }
        }
      }
    });

    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async updateAgency(organizationId: string, data: any) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: data.name,
        branding: data.branding || undefined,
        settings: data.settings || undefined,
      }
    });
  }

  async getTeamMembers(organizationId: string) {
    return this.prisma.orgStaff.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, accountStatus: true } },
        managedProperties: {
          include: { property: { select: { id: true, name: true } } }
        }
      }
    });
  }

  async inviteTeamMember(organizationId: string, inviterUserId: string, data: any) {
    const { email, firstName, lastName, role, propertyAssignments } = data;

    // Check if email already in use
    let existingUser = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      // Check if already in org
      const existingStaff = await this.prisma.orgStaff.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId } }
      });
      if (existingStaff) throw new ConflictException('User is already a member of this agency');
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      let user = existingUser;
      if (!user) {
        user = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName: lastName || firstName,
            role: UserRole.ORG_STAFF,
            accountStatus: AccountStatus.PENDING_VERIFICATION,
          }
        });
      }

      const orgStaff = await tx.orgStaff.create({
        data: {
          userId: user.id,
          organizationId,
          role: role === 'ADMIN' ? UserRole.ADMIN : UserRole.ORG_STAFF,
        }
      });

      if (propertyAssignments && propertyAssignments.length > 0) {
        for (const pa of propertyAssignments) {
          // Verify property belongs to org
          const prop = await tx.property.findFirst({ where: { id: pa.propertyId, organizationId } });
          if (prop) {
            await tx.propertyManager.create({
              data: {
                propertyId: prop.id,
                orgStaffId: orgStaff.id,
                permission: pa.permission === 'MANAGE' ? PropertyPermission.MANAGE : PropertyPermission.VIEW
              }
            });
          }
        }
      }

      return { user, orgStaff };
    });
  }

  async updateTeamMemberPermissions(organizationId: string, staffId: string, propertyAssignments: any[]) {
    // Verify staff belongs to org
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    return this.prisma.$transaction(async (tx) => {
      // Clear existing assignments
      await tx.propertyManager.deleteMany({ where: { orgStaffId: staffId } });

      const newAssignments = [];
      for (const pa of propertyAssignments) {
        const prop = await tx.property.findFirst({ where: { id: pa.propertyId, organizationId } });
        if (prop) {
          const pm = await tx.propertyManager.create({
            data: {
              propertyId: prop.id,
              orgStaffId: staff.id,
              permission: pa.permission === 'MANAGE' ? PropertyPermission.MANAGE : PropertyPermission.VIEW
            }
          });
          newAssignments.push(pm);
        }
      }
      return newAssignments;
    });
  }

  async removeTeamMember(organizationId: string, staffId: string) {
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.propertyManager.deleteMany({ where: { orgStaffId: staffId } });
      return tx.orgStaff.delete({ where: { id: staffId } });
    });
  }

  // --- Public Directory ---
  async getPublicAgencies(query: any) {
    const { search, limit = 20, page = 1 } = query;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {
      type: OrgType.PROVIDER,
      status: 'VERIFIED'
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [agencies, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          branding: true,
          _count: { select: { staff: true, properties: true } }
        },
        take,
        skip,
        orderBy: { name: 'asc' }
      }),
      this.prisma.organization.count({ where })
    ]);

    return { data: agencies, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async getPublicAgencyDetails(id: string) {
    const agency = await this.prisma.organization.findFirst({
      where: { id, type: OrgType.PROVIDER, status: 'VERIFIED' },
      select: {
        id: true,
        name: true,
        branding: true,
        staff: {
          where: { deletedAt: null },
          select: {
            role: true,
            user: { select: { firstName: true, lastName: true } }
          }
        },
        properties: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          select: {
            id: true,
            name: true,
            address: true,
            media: { take: 1, orderBy: { displayOrder: 'asc' } },
            roomTypes: { select: { pricePerWeek: true } }
          }
        }
      }
    });

    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }
}
