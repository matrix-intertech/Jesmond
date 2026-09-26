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



  async updateAgency(user: any, data: any) {
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
        customRole: true,
        managedProperties: {
          include: { property: { select: { id: true, name: true } } }
        }
      }
    });
  }

  async inviteTeamMember(user: any, data: any) {
    const organizationId = user.organizationId;
    const { email, firstName, lastName, agencyRole, propertyAssignments, customRoleId } = data;

    // Validate agencyRole
    const resolvedAgencyRole: AgencyRole =
      agencyRole === 'AGENCY_ADMIN' ? AgencyRole.AGENCY_ADMIN : AgencyRole.TEAM_MEMBER;

    let permissionsToAssign: string[] = [];
    if (customRoleId) {
      const customRole = await this.prisma.agencyCustomRole.findUnique({
        where: { id: customRoleId, organizationId }
      });
      if (!customRole) throw new NotFoundException('Custom role not found');
      permissionsToAssign = customRole.permissions;
    } else if (resolvedAgencyRole === AgencyRole.AGENCY_ADMIN) {
      permissionsToAssign = ['*'];
    }

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
          customRoleId: customRoleId || null,
          permissions: permissionsToAssign,
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

  async updateTeamMemberRole(user: any, staffId: string, data: { agencyRole?: string, customRoleId?: string | null }) {
    const organizationId = user.organizationId;
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    const updateData: any = {};
    if (data.agencyRole !== undefined) {
      updateData.agencyRole = data.agencyRole === 'AGENCY_ADMIN' ? AgencyRole.AGENCY_ADMIN : AgencyRole.TEAM_MEMBER;
    }

    if (data.customRoleId !== undefined) {
      if (data.customRoleId === null) {
         updateData.customRoleId = null;
      } else {
         const customRole = await this.prisma.agencyCustomRole.findUnique({
           where: { id: data.customRoleId, organizationId }
         });
         if (!customRole) throw new NotFoundException('Custom role not found');
         updateData.customRoleId = customRole.id;
      }
    }

    return this.prisma.orgStaff.update({
      where: { id: staffId },
      data: updateData
    });
  }

  async updateTeamMemberPermissions(user: any, staffId: string, propertyAssignments: any[]) {
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
    const organizationId = user.organizationId;
    const staff = await this.prisma.orgStaff.findFirst({ where: { id: staffId, organizationId } });
    if (!staff) throw new NotFoundException('Team member not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.propertyManager.deleteMany({ where: { orgStaffId: staffId } });
      return tx.orgStaff.delete({ where: { id: staffId } });
    });
  }

  async updatePropertyTeam(user: any, propertyId: string, assignments: { orgStaffId: string; permission: 'VIEW' | 'MANAGE' }[]) {
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

  // --- Roles & Permissions ---
  async getRoles(organizationId: string) {
    // We can inject or instantiate it, but let's just ensure they exist inline here if we don't want to inject
    const systemRoles = [
      { name: 'Admin', description: 'Full access to agency settings, team, and all properties.', permissions: ['*'], isSystem: true },
      { name: 'Team Member', description: 'Standard team member with basic access.', permissions: ['property.view', 'lead.view', 'enquiry.view', 'team.view'], isSystem: true }
    ];

    for (const role of systemRoles) {
      const exists = await this.prisma.agencyCustomRole.findFirst({
        where: { organizationId, name: role.name, isSystem: true }
      });
      if (!exists) {
        await this.prisma.agencyCustomRole.create({
          data: {
            organizationId,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            isSystem: true
          }
        });
      }
    }

    const roles = await this.prisma.agencyCustomRole.findMany({
      where: { organizationId },
      include: {
        _count: { select: { staff: true } }
      },
      orderBy: [
        { isSystem: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const staffCounts = await this.prisma.orgStaff.groupBy({
      by: ['agencyRole'],
      where: { organizationId, agencyRole: { not: null }, deletedAt: null },
      _count: { id: true }
    });

    return roles.map(role => {
      if (role.name === 'Admin') {
        const count = staffCounts.find(c => c.agencyRole === 'AGENCY_ADMIN')?._count.id || 0;
        return { ...role, _count: { staff: count + role._count.staff } };
      }
      if (role.name === 'Team Member') {
        const count = staffCounts.find(c => c.agencyRole === 'TEAM_MEMBER')?._count.id || 0;
        return { ...role, _count: { staff: count + role._count.staff } };
      }
      return role;
    });
  }

  async createCustomRole(user: any, data: { name: string, description?: string, permissions: string[] }) {
    const organizationId = user.organizationId;

    const existing = await this.prisma.agencyCustomRole.findFirst({
      where: { organizationId, name: data.name }
    });
    if (existing) throw new ConflictException('A role with this name already exists');

    return this.prisma.agencyCustomRole.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        permissions: data.permissions || [],
      }
    });
  }

  async updateCustomRole(user: any, roleId: string, data: { name?: string, description?: string, permissions?: string[] }) {
    const organizationId = user.organizationId;

    const role = await this.prisma.agencyCustomRole.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystem) {
      if (data.name && data.name !== role.name) throw new ForbiddenException('Cannot rename system roles');
    } else {
      if (data.name && data.name !== role.name) {
        const existing = await this.prisma.agencyCustomRole.findFirst({
          where: { organizationId, name: data.name }
        });
        if (existing) throw new ConflictException('A role with this name already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
       const updatedRole = await tx.agencyCustomRole.update({
         where: { id: roleId },
         data: {
           name: data.name,
           description: data.description,
           permissions: data.permissions,
         }
       });

       // We no longer sync permissions to OrgStaff.permissions.
       // The AgencyPermissionsService handles dynamic resolution based on the role.
       return updatedRole;
    });
  }

  async deleteCustomRole(user: any, roleId: string) {
    const organizationId = user.organizationId;

    const role = await this.prisma.agencyCustomRole.findFirst({ 
      where: { id: roleId, organizationId },
      include: { _count: { select: { staff: true } } }
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('Cannot delete system roles');
    if (role._count.staff > 0) {
      throw new ConflictException('Cannot delete role while it is assigned to team members');
    }

    return this.prisma.agencyCustomRole.delete({ where: { id: roleId } });
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
