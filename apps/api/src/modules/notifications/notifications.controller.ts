import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unreadOnly') unreadOnly: string = 'false',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const isUnread = unreadOnly === 'true';

    // Scoped by organizationId if active in business workspace
    const orgId = req.user.organizationId;

    return this.notificationsService.getUserNotifications(
      req.user.id,
      orgId,
      pageNum,
      limitNum,
      isUnread,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const orgId = req.user.organizationId;
    return this.notificationsService.getUnreadCount(req.user.id, orgId);
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  async patchMarkAllAsRead(@Request() req: any) {
    const orgId = req.user.organizationId;
    return this.notificationsService.markAllAsRead(req.user.id, orgId);
  }

  @Post('read-all')
  async postMarkAllAsRead(@Request() req: any) {
    const orgId = req.user.organizationId;
    return this.notificationsService.markAllAsRead(req.user.id, orgId);
  }

  @Get('preferences')
  async getPreferences(@Request() req: any) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Patch('preferences')
  async updatePreferences(@Request() req: any, @Body() body: any) {
    const updates = Array.isArray(body) ? body : body.preferences || [];
    return this.notificationsService.updatePreferences(req.user.id, updates);
  }

  @Post('push/subscribe')
  async subscribePush(@Request() req: any, @Body() body: any) {
    return this.notificationsService.subscribePush(req.user.id, body);
  }

  @Delete('push/subscribe')
  async unsubscribePush(
    @Request() req: any,
    @Body('endpoint') endpoint: string,
  ) {
    return this.notificationsService.unsubscribePush(req.user.id, endpoint);
  }
}
