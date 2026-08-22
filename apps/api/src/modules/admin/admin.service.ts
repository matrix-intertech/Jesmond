import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
}
