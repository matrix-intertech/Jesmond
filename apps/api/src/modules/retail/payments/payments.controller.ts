import { Controller, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RetailPaymentStatus } from '@prisma/client';

@Controller('v1/retail/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: RetailPaymentStatus) {
    return this.paymentsService.updatePaymentStatus(id, status);
  }
}
