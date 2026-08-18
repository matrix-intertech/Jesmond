import { Controller, Get, Patch, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ProviderSettingsService } from './provider-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('settings/provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProviderSettingsController {
  constructor(private readonly providerSettingsService: ProviderSettingsService) {}

  private getOrgId(req: any) {
    if (req.user.role === UserRole.ORG_STAFF) {
      return req.user.organizationId;
    }
    // Admins need to specify an organization if modifying provider settings directly.
    // In a full implementation, they might pass orgId in query params.
    // For simplicity, we require the user to have an organizationId context.
    if (!req.user.organizationId) {
      throw new ForbiddenException('No active organization context found for this user.');
    }
    return req.user.organizationId;
  }

  @Get('business')
  async getBusinessProfile(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.getBusinessProfile(orgId);
  }

  @Patch('business')
  async updateBusinessProfile(@Request() req: any, @Body() body: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.updateBusinessProfile(orgId, body);
  }

  @Get('property-defaults')
  async getPropertyDefaults(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.getPropertyDefaults(orgId);
  }

  @Patch('property-defaults')
  async updatePropertyDefaults(@Request() req: any, @Body() body: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.updatePropertyDefaults(orgId, body);
  }

  @Get('enquiries')
  async getEnquiryPreferences(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.getEnquiryPreferences(orgId);
  }

  @Patch('enquiries')
  async updateEnquiryPreferences(@Request() req: any, @Body() body: any) {
    const orgId = this.getOrgId(req);
    return this.providerSettingsService.updateEnquiryPreferences(orgId, body);
  }
}
