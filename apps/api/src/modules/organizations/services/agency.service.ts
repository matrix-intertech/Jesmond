import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AccountStatus, OrgType, PropertyPermission, AgencyRole } from '@prisma/client';
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
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true, accountStatus: true }
            },
            managedProperties: {
              include: { property: { select: { id: true, name: true } } }
            }
          }
        },
        properties: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            suburb: { select: { name: true, postcode: true, city: { select: { name: true, stateId: true } } } }
          }
        }
      }
    });

    if (!agency || !agency.name || agency.name.trim() === '') {
      throw new NotFoundException('Agency not found or name not configured');
    }
    return agency;
  }

  private async verifyAgencyAdmin(user: any) {
    const { organizationId, id: userId, role } = user;
    const staff = await this.prisma.orgStaff.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });

    const isGlobalAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

    if (!isGlobalAdmin && !staff) {
      throw new ForbiddenException('Not associated with this organization.');
    }

    const isOrganizationOwner = staff?.role === UserRole.ADMIN;
    const isAgencyAdmin = staff?.agencyRole === AgencyRole.AGENCY_ADMIN;

    const isAdmin = isGlobalAdmin || isOrganizationOwner || isAgencyAdmin;
    if (!isAdmin) throw new ForbiddenException('Only Agency Admin can perform this action.');
  }

  async updateAgency(user: any, data: any) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
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

  async inviteTeamMember(user: any, data: any) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
    const { email, firstName, lastName, agencyRole, propertyAssignments } = data;

    // Validate agencyRole
    const resolvedAgencyRole: AgencyRole =
      agencyRole === 'AGENCY_ADMIN' ? AgencyRole.AGENCY_ADMIN : AgencyRole.TEAM_MEMBER;

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
          role: UserRole.ORG_STAFF,
          agencyRole: resolvedAgencyRole,
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

  async updateTeamMemberRole(user: any, staffId: string, agencyRole: string) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    const resolvedAgencyRole: AgencyRole =
      agencyRole === 'AGENCY_ADMIN' ? AgencyRole.AGENCY_ADMIN : AgencyRole.TEAM_MEMBER;

    return this.prisma.orgStaff.update({
      where: { id: staffId },
      data: { agencyRole: resolvedAgencyRole }
    });
  }

  async updateTeamMemberPermissions(user: any, staffId: string, propertyAssignments: any[]) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
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

  async removeTeamMember(user: any, staffId: string) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.propertyManager.deleteMany({ where: { orgStaffId: staffId } });
      return tx.orgStaff.delete({ where: { id: staffId } });
    });
  }

  async updatePropertyTeam(user: any, propertyId: string, assignments: { orgStaffId: string; permission: 'VIEW' | 'MANAGE' }[]) {
    await this.verifyAgencyAdmin(user);
    const organizationId = user.organizationId;
    // Verify property belongs to org
    const prop = await this.prisma.property.findFirst({ where: { id: propertyId, organizationId } });
    if (!prop) throw new NotFoundException('Property not found');

    return this.prisma.$transaction(async (tx) => {
      // Clear existing assignments for this property
      await tx.propertyManager.deleteMany({ where: { propertyId } });

      const newAssignments = [];
      for (const assignment of assignments) {
        // Verify staff belongs to org
        const staff = await tx.orgStaff.findFirst({ where: { id: assignment.orgStaffId, organizationId } });
        if (staff) {
          const pm = await tx.propertyManager.create({
            data: {
              propertyId,
              orgStaffId: staff.id,
              permission: assignment.permission === 'MANAGE' ? PropertyPermission.MANAGE : PropertyPermission.VIEW
            }
          });
          newAssignments.push(pm);
        }
      }
      return newAssignments;
    });
  }

  // --- Public Directory ---
  async getPublicAgencies(query: any) {
    const { search, limit = 20, page = 1 } = query;
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {
      type: OrgType.PROVIDER,
      status: 'VERIFIED',
      name: { not: '' }
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
          _count: { select: { staff: { where: { deletedAt: null } }, properties: { where: { deletedAt: null } } } }
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
      where: { id, type: OrgType.PROVIDER, status: 'VERIFIED', name: { not: '' } },
      select: {
        id: true,
        name: true,
        branding: true,
        staff: {
          where: { deletedAt: null },
          select: {
            id: true,
            role: true,
            agencyRole: true,
            user: { 
              select: { 
                id: true, 
                firstName: true, 
                lastName: true, 
                email: true, 
                phone: true, 
                allowPublicContactDetails: true 
              } 
            }
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

    const mappedStaff = agency.staff.map(s => {
      const isPublic = Boolean(s.user.allowPublicContactDetails);
      return {
        id: s.id,
        role: s.role,
        agencyRole: s.agencyRole,
        user: {
          id: s.user.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          allowPublicContactDetails: isPublic,
          email: isPublic ? s.user.email : undefined,
          phone: isPublic ? s.user.phone : undefined
        }
      };
    });

    return { ...agency, staff: mappedStaff };
  }
}
