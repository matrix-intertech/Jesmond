import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/features')
export class AdminFeaturesController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  async getAllFeatures() {
    return this.featureFlagService.getAllFeatures();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get(':key')
  async getFeatureState(@Param('key') key: string) {
    return this.featureFlagService.getFeatureState(key);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':key')
  async updateFeatureState(
    @Param('key') key: string, 
    @Body() body: { enabled: boolean }, 
    @Request() req: any
  ) {
    return this.featureFlagService.setFeatureState(key, body.enabled, req.user.id);
  }
}
