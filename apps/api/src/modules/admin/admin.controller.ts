import { Controller, Get, Post, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('properties/pending')
  async getPendingProperties() {
    return this.adminService.getPendingProperties();
  }

  @Get('properties/:id')
  async getPropertyDetails(@Param('id') id: string) {
    return this.adminService.getPropertyDetails(id);
  }

  @Post('properties/:id/approve')
  async approveProperty(@Param('id') id: string, @Request() req: any) {
    return this.adminService.approveProperty(id, req.user.id);
  }

  @Post('properties/:id/reject')
  async rejectProperty(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.adminService.rejectProperty(id, req.user.id, body.reason);
  }
}
