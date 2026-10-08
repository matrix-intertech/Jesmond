import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        abn: true,
        status: true,
        timezone: true,
        branding: true,
        settings: true,
        businessCategory: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Business organization not found');
    }

    return org;
  }

  async getLocation(organizationId: string) {
    const org = await this.getProfile(organizationId);
    const branch = await this.prisma.retailBranch.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      businessName: org.name,
      businessCategory: org.businessCategory,
      branchId: branch?.id || null,
      address: branch?.address || null,
      lat: branch?.lat || null,
      lng: branch?.lng || null,
      phone: branch?.phone || null,
    };
  }

  async updateLocation(
    organizationId: string,
    data: { address: string; lat: number; lng: number },
  ) {
    if (data.lat < -90 || data.lat > 90) {
      throw new Error('Invalid latitude');
    }
    if (data.lng < -180 || data.lng > 180) {
      throw new Error('Invalid longitude');
    }

    const org = await this.getProfile(organizationId);
    let branch = await this.prisma.retailBranch.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    if (!branch) {
      branch = await this.prisma.retailBranch.create({
        data: {
          organizationId,
          name: 'Primary Location',
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          isActive: true,
          takeawayEnabled: true,
          deliveryEnabled: false,
        },
      });
    } else {
      branch = await this.prisma.retailBranch.update({
        where: { id: branch.id },
        data: {
          address: data.address,
          lat: data.lat,
          lng: data.lng,
        },
      });
    }

    return {
      businessName: org.name,
      businessCategory: org.businessCategory,
      branchId: branch.id,
      address: branch.address,
      lat: branch.lat,
      lng: branch.lng,
      phone: branch.phone,
    };
  }

  async updateProfile(
    organizationId: string,
    data: { timezone?: string; branding?: any; settings?: any },
    userId: string,
  ) {
    const current = await this.getProfile(organizationId);

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        timezone:
          data.timezone !== undefined ? data.timezone : current.timezone,
        branding:
          data.branding !== undefined
            ? data.branding
            : (current.branding as any),
        settings:
          data.settings !== undefined
            ? data.settings
            : (current.settings as any),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'business.profile.update',
        resourceType: 'Organization',
        resourceId: organizationId,
        changes: { old: current as any, new: updated as any },
      },
    });

    return updated;
  }
}
