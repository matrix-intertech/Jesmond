import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { BusinessOrdersController } from './business-orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController, BusinessOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
