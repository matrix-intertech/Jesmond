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
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!org) {
      throw new NotFoundException('Business organization not found');
    }

    return org;
  }

  async updateProfile(organizationId: string, data: { timezone?: string; branding?: any; settings?: any }, userId: string) {
    const current = await this.getProfile(organizationId);

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        timezone: data.timezone !== undefined ? data.timezone : current.timezone,
        branding: data.branding !== undefined ? data.branding : (current.branding as any),
        settings: data.settings !== undefined ? data.settings : (current.settings as any),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'business.profile.update',
        resourceType: 'Organization',
        resourceId: organizationId,
        changes: { old: current as any, new: updated as any }
      }
    });

    return updated;
  }
}
