import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Optional,
} from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminSubscriptionPermission,
  assertAdminSubscriptionPermissions,
} from '../subscriptions/auth/admin-subscription-permissions';

const SUBSCRIPTION_SWITCH_KEYS = new Set([
  'SUBSCRIPTIONS_ENABLED',
  'SUBSCRIPTION_ENFORCEMENT_ENABLED',
  'SUBSCRIPTION_CHECKOUT_ENABLED',
]);

@Controller('admin/features')
export class AdminFeaturesController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  async getAllFeatures() {
    return this.featureFlagService.getAllFeatures();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get(':key')
  async getFeatureState(@Param('key') key: string) {
    return this.featureFlagService.getFeatureState(key);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':key')
  async updateFeatureState(
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
    @Request() req: any,
  ) {
    if (SUBSCRIPTION_SWITCH_KEYS.has(key)) {
      await assertAdminSubscriptionPermissions(
        req.user,
        [AdminSubscriptionPermission.SUBSCRIPTION_SWITCHES_MANAGE],
        this.prisma,
      );
    }
    return this.featureFlagService.setFeatureState(
      key,
      body.enabled,
      req.user.id,
    );
  }
}
