import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgTypesGuard } from '../auth/guards/org-types.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgTypes } from '../auth/decorators/org-types.decorator';
import { UserRole, OrgType } from '@prisma/client';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // 1. Track Visit (anonymous or authenticated handled via frontend or simple logic)
  @Post('track')
  async trackVisit(@Body() data: any, @Request() req: any) {
    if (!data.visitorId) {
      throw new BadRequestException('visitorId is required.');
    }
    if (!data.organizationId && !data.propertyId) {
      throw new BadRequestException('organizationId or propertyId is required.');
    }
    
    // Validate organizationId format (basic check)
    if (data.organizationId && typeof data.organizationId !== 'string') {
       throw new BadRequestException('Invalid organizationId.');
    }
    
    // If the request has an authorization token, req.user will be populated
    const userId = req.user?.id;

    return this.leadsService.trackVisit({
      visitorId: data.visitorId,
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      userId
    });
  }

  // 2. Get My Leads
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER, OrgType.AGENCY)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @Get('my')
  async getMyLeads(@Query() query: any, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.leadsService.getMyLeads(req.user, query);
  }

  // 3. Get Lead Detail
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER, OrgType.AGENCY)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @Get('my/:id')
  async getLeadDetail(@Param('id') id: string, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.leadsService.getLeadDetail(req.user, id);
  }

  // 4. Update Lead Status/Temperature
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER, OrgType.AGENCY)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @Patch('my/:id')
  async updateLead(
    @Param('id') id: string,
    @Body() data: { status?: string; temperature?: string },
    @Request() req: any
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.leadsService.updateLead(req.user, id, data);
  }

  // 5. Assign Lead
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER, OrgType.AGENCY)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/assign')
  async assignLead(
    @Param('id') id: string,
    @Body() data: { targetStaffId: string | null },
    @Request() req: any
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.leadsService.assignLead(req.user, id, data.targetStaffId);
  }
}
