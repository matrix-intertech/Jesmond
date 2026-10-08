import { Controller, Post, Get, Param, Body, Headers, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';

@Controller('v1/food/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.ORDERS)
  async createOrder(
    @Request() req: any,
    @Body() dto: CreateFoodOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createOrder(
      req.user.id,
      req.user.organizationId,
      dto,
      idempotencyKey,
    );
  }

  @Get(':id')
  async getOrder(
    @Request() req: any,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getOrderForUser(orderId, req.user.id);
  }
}

