import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Delete,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { AgencyService } from '../services/agency.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, OrgType } from '@prisma/client';

@Controller('agency')
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  // ── Public Endpoints ──────────────────────────────────────────────────
  @Get('public')
  async getPublicAgencies(@Query() query: any) {
    return this.agencyService.getPublicAgencies(query);
  }

  @Get('public/:id')
  async getPublicAgencyDetails(@Param('id') id: string) {
    return this.agencyService.getPublicAgencyDetails(id);
  }

  // ── Host Dashboard Endpoints ──────────────────────────────────────────
  // GET /agency/my — Agency Overview
  // Guard: PROVIDER org type, ORG_STAFF or ADMIN (AGENCY_ADMIN uses ORG_STAFF global role)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @Get('my')
  async getMyAgency(@Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.getMyAgency(req.user.organizationId);
  }

  // PUT /agency/my — Update Agency Settings (Agency Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my')
  async updateAgency(@Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateAgency(req.user.organizationId, data);
  }

  // GET /agency/my/members — List Team Members
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @Get('my/members')
  async getTeamMembers(@Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.getTeamMembers(req.user.organizationId);
  }

  // POST /agency/my/members — Invite Team Member (Agency Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/members')
  async inviteTeamMember(@Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.inviteTeamMember(req.user.organizationId, req.user.id, data);
  }

  // PUT /agency/my/members/:id/role — Change Agency Role (Agency Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/members/:id/role')
  async updateTeamMemberRole(
    @Param('id') id: string,
    @Body() data: { agencyRole: string },
    @Request() req: any,
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateTeamMemberRole(req.user.organizationId, id, data.agencyRole);
  }

  // PUT /agency/my/members/:id/permissions — Update Property Assignments (Agency Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/members/:id/permissions')
  async updateTeamMemberPermissions(
    @Param('id') id: string,
    @Body() data: { propertyAssignments: any[] },
    @Request() req: any,
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateTeamMemberPermissions(
      req.user.organizationId,
      id,
      data.propertyAssignments,
    );
  }

  // DELETE /agency/my/members/:id — Remove Team Member (Agency Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/members/:id')
  async removeTeamMember(@Param('id') id: string, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.removeTeamMember(req.user.organizationId, id);
  }
}
