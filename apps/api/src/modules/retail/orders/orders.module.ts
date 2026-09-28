import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [InventoryModule, NotificationsModule],
  controllers: [OrdersController, CustomerOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
