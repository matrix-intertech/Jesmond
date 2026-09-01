import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentMethod, OrderStatus, RetailPaymentStatus } from '@prisma/client';
import { TyroConnector } from '../pos/providers/tyro.connector';
import { SquareConnector } from '../pos/providers/square.connector';
import { StripeConnector } from '../pos/providers/stripe.connector';
import { ZellerConnector } from '../pos/providers/zeller.connector';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService
  ) {}

  private getConnector(provider: string) {
    switch (provider.toUpperCase()) {
      case 'TYRO': return new TyroConnector();
      case 'SQUARE': return new SquareConnector();
      case 'STRIPE': return new StripeConnector();
      case 'ZELLER': return new ZellerConnector();
      default: return null;
    }
  }

  /**
   * Phase 9: Transaction safe order creation and inventory deduction
   */
  async createSaleOrder(
    organizationId: string,
    branchId: string,
    terminalId: string | undefined,
    items: { productId: string; quantity: number; unitPrice?: number }[],
    paymentMethod: PaymentMethod = PaymentMethod.CASH,
    amountReceived?: number,
    providerRequestId?: string,
    customerId?: string
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      // Idempotency check: verify if a payment with providerRequestId already exists
      if (providerRequestId) {
        const existingPayment = await tx.retailPayment.findFirst({
          where: { providerRequestId },
          include: { order: { include: { items: true, payments: true } } }
        });
        if (existingPayment) {
          return existingPayment.order;
        }
      }

      // 1. Validate branch ownership
      const branch = await tx.retailBranch.findUnique({
        where: { id: branchId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (branch.organizationId !== organizationId) {
        throw new ForbiddenException('Branch does not belong to your organization');
      }

      // Customer Validation
      if (customerId) {
        const customer = await tx.retailCustomer.findUnique({
          where: { id: customerId },
        });
        if (!customer || customer.organizationId !== organizationId) {
          throw new BadRequestException('Customer not found or invalid organization context');
        }
      }

      // 2. Fetch products and calculate authoritative pricing
      // taxRate is stored as a decimal multiplier: 0.10 = 10% GST
      // All monetary values are in integer cents to preserve precision
      let subtotal = 0; // sum of (qty * unitPrice) for each line, pre-tax
      let totalTax = 0;  // sum of per-line tax amounts
      const orderItemsData = [];

      for (const item of items) {
        if (item.quantity <= 0) {
          throw new BadRequestException('Quantity must be greater than zero');
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }
        if (!product.isActive) {
          throw new BadRequestException(`Product ${product.name} is inactive`);
        }
        if (product.organizationId !== organizationId) {
          throw new ForbiddenException(`Product ${product.name} does not belong to your organization`);
        }

        // Validate stock availability
        const inventory = await tx.inventory.findUnique({
          where: { branchId_productId: { branchId, productId: item.productId } },
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new BadRequestException(`Insufficient inventory for product ${product.name}`);
        }

        // Authoritative pricing: all values sourced from DB, never from client payload
        const lineSubtotal = item.quantity * product.sellingPrice; // cents
        // taxRate is a decimal multiplier (e.g. 0.10 = 10% GST). Round to nearest cent.
        const lineTax = Math.round(lineSubtotal * (product.taxRate ?? 0));
        const lineTotal = lineSubtotal + lineTax; // cents

        subtotal += lineSubtotal;
        totalTax += lineTax;

        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.sellingPrice, // authoritative DB price per unit
          tax: lineTax,
          lineTotal,
        });
      }

      const total = subtotal + totalTax; // grand total including tax
      const orderNumber = `ORD-${Date.now()}`;

      // Create Sales Order in PENDING status (or COMPLETED if CASH)
      const order = await tx.salesOrder.create({
        data: {
          organizationId,
          branchId,
          terminalId,
          customerId,
          orderNumber,
          status: paymentMethod === PaymentMethod.CASH ? OrderStatus.COMPLETED : OrderStatus.PENDING,
          subtotal,
          tax: totalTax,
          discount: 0,
          total,
          currency: 'AUD',
          source: 'IN_STORE',
          items: {
            create: orderItemsData,
          },
        },
      });

      // 3. Deduct Inventory for each item
      for (const item of items) {
        await this.inventoryService.deductInventoryForSale(
          tx,
          branchId,
          item.productId,
          item.quantity,
          order.id
        );
      }

      // 4. Handle Payment
      if (paymentMethod === PaymentMethod.CASH) {
        const cashAmt = amountReceived !== undefined ? amountReceived : total;
        if (cashAmt < total) {
          throw new BadRequestException('Cash received is less than total due');
        }
        const change = cashAmt - total;

        await tx.retailPayment.create({
          data: {
            orderId: order.id,
            method: PaymentMethod.CASH,
            amount: total,
            status: RetailPaymentStatus.PAID,
            reconciliationStatus: 'MATCHED',
            providerRequestId,
            metadata: {
              amountReceived: cashAmt,
              changeDue: change
            }
          }
        });
      } else {
        // Card reader/terminal integration
        let transactionId: string | undefined = undefined;
        let providerName: string | undefined = undefined;

        if (terminalId) {
          const terminal = await tx.posTerminal.findUnique({
            where: { id: terminalId },
          });
          if (!terminal) {
            throw new NotFoundException('Terminal not found');
          }
          if (terminal.branchId !== branchId) {
            throw new BadRequestException('Terminal does not belong to the selected branch');
          }

          providerName = terminal.provider || 'STRIPE';
          const connector = this.getConnector(providerName);
          if (connector && connector.initiatePayment) {
            const result = await connector.initiatePayment(organizationId, {
              internalPaymentIntentId: order.id,
              amount: total,
              currency: 'AUD',
              providerTerminalId: terminal.externalId || terminal.id,
              idempotencyKey: providerRequestId || `idem-${Date.now()}`
            });
            transactionId = result.providerTransactionId;
          }
        }

        await tx.retailPayment.create({
          data: {
            orderId: order.id,
            method: paymentMethod,
            provider: providerName,
            transactionId,
            providerRequestId,
            amount: total,
            status: RetailPaymentStatus.PENDING,
            reconciliationStatus: 'PENDING'
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: customerId || 'SYSTEM',
          actorType: 'USER',
          action: 'order.create',
          resourceType: 'SalesOrder',
          resourceId: order.id,
          changes: { new: order as any }
        }
      });

      // Reload order with items and payments to return complete object
      return tx.salesOrder.findUnique({
        where: { id: order.id },
        include: { items: true, payments: true }
      });
    });
  }

  async cancelSaleOrder(organizationId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.organizationId !== organizationId) {
        throw new ForbiddenException('Order does not belong to your organization');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException('Only PENDING orders can be cancelled');
      }

      // 1. Update order status to CANCELLED
      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // 2. Update associated payments to CANCELLED
      await tx.retailPayment.updateMany({
        where: { orderId },
        data: { status: RetailPaymentStatus.CANCELLED },
      });

      // 3. Roll back (increment) inventory for each item
      for (const item of order.items) {
        await tx.inventory.update({
          where: { branchId_productId: { branchId: order.branchId, productId: item.productId } },
          data: {
            quantity: { increment: item.quantity },
          },
        });

        // Log movement
        await tx.inventoryMovement.create({
          data: {
            branchId: order.branchId,
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            referenceType: 'SALE',
            referenceId: orderId,
            reason: 'Order Cancelled',
            createdBy: 'SYSTEM',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'order.cancel',
          resourceType: 'SalesOrder',
          resourceId: orderId,
          changes: { old: order as any, new: updatedOrder as any }
        }
      });

      return tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true, payments: true }
      });
    });
  }

  async getOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true }
    });
    if (!order || order.organizationId !== organizationId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async listOrders(organizationId: string) {
    return this.prisma.salesOrder.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: true }
    });
  }
}
