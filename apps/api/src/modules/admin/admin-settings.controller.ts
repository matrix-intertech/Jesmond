import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get('platform')
  async getPlatformSettings() {
    return this.adminSettingsService.getPlatformSettings();
  }

  @Patch('platform')
  async updatePlatformSettings(@Body() body: any, @Request() req: any) {
    return this.adminSettingsService.updatePlatformSettings(body, req.user.id);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 100;
    return this.adminSettingsService.getAuditLogs(take);
  }
}
