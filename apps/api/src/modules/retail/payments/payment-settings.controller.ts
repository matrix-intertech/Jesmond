import { Controller, Get, Put, Body, UseGuards, Request, Param, ForbiddenException } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('retail/payment-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentSettingsController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Get()
  @Roles('ORG_STAFF', 'ADMIN', 'SUPER_ADMIN')
  async getSettings(@Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new ForbiddenException('User is not part of an organization');
    return this.paymentSettingsService.getSettings(orgId);
  }

  @Put()
  @Roles('ORG_STAFF', 'ADMIN', 'SUPER_ADMIN')
  async updateSettings(@Request() req: any, @Body() body: { enabled: boolean }) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new ForbiddenException('User is not part of an organization');
    return this.paymentSettingsService.updateSettings(orgId, body.enabled);
  }
}
