import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { WhatsAppModule } from '../../whatsapp/whatsapp.module';
import { EmailModule } from '../../email/email.module';
import { RetailOrderWhatsAppService } from './retail-order-whatsapp.service';
import { RetailOrderEmailService } from './retail-order-email.service';

@Module({
  imports: [InventoryModule, NotificationsModule, WhatsAppModule, EmailModule],
  controllers: [OrdersController, CustomerOrdersController],
  providers: [OrdersService, RetailOrderWhatsAppService, RetailOrderEmailService],
  exports: [OrdersService, RetailOrderWhatsAppService, RetailOrderEmailService],
})
export class OrdersModule {}
