import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SKIP_SUBSCRIPTION_CHECK_KEY,
  SUBSCRIPTION_FEATURE_KEY,
  SubscriptionFeatureMetadata,
} from '../decorators/subscription.decorators';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { EntitlementResolverService } from '../services/entitlement-resolver.service';
import {
  SubscriptionRequiredReason,
  UsageCounterService,
  buildSubscriptionRequiredPayload,
} from '../services/usage-counter.service';

const EXEMPT_ROLES = new Set<string>([
  UserRole.STUDENT,
  UserRole.PARENT,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
]);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly featureFlagService?: FeatureFlagService,
    @Optional()
    private readonly entitlementResolver?: EntitlementResolverService,
    @Optional() private readonly usageCounterService?: UsageCounterService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  private async isFlagEnabled(key: string): Promise<boolean> {
    if (this.featureFlagService) {
      return this.featureFlagService.isEnabled(key);
    }
    if (this.prisma) {
      const flag = await this.prisma.featureFlag.findUnique({
        where: { key },
      });
      return flag?.enabled || false;
    }
    return false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const metadata =
      this.reflector.getAllAndOverride<SubscriptionFeatureMetadata>(
        SUBSCRIPTION_FEATURE_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!metadata?.featureKey) {
      return true;
    }

    const [subscriptionsEnabled, enforcementEnabled] = await Promise.all([
      this.isFlagEnabled('SUBSCRIPTIONS_ENABLED'),
      this.isFlagEnabled('SUBSCRIPTION_ENFORCEMENT_ENABLED'),
    ]);

    if (!subscriptionsEnabled || !enforcementEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (EXEMPT_ROLES.has(user.role)) {
      return true;
    }

    if (user.role !== UserRole.ORG_STAFF || !user.organizationId) {
      throw new ForbiddenException(
        buildSubscriptionRequiredPayload({
          reason: 'NO_ACTIVE_SUBSCRIPTION',
          featureKey: metadata.featureKey,
        }),
      );
    }

    if (!this.entitlementResolver) {
      return true;
    }

    let resolved;
    try {
      resolved = await this.entitlementResolver.resolveForOrganization(
        user.organizationId,
      );
    } catch (err) {
      if (err instanceof SubscriptionDomainException) {
        const reasonMap: Partial<
          Record<SubscriptionErrorCode, SubscriptionRequiredReason>
        > = {
          [SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION]:
            'NO_ACTIVE_SUBSCRIPTION',
          [SubscriptionErrorCode.SUBSCRIPTION_EXPIRED]: 'SUBSCRIPTION_EXPIRED',
          [SubscriptionErrorCode.SUBSCRIPTION_SUSPENDED]:
            'SUBSCRIPTION_SUSPENDED',
          [SubscriptionErrorCode.PROFILE_MISMATCH]: 'NO_ACTIVE_SUBSCRIPTION',
        };
        throw new ForbiddenException(
          buildSubscriptionRequiredPayload({
            reason: reasonMap[err.code] ?? 'NO_ACTIVE_SUBSCRIPTION',
            featureKey: metadata.featureKey,
          }),
        );
      }
      throw err;
    }

    if (!resolved.effectiveAccessActive) {
      const reason: SubscriptionRequiredReason =
        resolved.subscriptionStatus === SubscriptionStatus.SUSPENDED
          ? 'SUBSCRIPTION_SUSPENDED'
          : 'SUBSCRIPTION_EXPIRED';

      throw new ForbiddenException(
        buildSubscriptionRequiredPayload({
          reason,
          profileType: resolved.profileType,
          featureKey: metadata.featureKey,
        }),
      );
    }

    const entry = resolved.entitlements[metadata.featureKey];
    if (!entry || !entry.enabled) {
      throw new ForbiddenException(
        buildSubscriptionRequiredPayload({
          reason: 'FEATURE_NOT_INCLUDED',
          profileType: resolved.profileType,
          featureKey: metadata.featureKey,
        }),
      );
    }

    if (
      metadata.checkUsage &&
      this.usageCounterService &&
      !entry.unlimited &&
      entry.limitValue !== null
    ) {
      const hasQuota = await this.usageCounterService.checkQuotaAvailable(
        user.organizationId,
        metadata.featureKey,
        entry.limitValue,
      );
      if (!hasQuota) {
        throw new ForbiddenException(
          buildSubscriptionRequiredPayload({
            reason: 'USAGE_LIMIT_EXCEEDED',
            profileType: resolved.profileType,
            featureKey: metadata.featureKey,
          }),
        );
      }
    }

    return true;
  }
}
