import {
  Controller,
  Get,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureFlagService } from '../../admin/feature-flag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { EntitlementResolverService } from '../services/entitlement-resolver.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class OrgSubscriptionsController {
  constructor(
    private readonly entitlementResolver: EntitlementResolverService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  private async assertEligibleOrgContext(req: any): Promise<string> {
    const subscriptionsEnabled = await this.featureFlagService.isEnabled(
      'SUBSCRIPTIONS_ENABLED',
    );
    if (!subscriptionsEnabled) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.SUBSCRIPTIONS_DISABLED,
        'Subscription system is currently disabled',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const user = req.user;
    if (!user || user.role !== UserRole.ORG_STAFF) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.PROFILE_MISMATCH,
        'Only business organization members have an organization subscription',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.organizationId) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.NO_ACTIVE_SUBSCRIPTION,
        'Active organization context is required',
        HttpStatus.FORBIDDEN,
      );
    }

    return user.organizationId;
  }

  @Get('current')
  async getCurrentSubscription(@Request() req: any) {
    const organizationId = await this.assertEligibleOrgContext(req);
    return this.entitlementResolver.getCurrentSubscriptionSummary(
      organizationId,
    );
  }

  @Get('current/entitlements')
  async getCurrentEntitlements(@Request() req: any) {
    const organizationId = await this.assertEligibleOrgContext(req);
    return this.entitlementResolver.resolveForOrganization(organizationId);
  }
}
