import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Controller('retail/employees')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  async createEmployee(@Request() req: any, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.createEmployee(req.user.organizationId, body);
  }

  @Get()
  async listEmployees(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.listEmployees(req.user.organizationId);
  }

  @Get(':id')
  async getEmployee(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.getEmployee(req.user.organizationId, id);
  }

  @Patch(':id')
  async updateEmployee(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.updateEmployee(req.user.organizationId, id, body);
  }

  @Delete(':id')
  async deactivateEmployee(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.employeesService.deactivateEmployee(req.user.organizationId, id);
  }
}
