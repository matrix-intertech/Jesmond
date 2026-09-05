import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgTypesGuard } from '../auth/guards/org-types.guard';
import { OrgTypes } from '../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.STUDENT)
  @Post()
  async createApplication(
    @Body() body: { propertyId: string; roomTypeId: string; moveInDate: string; durationMonths: number },
    @Request() req: any
  ) {
    return this.applicationsService.createApplication(
      req.user.id,
      body.propertyId,
      body.roomTypeId,
      body.moveInDate,
      body.durationMonths
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.STUDENT)
  @Get('my')
  async getMyApplications(@Request() req: any) {
    return this.applicationsService.getMyApplications(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF)
  @Get('provider')
  async getProviderApplications(@Request() req: any) {
    return this.applicationsService.getProviderApplications(req.user.organizationId);
  }
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF)
  @Get('provider/:id')
  async getProviderApplication(@Param('id') id: string, @Request() req: any) {
    return this.applicationsService.getProviderApplication(req.user.organizationId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF)
  @Post(':id/approve')
  async approveApplication(@Param('id') id: string, @Request() req: any) {
    return this.applicationsService.approveApplication(req.user.organizationId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF)
  @Post(':id/reject')
  async rejectApplication(@Param('id') id: string, @Request() req: any) {
    return this.applicationsService.rejectApplication(req.user.organizationId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.STUDENT)
  @Post(':id/withdraw')
  async withdrawApplication(@Param('id') id: string, @Request() req: any) {
    return this.applicationsService.withdrawApplication(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF)
  @Post(':id/remove')
  async removeStudent(@Param('id') id: string, @Request() req: any) {
    return this.applicationsService.removeStudent(req.user.organizationId, id);
  }
}
