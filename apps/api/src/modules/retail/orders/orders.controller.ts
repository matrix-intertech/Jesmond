import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType, UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';
import { ListOrdersQueryDto } from './dtos/list-orders.dto';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';

@Controller('retail/orders')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  OrgTypesGuard,
  BusinessCapabilityGuard,
  RetailPermissionGuard,
)
@Roles(UserRole.ORG_STAFF, UserRole.ADMIN)
@OrgTypes(OrgType.RETAIL)
@RequireCapability(BusinessCapability.ORDERS)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions(RetailPermission.ORDERS_MANAGE)
  async createOrder(@Request() req: any, @Body() data: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to create a sales order',
      );
    }
    return this.ordersService.createSaleOrder(
      req.user.organizationId,
      data.branchId,
      data.terminalId,
      data.items,
      data.paymentMethod,
      data.amountReceived,
      data.providerRequestId,
      data.customerId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(RetailPermission.ORDERS_MANAGE)
  async cancelOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to cancel a sales order',
      );
    }
    return this.ordersService.cancelSaleOrder(req.user.organizationId, id);
  }

  @Get('stats')
  @RequirePermissions(RetailPermission.ORDERS_VIEW)
  async getOrderStats(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to access sales order stats',
      );
    }
    return this.ordersService.getOrderStats(
      req.user.organizationId,
      req.user.retailBranchId,
    );
  }

  @Get()
  @RequirePermissions(RetailPermission.ORDERS_VIEW)
  async listOrders(@Request() req: any, @Query() query: ListOrdersQueryDto) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to access sales orders',
      );
    }
    const parsedPage = query.page ? parseInt(query.page, 10) : undefined;
    const parsedLimit = query.limit ? parseInt(query.limit, 10) : undefined;
    return this.ordersService.listOrders(
      req.user.organizationId,
      req.user.retailBranchId,
      parsedPage,
      parsedLimit,
      query.status,
      query.fulfillmentType,
    );
  }

  @Get(':id')
  @RequirePermissions(RetailPermission.ORDERS_VIEW)
  async getOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to get a sales order',
      );
    }
    return this.ordersService.getOrder(
      req.user.organizationId,
      id,
      req.user.retailBranchId,
    );
  }

  @Patch(':id/status')
  @RequirePermissions(RetailPermission.ORDERS_MANAGE)
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: any,
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to update a sales order',
      );
    }
    return this.ordersService.updateOrderStatus(
      req.user.organizationId,
      id,
      status,
    );
  }
}
