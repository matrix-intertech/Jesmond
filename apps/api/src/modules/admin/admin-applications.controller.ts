import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApplicationsService } from '../applications/applications.service';

/**
 * Read‑only admin endpoints for viewing applications.
 * All routes are protected by JWT auth and ADMIN/SUPER_ADMIN role guards.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // GET /admin/applications – list all applications
  @Get('applications')
  async listAll() {
    // Returns a flat list with necessary relations for admin view
    return this.applicationsService.adminFindAll();
  }

  // GET /admin/applications/:id – get a single application detail
  @Get('applications/:id')
  async getOne(@Param('id') id: string) {
    return this.applicationsService.adminFindOne(id);
  }
}
