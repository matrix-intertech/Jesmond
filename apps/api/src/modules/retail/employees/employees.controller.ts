import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';

@Controller('retail/employees')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, RetailPermissionGuard)
@OrgTypes(OrgType.RETAIL)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequirePermissions(RetailPermission.EMPLOYEES_MANAGE)
  async createEmployee(@Request() req: any, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.createEmployee(req.user.organizationId, req.user.id, body);
  }

  @Get()
  @RequirePermissions(RetailPermission.EMPLOYEES_VIEW)
  async listEmployees(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.listEmployees(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(RetailPermission.EMPLOYEES_VIEW)
  async getEmployee(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.getEmployee(req.user.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions(RetailPermission.EMPLOYEES_MANAGE)
  async updateEmployee(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.updateEmployee(req.user.organizationId, req.user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions(RetailPermission.EMPLOYEES_MANAGE)
  async deactivateEmployee(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.deactivateEmployee(req.user.organizationId, id);
  }
}
