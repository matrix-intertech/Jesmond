import { Controller, Patch, Post, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RetailPaymentStatus, PaymentMethod } from '@prisma/client';

@Controller('retail/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: RetailPaymentStatus) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.paymentsService.updatePaymentStatus(req.user.organizationId, id, status);
  }

  @Post('retry')
  async retryPayment(@Request() req: any, @Body() data: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.paymentsService.retryPayment(
      req.user.organizationId,
      data.orderId,
      data.paymentMethod,
      data.terminalId,
      data.providerRequestId
    );
  }
}
