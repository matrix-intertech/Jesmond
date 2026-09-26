import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
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

  @Get('properties/active')
  async getActiveProperties() {
    return this.adminService.getActiveProperties();
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

  @Post('properties/:id/unpublish')
  async unpublishProperty(@Param('id') id: string, @Request() req: any) {
    return this.adminService.unpublishProperty(id, req.user.id);
  }

  @Post('properties/:id/republish')
  async republishProperty(@Param('id') id: string, @Request() req: any) {
    return this.adminService.republishProperty(id, req.user.id);
  }

  @Post('properties/:id/verification')
  async updatePropertyVerificationStatus(
    @Param('id') id: string,
    @Body() body: { status: any },
    @Request() req: any
  ) {
    return this.adminService.updatePropertyVerificationStatus(id, body.status, req.user.id);
  }

  // ─── User Management ──────────────────────────────────────────────────────

  @Get('users')
  async getUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  @Post('users/:id/disable')
  async disableUser(@Param('id') id: string, @Request() req: any) {
    return this.adminService.disableUser(id, req.user.id);
  }

  @Post('users/:id/enable')
  async enableUser(@Param('id') id: string, @Request() req: any) {
    return this.adminService.enableUser(id, req.user.id);
  }
}
