import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Controller('retail/customers')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async createCustomer(@Request() req: any, @Body() data: { firstName: string; lastName?: string; email?: string; phone?: string; address?: string; externalId?: string }) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    if (!req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    return this.customersService.createCustomer(req.user.organizationId, req.user.id, data);
  }

  @Get()
  async listCustomers(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.customersService.listCustomers(req.user.organizationId);
  }

  @Get(':id')
  async getCustomer(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.customersService.getCustomer(req.user.organizationId, id);
  }

  @Patch(':id')
  async updateCustomer(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; externalId?: string }
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    if (!req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    return this.customersService.updateCustomer(req.user.organizationId, req.user.id, id, data);
  }
}
