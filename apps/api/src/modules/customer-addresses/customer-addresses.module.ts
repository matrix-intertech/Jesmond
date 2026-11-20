import { Module } from '@nestjs/common';
import { CustomerAddressesController } from './controllers/customer-addresses.controller';
import { CustomerAddressesService } from './services/customer-addresses.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerAddressesController],
  providers: [CustomerAddressesService],
  exports: [CustomerAddressesService],
})
export class CustomerAddressesModule {}
