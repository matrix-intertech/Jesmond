import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateFoodOrderStatusDto } from './dto/update-food-order-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';

@Controller('v1/food/business/orders')
@UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
export class BusinessOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequireCapability(BusinessCapability.ORDERS)
  async getBusinessOrders(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ordersService.getBusinessOrders(req.user.organizationId, page, limit, status, branchId);
  }

  @Get(':id')
  @RequireCapability(BusinessCapability.ORDERS)
  async getBusinessOrder(
    @Request() req: any,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getBusinessOrder(orderId, req.user.organizationId);
  }

  @Patch(':id/status')
  @RequireCapability(BusinessCapability.ORDERS)
  async updateOrderStatus(
    @Request() req: any,
    @Param('id') orderId: string,
    @Body() dto: UpdateFoodOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(orderId, req.user.organizationId, dto.status, req.user.id);
  }
}
