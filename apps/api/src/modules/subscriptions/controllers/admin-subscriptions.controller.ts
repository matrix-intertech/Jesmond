import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  SubscriptionProfileType,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  AdminSubscriptionPermission,
  AdminSubscriptionPermissionGuard,
  RequireAdminSubscriptionPermissions,
} from '../auth/admin-subscription-permissions';
import { AdminSubscriptionsService } from '../services/admin-subscriptions.service';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard, AdminSubscriptionPermissionGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminSubscriptionsController {
  constructor(
    private readonly adminService: AdminSubscriptionsService,
    private readonly billingService: SubscriptionBillingService,
  ) {}

  @Get('billing-readiness')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_BILLING_VIEW,
  )
  getBillingReadiness() {
    return this.billingService.getBillingReadiness();
  }

  @Post('transactions/:transactionId/refund')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_STATUS_MANAGE,
  )
  refundTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: { reason: string; amountMinor?: number },
    @Request() req: any,
  ) {
    return this.billingService.refundTransaction(
      transactionId,
      body.reason,
      req.user.id,
      body.amountMinor,
    );
  }

  @Get('overview')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_BILLING_VIEW,
  )
  getOverview() {
    return this.adminService.getOverviewMetrics();
  }

  @Get('organizations')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_BILLING_VIEW,
  )
  listOrganizations(
    @Query('search') search?: string,
    @Query('profileType') profileType?: SubscriptionProfileType,
    @Query('planId') planId?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.adminService.listOrganizationSubscriptions({
      search,
      profileType,
      planId,
      status,
    });
  }

  @Get('organizations/:organizationId')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_BILLING_VIEW,
  )
  getOrganizationDetail(@Param('organizationId') organizationId: string) {
    return this.adminService.getOrganizationSubscriptionDetail(organizationId);
  }

  @Post('organizations/:organizationId/assign')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_ORG_ASSIGN,
  )
  assignPlan(
    @Param('organizationId') organizationId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.assignOrReplaceOrganizationSubscription(
      organizationId,
      body,
      req.user.id,
    );
  }

  @Post('organizations/:organizationId/suspend')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_STATUS_MANAGE,
  )
  suspend(
    @Param('organizationId') organizationId: string,
    @Body() body: { subscriptionId: string; reason: string },
    @Request() req: any,
  ) {
    return this.adminService.suspendOrganizationSubscription(
      organizationId,
      body.subscriptionId,
      body.reason,
      req.user.id,
    );
  }

  @Post('organizations/:organizationId/reactivate')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_STATUS_MANAGE,
  )
  reactivate(
    @Param('organizationId') organizationId: string,
    @Body() body: { subscriptionId: string; reason: string },
    @Request() req: any,
  ) {
    return this.adminService.reactivateOrganizationSubscription(
      organizationId,
      body.subscriptionId,
      body.reason,
      req.user.id,
    );
  }

  @Post('organizations/:organizationId/cancel')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_STATUS_MANAGE,
  )
  cancel(
    @Param('organizationId') organizationId: string,
    @Body()
    body: { subscriptionId: string; reason: string; immediate?: boolean },
    @Request() req: any,
  ) {
    return this.adminService.cancelOrganizationSubscription(
      organizationId,
      body.subscriptionId,
      body.reason,
      req.user.id,
      body.immediate ?? true,
    );
  }

  @Get('plans')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE,
  )
  listPlans(@Query('profileType') profileType?: SubscriptionProfileType) {
    return this.adminService.listPlans(profileType);
  }

  @Post('plans')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE,
  )
  createPlan(@Body() body: any, @Request() req: any) {
    return this.adminService.createPlan(body, req.user.id);
  }

  @Patch('plans/:planId')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE,
  )
  updatePlan(
    @Param('planId') planId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.updatePlan(planId, body, req.user.id);
  }

  @Post('plans/:planId/prices')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE,
  )
  upsertPrice(
    @Param('planId') planId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.upsertPlanPrice(planId, body, req.user.id);
  }

  @Put('plans/:planId/limits')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_PLANS_MANAGE,
  )
  updateLimits(
    @Param('planId') planId: string,
    @Body() body: { limits: any[] },
    @Request() req: any,
  ) {
    return this.adminService.updatePlanFeatureLimits(
      planId,
      body.limits,
      req.user.id,
    );
  }

  @Get('features')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_FEATURES_MANAGE,
  )
  listFeatures() {
    return this.adminService.listFeatures();
  }

  @Post('features')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_FEATURES_MANAGE,
  )
  createFeature(@Body() body: any, @Request() req: any) {
    return this.adminService.createFeature(body, req.user.id);
  }

  @Patch('features/:featureId')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_FEATURES_MANAGE,
  )
  updateFeature(
    @Param('featureId') featureId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.updateFeature(featureId, body, req.user.id);
  }

  @Get('enterprise')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_ENTERPRISE_MANAGE,
  )
  listEnterprise() {
    return this.adminService.listEnterpriseSubscriptions();
  }

  @Patch('enterprise/:organizationId/contract')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_ENTERPRISE_MANAGE,
  )
  updateEnterpriseContract(
    @Param('organizationId') organizationId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.updateEnterpriseContract(
      organizationId,
      body.subscriptionId,
      body,
      req.user.id,
    );
  }

  @Post('enterprise/:organizationId/overrides')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_ENTERPRISE_MANAGE,
  )
  upsertOverride(
    @Param('organizationId') organizationId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.upsertEnterpriseOverride(
      organizationId,
      body.subscriptionId,
      body,
      req.user.id,
    );
  }

  @Delete('enterprise/:organizationId/overrides/:featureKey')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_ENTERPRISE_MANAGE,
  )
  removeOverride(
    @Param('organizationId') organizationId: string,
    @Param('featureKey') featureKey: string,
    @Query('subscriptionId') subscriptionId: string,
    @Query('reason') reason: string,
    @Request() req: any,
  ) {
    return this.adminService.removeEnterpriseOverride(
      organizationId,
      subscriptionId,
      featureKey,
      reason,
      req.user.id,
    );
  }

  @Get('switches')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_SWITCHES_MANAGE,
  )
  getSwitches() {
    return this.adminService.getSubscriptionSwitches();
  }

  @Patch('switches/:key')
  @RequireAdminSubscriptionPermissions(
    AdminSubscriptionPermission.SUBSCRIPTION_SWITCHES_MANAGE,
  )
  setSwitch(
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
    @Request() req: any,
  ) {
    return this.adminService.setSubscriptionSwitch(
      key,
      body.enabled,
      req.user.id,
    );
  }
}
