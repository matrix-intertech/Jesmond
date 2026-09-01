import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RetailPaymentStatus, PaymentMethod, OrderStatus } from '@prisma/client';
import { TyroConnector } from '../pos/providers/tyro.connector';
import { SquareConnector } from '../pos/providers/square.connector';
import { StripeConnector } from '../pos/providers/stripe.connector';
import { ZellerConnector } from '../pos/providers/zeller.connector';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  private getConnector(provider: string) {
    switch (provider.toUpperCase()) {
      case 'TYRO': return new TyroConnector();
      case 'SQUARE': return new SquareConnector();
      case 'STRIPE': return new StripeConnector();
      case 'ZELLER': return new ZellerConnector();
      default: return null;
    }
  }

  async updatePaymentStatus(organizationId: string, paymentId: string, newStatus: RetailPaymentStatus) {
    const payment = await this.prisma.retailPayment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment || payment.order.organizationId !== organizationId) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'REFUNDED' && newStatus === 'PAID') {
      throw new BadRequestException('Cannot transition from REFUNDED to PAID');
    }
    if (payment.status === 'PAID' && ['PENDING', 'AUTHORIZED', 'CANCELLED'].includes(newStatus)) {
      throw new BadRequestException(`Cannot transition payment from PAID to ${newStatus}`);
    }
    if (payment.status === 'CANCELLED' && newStatus !== 'PENDING') {
      throw new BadRequestException('A cancelled payment can only be reset to PENDING for re-processing');
    }
    if (payment.status === 'FAILED' && newStatus === 'PAID') {
      throw new BadRequestException('Cannot directly mark a FAILED payment as PAID; use retry flow');
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

  async retryPayment(
    organizationId: string,
    orderId: string,
    paymentMethod: PaymentMethod,
    terminalId?: string,
    providerRequestId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Look up sales order
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { payments: true }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.organizationId !== organizationId) {
        throw new ForbiddenException('Order does not belong to your organization');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException('Payment can only be retried for PENDING orders');
      }

      // Check if there is already a PAID payment
      const alreadyPaid = order.payments.some(p => p.status === RetailPaymentStatus.PAID);
      if (alreadyPaid) {
        throw new BadRequestException('Order is already paid');
      }

      // Idempotency check: verify if a payment with providerRequestId already exists
      if (providerRequestId) {
        const existing = await tx.retailPayment.findFirst({
          where: { providerRequestId },
        });
        if (existing) {
          return existing;
        }
      }

      let paymentStatus: RetailPaymentStatus = RetailPaymentStatus.PENDING;
      let transactionId: string | undefined = undefined;
      let providerName: string | undefined = undefined;

      if (paymentMethod === PaymentMethod.CASH) {
        paymentStatus = RetailPaymentStatus.PAID;
        // Cash payment succeeds immediately, update order to COMPLETED
        await tx.salesOrder.update({
          where: { id: order.id },
          data: { status: OrderStatus.COMPLETED },
        });
      } else {
        if (terminalId) {
          const terminal = await tx.posTerminal.findUnique({
            where: { id: terminalId },
          });
          if (!terminal) {
            throw new NotFoundException('Terminal not found');
          }
          if (terminal.branchId !== order.branchId) {
            throw new BadRequestException('Terminal does not belong to the order branch');
          }

          providerName = terminal.provider || 'STRIPE';
          const connector = this.getConnector(providerName);
          if (connector && connector.initiatePayment) {
            const result = await connector.initiatePayment(organizationId, {
              internalPaymentIntentId: order.id,
              amount: order.total,
              currency: 'AUD',
              providerTerminalId: terminal.externalId || terminal.id,
              idempotencyKey: providerRequestId || `idem-${Date.now()}`
            });
            transactionId = result.providerTransactionId;
          }
        }
      }

      const payment = await tx.retailPayment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          provider: providerName,
          transactionId,
          providerRequestId,
          amount: order.total,
          status: paymentStatus,
          reconciliationStatus: paymentMethod === PaymentMethod.CASH ? 'MATCHED' : 'PENDING'
        }
      });

      return payment;
    });
  }
}
