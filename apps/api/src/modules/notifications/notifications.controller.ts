import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: any, @Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    return this.notificationsService.getUserNotifications(req.user.id, pageNum, limitNum);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Post('read-all')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Post('push/subscribe')
  async subscribePush(@Request() req: any, @Body() body: any) {
    return this.notificationsService.subscribePush(req.user.id, body);
  }

  @Delete('push/subscribe')
  async unsubscribePush(@Request() req: any, @Body('endpoint') endpoint: string) {
    return this.notificationsService.unsubscribePush(req.user.id, endpoint);
  }
}
