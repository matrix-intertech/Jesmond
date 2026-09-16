import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('customer/orders')
@UseGuards(JwtAuthGuard)
export class CustomerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async listMyOrders(@Request() req: any) {
    if (!req.user || !req.user.email) {
      throw new ForbiddenException('User email context is required to access orders');
    }
    return this.ordersService.getCustomerOrders(req.user.email);
  }

  @Get(':id')
  async getMyOrder(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.email) {
      throw new ForbiddenException('User email context is required to access orders');
    }
    return this.ordersService.getCustomerOrder(req.user.email, id);
  }
}
