import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TerminalsService } from './terminals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { TerminalStatus } from '@prisma/client';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';

@Controller('retail/terminals')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, RetailPermissionGuard)
@OrgTypes(OrgType.RETAIL)
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post()
  @RequirePermissions(RetailPermission.TERMINALS_MANAGE)
  async createTerminal(@Request() req: any, @Body() data: { branchId: string; name: string; externalId?: string; metadata?: any }) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to create a terminal');
    }
    if (!req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    return this.terminalsService.createTerminal(req.user.organizationId, req.user.id, data);
  }

  @Get()
  @RequirePermissions(RetailPermission.TERMINALS_VIEW)
  async listTerminals(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.terminalsService.listTerminals(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(RetailPermission.TERMINALS_VIEW)
  async getTerminal(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.terminalsService.getTerminal(req.user.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(RetailPermission.TERMINALS_MANAGE)
  async updateTerminal(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { name?: string; externalId?: string; status?: TerminalStatus; metadata?: any }
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    if (!req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    return this.terminalsService.updateTerminal(req.user.organizationId, req.user.id, id, data);
  }
}
