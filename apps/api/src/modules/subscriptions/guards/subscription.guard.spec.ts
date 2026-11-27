import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SubscriptionProfileType,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import {
  SKIP_SUBSCRIPTION_CHECK_KEY,
  SUBSCRIPTION_FEATURE_KEY,
} from '../decorators/subscription.decorators';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard (Unit)', () => {
  const makeCtx = (user: any, metadata?: any, skip = false): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  const setup = (opts: {
    subEnabled?: boolean;
    enfEnabled?: boolean;
    metadata?: { featureKey: string; checkUsage?: boolean };
    skip?: boolean;
    resolved?: any;
    resolveError?: Error;
    hasQuota?: boolean;
  }) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === SKIP_SUBSCRIPTION_CHECK_KEY) return opts.skip ?? false;
        if (key === SUBSCRIPTION_FEATURE_KEY) return opts.metadata;
        return undefined;
      }),
    } as unknown as Reflector;

    const featureFlagService: any = {
      isEnabled: jest.fn(async (key: string) => {
        if (key === 'SUBSCRIPTIONS_ENABLED') return opts.subEnabled ?? false;
        if (key === 'SUBSCRIPTION_ENFORCEMENT_ENABLED')
          return opts.enfEnabled ?? false;
        return false;
      }),
    };

    const entitlementResolver: any = {
      resolveForOrganization: opts.resolveError
        ? jest.fn().mockRejectedValue(opts.resolveError)
        : jest.fn().mockResolvedValue(opts.resolved),
    };

    const usageCounterService: any = {
      checkQuotaAvailable: jest.fn().mockResolvedValue(opts.hasQuota ?? true),
    };

    const guard = new SubscriptionGuard(
      reflector,
      featureFlagService,
      entitlementResolver,
      usageCounterService,
    );

    return { guard, entitlementResolver };
  };

  it('bypasses enforcement when SUBSCRIPTIONS_ENABLED or SUBSCRIPTION_ENFORCEMENT_ENABLED is false', async () => {
    const { guard, entitlementResolver } = setup({
      subEnabled: false,
      enfEnabled: false,
      metadata: { featureKey: 'RETAIL_PRODUCTS', checkUsage: true },
    });

    await expect(
      guard.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).resolves.toBe(true);
    expect(entitlementResolver.resolveForOrganization).not.toHaveBeenCalled();
  });

  it.each([
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ])('exempts %s even when enforcement is ON', async (role) => {
    const { guard, entitlementResolver } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'RETAIL_PRODUCTS' },
    });

    await expect(guard.canActivate(makeCtx({ role }))).resolves.toBe(true);
    expect(entitlementResolver.resolveForOrganization).not.toHaveBeenCalled();
  });

  it('denies ORG_STAFF when no active subscription exists', async () => {
    const { guard } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'RETAIL_PRODUCTS' },
      resolveError: new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        'None',
      ),
    });

    await expect(
      guard.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 403,
        code: 'SUBSCRIPTION_REQUIRED',
        reason: 'NO_ACTIVE_SUBSCRIPTION',
        featureKey: 'RETAIL_PRODUCTS',
      }),
    });
  });

  it('denies with SUBSCRIPTION_EXPIRED and SUBSCRIPTION_SUSPENDED appropriately', async () => {
    const { guard: expiredGuard } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'RETAIL_PRODUCTS' },
      resolved: {
        profileType: SubscriptionProfileType.RETAIL,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        effectiveAccessActive: false,
        entitlements: {},
      },
    });

    await expect(
      expiredGuard.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SUBSCRIPTION_REQUIRED',
        reason: 'SUBSCRIPTION_EXPIRED',
        pricingUrl: '/pricing?profile=retail',
      }),
    });

    const { guard: suspendedGuard } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'RETAIL_PRODUCTS' },
      resolved: {
        profileType: SubscriptionProfileType.RETAIL,
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        effectiveAccessActive: false,
        entitlements: {},
      },
    });

    await expect(
      suspendedGuard.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SUBSCRIPTION_REQUIRED',
        reason: 'SUBSCRIPTION_SUSPENDED',
      }),
    });
  });

  it('denies with FEATURE_NOT_INCLUDED and USAGE_LIMIT_EXCEEDED, and allows valid grace-period access', async () => {
    const { guard: missingFeature } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'AGENCY_CUSTOM_ROLES' },
      resolved: {
        profileType: SubscriptionProfileType.ACCOMMODATION,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        effectiveAccessActive: true,
        entitlements: {
          AGENCY_CUSTOM_ROLES: {
            enabled: false,
            limitValue: null,
            unlimited: false,
          },
        },
      },
    });

    await expect(
      missingFeature.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason: 'FEATURE_NOT_INCLUDED',
      }),
    });

    const { guard: quotaExceeded } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'ACCOMMODATION_LISTINGS', checkUsage: true },
      resolved: {
        profileType: SubscriptionProfileType.ACCOMMODATION,
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        effectiveAccessActive: true,
        entitlements: {
          ACCOMMODATION_LISTINGS: {
            enabled: true,
            limitValue: 3,
            unlimited: false,
          },
        },
      },
      hasQuota: false,
    });

    await expect(
      quotaExceeded.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);

    const { guard: graceAllowed } = setup({
      subEnabled: true,
      enfEnabled: true,
      metadata: { featureKey: 'ACCOMMODATION_LISTINGS', checkUsage: true },
      resolved: {
        profileType: SubscriptionProfileType.ACCOMMODATION,
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        effectiveAccessActive: true,
        entitlements: {
          ACCOMMODATION_LISTINGS: {
            enabled: true,
            limitValue: 3,
            unlimited: false,
          },
        },
      },
      hasQuota: true,
    });

    await expect(
      graceAllowed.canActivate(
        makeCtx({ role: UserRole.ORG_STAFF, organizationId: 'org-1' }),
      ),
    ).resolves.toBe(true);
  });
});
