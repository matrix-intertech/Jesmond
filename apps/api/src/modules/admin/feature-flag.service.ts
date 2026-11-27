import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key },
    });
    // Default to false if missing, ensuring safety for payments
    return flag?.enabled || false;
  }

  async getFeatureState(key: string) {
    const enabled = await this.isEnabled(key);
    return { key, enabled };
  }

  async getAllFeatures() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async setFeatureState(key: string, enabled: boolean, adminId: string) {
    if (
      (key === 'SUBSCRIPTION_CHECKOUT_ENABLED' ||
        key === 'SUBSCRIPTION_ENFORCEMENT_ENABLED') &&
      enabled
    ) {
      const subscriptionsEnabled = await this.isEnabled(
        'SUBSCRIPTIONS_ENABLED',
      );
      if (!subscriptionsEnabled) {
        throw new BadRequestException(
          `${key} cannot be enabled while SUBSCRIPTIONS_ENABLED is false`,
        );
      }
    }

    if (key === 'SUBSCRIPTIONS_ENABLED' && !enabled) {
      const [enforcementEnabled, checkoutEnabled] = await Promise.all([
        this.isEnabled('SUBSCRIPTION_ENFORCEMENT_ENABLED'),
        this.isEnabled('SUBSCRIPTION_CHECKOUT_ENABLED'),
      ]);
      if (enforcementEnabled || checkoutEnabled) {
        throw new BadRequestException(
          'Disable SUBSCRIPTION_ENFORCEMENT_ENABLED and SUBSCRIPTION_CHECKOUT_ENABLED before disabling SUBSCRIPTIONS_ENABLED',
        );
      }
    }

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
          changes: { enabled },
        },
      });

      return { key, enabled: feature.enabled };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update feature state');
    }
  }
}
