import { Controller, Post, Get, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('retail/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
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
  async cancelOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to cancel a sales order');
    }
    return this.ordersService.cancelSaleOrder(req.user.organizationId, id);
  }

  @Get(':id')
  async getOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to get a sales order');
    }
    return this.ordersService.getOrder(req.user.organizationId, id);
  }
}
