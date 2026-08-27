import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RetailPaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async updatePaymentStatus(paymentId: string, newStatus: RetailPaymentStatus) {
    const payment = await this.prisma.retailPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) throw new BadRequestException('Payment not found');

    if (payment.status === 'REFUNDED' && newStatus === 'PAID') {
      throw new BadRequestException('Cannot transition from REFUNDED to PAID');
    }

    const updated = await this.prisma.retailPayment.update({
      where: { id: paymentId },
      data: { status: newStatus },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: 'SYSTEM',
        actorType: 'SYSTEM',
        action: 'payment.status.update',
        resourceType: 'RetailPayment',
        resourceId: paymentId,
        changes: { old: payment as any, new: updated as any }
      }
    });

    return updated;
  }
}
