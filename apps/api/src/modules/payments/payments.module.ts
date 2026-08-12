import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
