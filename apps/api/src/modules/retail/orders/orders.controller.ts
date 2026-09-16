import { Controller, Post, Get, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';

@Controller('retail/orders')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard, RetailPermissionGuard)
@OrgTypes(OrgType.RETAIL)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions(RetailPermission.ORDERS_MANAGE)
  async createOrder(@Request() req: any, @Body() data: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to create a sales order');
    }
    return this.ordersService.createSaleOrder(
      req.user.organizationId,
      data.branchId,
      data.terminalId,
      data.items,
      data.paymentMethod,
      data.amountReceived,
      data.providerRequestId,
      data.customerId
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(RetailPermission.ORDERS_MANAGE)
  async cancelOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to cancel a sales order');
    }
    return this.ordersService.cancelSaleOrder(req.user.organizationId, id);
  }

  @Get()
  @RequirePermissions(RetailPermission.ORDERS_VIEW)
  async listOrders(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to access sales orders');
    }
    return this.ordersService.listOrders(req.user.organizationId, req.user.retailBranchId);
  }

  @Get(':id')
  @RequirePermissions(RetailPermission.ORDERS_VIEW)
  async getOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to get a sales order');
    }
    return this.ordersService.getOrder(req.user.organizationId, id, req.user.retailBranchId);
  }
}
