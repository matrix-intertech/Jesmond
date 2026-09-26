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
import { AgencyPermissionGuard } from '../auth/guards/agency-permission.guard';
import { RequireAgencyPermissions } from '../auth/decorators/require-agency-permissions.decorator';
import { AgencyPermission } from '../auth/agency-permissions.enum';

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
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.AGENCY_VIEW)
  @Get('my')
  async getMyAgency(@Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.getMyAgency(req.user.organizationId);
  }

  // PUT /agency/my — Update Agency Settings
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.AGENCY_MANAGE)
  @Put('my')
  async updateAgency(@Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateAgency(req.user, data);
  }

  // GET /agency/my/members — List Team Members
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.TEAM_VIEW)
  @Get('my/members')
  async getTeamMembers(@Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.getTeamMembers(req.user.organizationId);
  }

  // POST /agency/my/members — Invite Team Member
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.TEAM_MANAGE)
  @Post('my/members')
  async inviteTeamMember(@Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.inviteTeamMember(req.user, data);
  }

  // PUT /agency/my/members/:id/role — Change Agency Role
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.TEAM_MANAGE)
  @Put('my/members/:id/role')
  async updateTeamMemberRole(
    @Param('id') id: string,
    @Body() data: { agencyRole?: string, customRoleId?: string | null },
    @Request() req: any,
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateTeamMemberRole(req.user, id, data);
  }

  // PUT /agency/my/members/:id/permissions — Update Property Assignments
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.TEAM_MANAGE)
  @Put('my/members/:id/permissions')
  async updateTeamMemberPermissions(
    @Param('id') id: string,
    @Body() data: { propertyAssignments: any[] },
    @Request() req: any,
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateTeamMemberPermissions(
      req.user,
      id,
      data.propertyAssignments,
    );
  }

  // DELETE /agency/my/members/:id — Remove Team Member
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.TEAM_MANAGE)
  @Delete('my/members/:id')
  async removeTeamMember(@Param('id') id: string, @Request() req: any) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.removeTeamMember(req.user, id);
  }

  // PUT /agency/properties/:propertyId/team — Update Team Members for a Property
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.PROPERTIES_MANAGE)
  @Put('properties/:propertyId/team')
  async updatePropertyTeam(
    @Param('propertyId') propertyId: string,
    @Body() data: { assignments: { orgStaffId: string; permission: 'VIEW' | 'MANAGE' }[] },
    @Request() req: any,
  ) {
    if (!req.user?.organizationId)
      throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updatePropertyTeam(
      req.user,
      propertyId,
      data.assignments,
    );
  }
  // --- Custom Roles ---

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.ROLES_MANAGE, AgencyPermission.TEAM_VIEW) // can view roles if either
  @Get('my/roles')
  async getCustomRoles(@Request() req: any) {
    if (!req.user?.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.getCustomRoles(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.ROLES_MANAGE)
  @Post('my/roles')
  async createCustomRole(@Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.createCustomRole(req.user, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.ROLES_MANAGE)
  @Put('my/roles/:id')
  async updateCustomRole(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    if (!req.user?.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.updateCustomRole(req.user, id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, AgencyPermissionGuard)
  @OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_STAFF)
  @RequireAgencyPermissions(AgencyPermission.ROLES_MANAGE)
  @Delete('my/roles/:id')
  async deleteCustomRole(@Param('id') id: string, @Request() req: any) {
    if (!req.user?.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.agencyService.deleteCustomRole(req.user, id);
  }
}
