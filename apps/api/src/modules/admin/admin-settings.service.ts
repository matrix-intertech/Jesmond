import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformSettings() {
    let settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'singleton' }
    });

    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: { id: 'singleton' }
      });
    }

    return settings;
  }

  async updatePlatformSettings(data: any, adminId: string) {
    try {
      const current = await this.getPlatformSettings();

      const updated = await this.prisma.platformSettings.update({
        where: { id: 'singleton' },
        data: {
          siteName: data.siteName,
          supportEmail: data.supportEmail,
          supportPhone: data.supportPhone,
          defaultTimezone: data.defaultTimezone,
          defaultCurrency: data.defaultCurrency,
          maintenanceMode: data.maintenanceMode,
        }
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          actorType: ActorType.USER,
          action: 'platform.settings.update',
          resourceType: 'PlatformSettings',
          resourceId: 'singleton',
          changes: { old: current, new: updated }
        }
      });

      return updated;
    } catch (error) {
      throw new InternalServerErrorException('Failed to update platform settings');
    }
  }

  async getAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
