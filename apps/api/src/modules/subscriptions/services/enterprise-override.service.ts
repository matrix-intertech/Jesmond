import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  SubscriptionActorType,
  SubscriptionFeatureValueType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { EntitlementSnapshotService } from './entitlement-snapshot.service';

export interface UpsertEnterpriseOverrideParams {
  organizationId: string;
  subscriptionId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  expiresAt?: Date | null;
  reason: string;
  actorId: string;
  actorType?: SubscriptionActorType;
}

export interface RemoveEnterpriseOverrideParams {
  organizationId: string;
  subscriptionId: string;
  featureKey: string;
  reason: string;
  actorId: string;
  actorType?: SubscriptionActorType;
}

@Injectable()
export class EnterpriseOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: EntitlementSnapshotService,
  ) {}

  async listOverrides(organizationId: string, subscriptionId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, organizationId: true },
    });

    if (!subscription) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        `Subscription ${subscriptionId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (subscription.organizationId !== organizationId) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
        'Cannot inspect overrides belonging to another organization',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.organizationEntitlementOverride.findMany({
      where: { subscriptionId, organizationId },
      include: { feature: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertOverride(params: UpsertEnterpriseOverrideParams) {
    if (!params.reason || !params.reason.trim()) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
        'Override reason is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      params.expiresAt !== undefined &&
      params.expiresAt !== null &&
      isNaN(params.expiresAt.getTime())
    ) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
        'Override expiry timestamp is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const actorType = params.actorType ?? SubscriptionActorType.USER;

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.organizationSubscription.findUnique({
        where: { id: params.subscriptionId },
        select: { id: true, organizationId: true, profileType: true, status: true },
      });

      if (!subscription) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
          `Subscription ${params.subscriptionId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (subscription.organizationId !== params.organizationId) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
          'Cannot modify overrides for another organization',
          HttpStatus.FORBIDDEN,
        );
      }

      if (
        subscription.status === SubscriptionStatus.EXPIRED ||
        subscription.status === SubscriptionStatus.CANCELED
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_SUBSCRIPTION_TRANSITION,
          `Cannot modify overrides on ${subscription.status} subscription`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const feature = await tx.subscriptionFeature.findUnique({
        where: { key: params.featureKey },
      });

      if (!feature || !feature.isActive) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
          `Feature ${params.featureKey} does not exist or is inactive`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!feature.applicableProfiles.includes(subscription.profileType)) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.PROFILE_MISMATCH,
          `Feature ${params.featureKey} is not applicable to profile ${subscription.profileType}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (feature.valueType === SubscriptionFeatureValueType.BOOLEAN) {
        if (params.limitValue !== null && params.limitValue !== undefined) {
          throw new SubscriptionDomainException(
            SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
            `Boolean feature ${params.featureKey} cannot have a numeric limitValue`,
            HttpStatus.BAD_REQUEST,
          );
        }
      } else if (
        params.limitValue !== null &&
        (!Number.isInteger(params.limitValue) || params.limitValue < 0)
      ) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
          `Numeric limitValue for ${params.featureKey} must be a non-negative integer or null`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const previous = await tx.organizationEntitlementOverride.findUnique({
        where: {
          subscriptionId_featureId: {
            subscriptionId: subscription.id,
            featureId: feature.id,
          },
        },
      });

      const override = await tx.organizationEntitlementOverride.upsert({
        where: {
          subscriptionId_featureId: {
            subscriptionId: subscription.id,
            featureId: feature.id,
          },
        },
        update: {
          enabled: params.enabled,
          limitValue: params.limitValue,
          expiresAt: params.expiresAt ?? null,
          reason: params.reason.trim(),
          updatedByUserId: params.actorId,
        },
        create: {
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          featureId: feature.id,
          enabled: params.enabled,
          limitValue: params.limitValue,
          expiresAt: params.expiresAt ?? null,
          reason: params.reason.trim(),
          updatedByUserId: params.actorId,
        },
      });

      await tx.subscriptionAuditEvent.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          actorId: params.actorId,
          actorType,
          action: previous
            ? 'ENTITLEMENT_OVERRIDE_UPDATED'
            : 'ENTITLEMENT_OVERRIDE_CREATED',
          beforeState: previous
            ? ({
                featureKey: feature.key,
                enabled: previous.enabled,
                limitValue: previous.limitValue,
                expiresAt: previous.expiresAt,
              } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          afterState: {
            featureKey: feature.key,
            enabled: override.enabled,
            limitValue: override.limitValue,
            expiresAt: override.expiresAt,
          } as Prisma.InputJsonValue,
          reason: params.reason.trim(),
        },
      });

      const snapshot = await this.snapshotService.createEntitlementSnapshot({
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        actorId: params.actorId,
        actorType,
        reason: `Override ${previous ? 'updated' : 'created'} for ${feature.key}: ${params.reason.trim()}`,
        tx,
      });

      return { override, snapshot };
    });
  }

  async expireOverride(params: RemoveEnterpriseOverrideParams) {
    return this.upsertOverride({
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      featureKey: params.featureKey,
      enabled: false,
      limitValue: null,
      expiresAt: new Date(),
      reason: params.reason,
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  async removeOverride(params: RemoveEnterpriseOverrideParams) {
    if (!params.reason || !params.reason.trim()) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
        'Override removal reason is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const actorType = params.actorType ?? SubscriptionActorType.USER;

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.organizationSubscription.findUnique({
        where: { id: params.subscriptionId },
        select: { id: true, organizationId: true },
      });

      if (!subscription) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
          `Subscription ${params.subscriptionId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (subscription.organizationId !== params.organizationId) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.CROSS_ORGANIZATION_ACCESS_DENIED,
          'Cannot remove overrides for another organization',
          HttpStatus.FORBIDDEN,
        );
      }

      const feature = await tx.subscriptionFeature.findUnique({
        where: { key: params.featureKey },
      });

      if (!feature) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
          `Feature ${params.featureKey} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const existing = await tx.organizationEntitlementOverride.findUnique({
        where: {
          subscriptionId_featureId: {
            subscriptionId: subscription.id,
            featureId: feature.id,
          },
        },
      });

      if (!existing) {
        throw new SubscriptionDomainException(
          SubscriptionErrorCode.INVALID_ENTITLEMENT_OVERRIDE,
          `Override for ${params.featureKey} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      await tx.organizationEntitlementOverride.delete({
        where: { id: existing.id },
      });

      await tx.subscriptionAuditEvent.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          actorId: params.actorId,
          actorType,
          action: 'ENTITLEMENT_OVERRIDE_REMOVED',
          beforeState: {
            featureKey: feature.key,
            enabled: existing.enabled,
            limitValue: existing.limitValue,
            expiresAt: existing.expiresAt,
          } as Prisma.InputJsonValue,
          afterState: Prisma.JsonNull,
          reason: params.reason.trim(),
        },
      });

      const snapshot = await this.snapshotService.createEntitlementSnapshot({
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        actorId: params.actorId,
        actorType,
        reason: `Override removed for ${feature.key}: ${params.reason.trim()}`,
        tx,
      });

      return { removed: true, snapshot };
    });
  }
}
