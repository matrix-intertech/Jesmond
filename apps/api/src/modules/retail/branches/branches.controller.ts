import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';

@Controller('retail/branches')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, RetailPermissionGuard)
@OrgTypes(OrgType.RETAIL)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions(RetailPermission.BRANCH_VIEW)
  async listBranches(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to access retail branches');
    }
    return this.branchesService.listBranches(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(RetailPermission.BRANCH_VIEW)
  async getBranch(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to access retail branches');
    }
    return this.branchesService.getBranch(req.user.organizationId, id);
  }

  @Post()
  @RequirePermissions(RetailPermission.BRANCH_MANAGE)
  async createBranch(@Request() req: any, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.branchesService.createBranch(req.user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermissions(RetailPermission.BRANCH_MANAGE)
  async updateBranch(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.branchesService.updateBranch(req.user.organizationId, id, body);
  }

  @Delete(':id')
  @RequirePermissions(RetailPermission.BRANCH_MANAGE)
  async deleteBranch(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.branchesService.deleteBranch(req.user.organizationId, id);
  }

  @Get(':id/employees')
  @RequirePermissions(RetailPermission.BRANCH_VIEW, RetailPermission.EMPLOYEES_VIEW)
  async getBranchEmployees(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.branchesService.getBranchEmployees(req.user.organizationId, id);
  }
}
