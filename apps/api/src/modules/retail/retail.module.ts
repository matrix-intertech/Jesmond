import { Module } from '@nestjs/common';
import { BusinessesModule } from './businesses/businesses.module';
import { BranchesModule } from './branches/branches.module';
import { TerminalsModule } from './terminals/terminals.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PosModule } from './pos/pos.module';

@Module({
  imports: [BusinessesModule, BranchesModule, TerminalsModule, CatalogModule, InventoryModule, CustomersModule, OrdersModule, PaymentsModule, PosModule]
})
export class RetailModule {}
