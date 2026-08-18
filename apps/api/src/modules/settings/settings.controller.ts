import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dtos/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.settingsService.getProfile(req.user.id);
  }

  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    return this.settingsService.updateProfile(req.user.id, body);
  }

  @Get('security')
  async getSecurity(@Request() req: any) {
    return this.settingsService.getSecurity(req.user.id);
  }

  @Post('security/change-password')
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    return this.settingsService.changePassword(req.user.id, body);
  }

  @Post('security/2fa-setup')
  async setup2fa(@Request() req: any) {
    return this.settingsService.setup2fa(req.user.id);
  }

  @Post('security/2fa-verify')
  async verify2fa(@Request() req: any, @Body('code') code: string) {
    return this.settingsService.verify2fa(req.user.id, code);
  }

  @Post('security/2fa-disable')
  async disable2fa(@Request() req: any, @Body('code') code: string) {
    return this.settingsService.disable2fa(req.user.id, code);
  }

  @Delete('sessions/:id')
  async revokeSession(@Request() req: any, @Param('id') id: string) {
    return this.settingsService.revokeSession(req.user.id, id);
  }

  @Get('notifications')
  async getNotifications(@Request() req: any) {
    return this.settingsService.getNotifications(req.user.id);
  }

  @Patch('notifications')
  async updateNotifications(@Request() req: any, @Body() data: any) {
    return this.settingsService.updateNotifications(req.user.id, data);
  }

  @Post('privacy/delete-account')
  async requestAccountDeletion(@Request() req: any, @Body() data: { reason?: string }) {
    return this.settingsService.requestAccountDeletion(req.user.id, data);
  }

  @Get('data-export')
  async exportData(@Request() req: any) {
    return this.settingsService.exportData(req.user.id);
  }
}
