import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key }
    });
    // Default to false if missing, ensuring safety for payments
    return flag?.enabled || false;
  }

  async getFeatureState(key: string) {
    const enabled = await this.isEnabled(key);
    return { key, enabled };
  }

  async setFeatureState(key: string, enabled: boolean, adminId: string) {
    try {
      // We use upsert so it gets created if it doesn't exist
      const feature = await this.prisma.featureFlag.upsert({
        where: { key },
        create: { key, enabled, updatedBy: adminId },
        update: { enabled, updatedBy: adminId },
      });

      // Log in AuditLog
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          actorType: ActorType.USER,
          action: 'feature.update',
          resourceType: 'FeatureFlag',
          resourceId: key,
          changes: { enabled }
        }
      });

      return { key, enabled: feature.enabled };
    } catch (error) {
      throw new InternalServerErrorException('Failed to update feature state');
    }
  }
}
