import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrgType, LeadSourceType, LeadTemperature, LeadStatus } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  // 1. Track Visit
  async trackVisit(data: {
    visitorId: string;
    organizationId?: string;
    propertyId?: string;
    userId?: string;
  }) {
    let { visitorId, organizationId, propertyId, userId } = data;

    if (propertyId) {
      const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
      if (prop) {
        organizationId = prop.organizationId;
      } else {
        propertyId = undefined;
      }
    }

    if (!organizationId) throw new BadRequestException('organizationId is required if property is not provided');

    const sourceType = propertyId ? LeadSourceType.PROPERTY_PAGE : LeadSourceType.AGENCY_PAGE;
    const initialTemperature = propertyId ? LeadTemperature.WARM : LeadTemperature.COLD;

    // Try atomic update first
    const updated = await this.prisma.lead.updateMany({
      where: {
        organizationId,
        propertyId: propertyId || null,
        visitorId
      },
      data: {
        visitCount: { increment: 1 },
        lastVisitedAt: new Date(),
        userId: userId || undefined // don't overwrite if undefined
      }
    });

    if (updated.count > 0) {
      return this.prisma.lead.findFirst({
        where: { organizationId, propertyId: propertyId || null, visitorId }
      });
    }

    try {
      // Create new
      return await this.prisma.lead.create({
        data: {
          organizationId,
          propertyId: propertyId || null,
          visitorId,
          userId,
          sourceType,
          temperature: initialTemperature,
          status: LeadStatus.NEW
        }
      });
    } catch (e: any) {
      // P2002 is Prisma's unique constraint violation code
      if (e.code === 'P2002') {
        // If a concurrent request created it, try fetching again
        return this.prisma.lead.findFirst({
          where: { organizationId, propertyId: propertyId || null, visitorId }
        });
      }
      throw e; // Do not swallow real database errors
    }
  }

  // 2. Get Leads for Team Member / Admin
  async getMyLeads(user: any, filters: any = {}) {
    const { organizationId, id: userId, orgRole } = user;
    
    // First, identify the staff record
    const staff = await this.prisma.orgStaff.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });

    const isGlobalAdmin = orgRole === UserRole.ADMIN || orgRole === UserRole.SUPER_ADMIN;
    if (!isGlobalAdmin && !staff) {
      throw new ForbiddenException('Not associated with this organization.');
    }

    const isAdmin = isGlobalAdmin || (staff?.agencyRole === 'AGENCY_ADMIN');

    let leadCondition: any = { organizationId };

    if (!isAdmin && staff) {
      // Team Member: can see property leads they manage OR leads assigned to them
      const managedProperties = await this.prisma.propertyManager.findMany({
        where: { orgStaffId: staff.id },
        select: { propertyId: true }
      });
      const managedPropertyIds = managedProperties.map(p => p.propertyId);

      leadCondition.OR = [
        { propertyId: { in: managedPropertyIds } },
        { assignments: { some: { orgStaffId: staff.id, removedAt: null } } }
      ];
    }

    // Apply filters
    if (filters.propertyId) leadCondition.propertyId = filters.propertyId;
    if (filters.sourceType) leadCondition.sourceType = filters.sourceType;
    if (filters.temperature) leadCondition.temperature = filters.temperature;
    if (filters.status) leadCondition.status = filters.status;
    if (filters.teamMemberId) {
      // If teamMemberId is filtering by assignment
      leadCondition.assignments = { some: { orgStaffId: filters.teamMemberId, removedAt: null } };
    }

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where: leadCondition,
        include: {
          property: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignments: {
            where: { removedAt: null },
            include: {
              orgStaff: {
                include: { user: { select: { firstName: true, lastName: true, email: true } } }
              }
            }
          }
        },
        orderBy: { lastVisitedAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.lead.count({ where: leadCondition })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // 3. Get Lead Detail
  async getLeadDetail(user: any, leadId: string) {
    const leads = await this.getMyLeads(user, { id: leadId, limit: 1 });
    if (!leads.items.length) throw new NotFoundException('Lead not found or unauthorized.');
    return leads.items[0];
  }

  // 4. Update Lead Status/Temperature
  async updateLead(user: any, leadId: string, data: any) {
    const { organizationId, id: userId, orgRole } = user;

    // Identify staff
    const staff = await this.prisma.orgStaff.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });

    const isGlobalAdmin = orgRole === UserRole.ADMIN || orgRole === UserRole.SUPER_ADMIN;
    if (!isGlobalAdmin && !staff) {
      throw new ForbiddenException('Not associated with this organization.');
    }

    const isAdmin = isGlobalAdmin || (staff?.agencyRole === 'AGENCY_ADMIN');

    // Verify access and MANAGE permission
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        assignments: staff ? { where: { orgStaffId: staff.id, removedAt: null } } : false
      }
    });

    if (!lead) throw new NotFoundException('Lead not found.');

    let canManage = isAdmin;

    if (!isAdmin && staff) {
      // Check if they manage the property with MANAGE permission
      if (lead.propertyId) {
        const pm = await this.prisma.propertyManager.findFirst({
          where: { propertyId: lead.propertyId, orgStaffId: staff.id, permission: 'MANAGE' }
        });
        if (pm) canManage = true;
      }
      
      // If they are directly assigned, they can manage (assuming assignment grants management rights, 
      // otherwise we would need granular lead permission)
      if (lead.assignments && lead.assignments.length > 0) {
        canManage = true;
      }
    }

    if (!canManage) {
      throw new ForbiddenException('You do not have MANAGE permission for this lead.');
    }

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: data.status,
        temperature: data.temperature
      }
    });
  }

  // 5. Assign Lead
  async assignLead(user: any, leadId: string, targetStaffId: string | null) {
    const { organizationId, id: userId, orgRole } = user;

    // Verify Admin
    const staff = await this.prisma.orgStaff.findUnique({
      where: { userId_organizationId: { userId, organizationId } }
    });

    const isGlobalAdmin = orgRole === UserRole.ADMIN || orgRole === UserRole.SUPER_ADMIN;
    if (!isGlobalAdmin && !staff) {
      throw new ForbiddenException('Not associated with this organization.');
    }
    
    const isAdmin = isGlobalAdmin || (staff?.agencyRole === 'AGENCY_ADMIN');
    if (!isAdmin) throw new ForbiddenException('Only Agency Admin can assign leads.');

    // Verify Lead
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found.');

    return this.prisma.$transaction(async (tx) => {
      // Clear existing active assignments for this lead
      await tx.leadAssignment.updateMany({
        where: { leadId, removedAt: null },
        data: { removedAt: new Date() }
      });

      if (targetStaffId) {
        // Verify target staff
        const targetStaff = await tx.orgStaff.findFirst({
          where: { id: targetStaffId, organizationId }
        });
        if (!targetStaff) throw new BadRequestException('Target team member not found in this organization.');

        // Add new assignment
        await tx.leadAssignment.upsert({
          where: { leadId_orgStaffId: { leadId, orgStaffId: targetStaff.id } },
          update: { removedAt: null, assignedAt: new Date(), assignedBy: userId },
          create: { leadId, orgStaffId: targetStaff.id, assignedBy: userId }
        });
      }
      
      return { success: true };
    });
  }
}
