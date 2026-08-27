import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService
  ) {}

  /**
   * Phase 9: Transaction safe order creation and inventory deduction
   */
  async createSaleOrder(
    organizationId: string,
    branchId: string,
    terminalId: string,
    items: { productId: string; quantity: number; unitPrice: number }[],
    customerId?: string
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Calculate totals
      let subtotal = 0;
      const orderItemsData = items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice;
        subtotal += lineTotal;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        };
      });

      const total = subtotal; // Assuming 0 tax/discount for this foundation

      const orderNumber = `ORD-${Date.now()}`; // Simple generator for foundation

      const order = await tx.salesOrder.create({
        data: {
          organizationId,
          branchId,
          terminalId,
          customerId,
          orderNumber,
          status: 'COMPLETED',
          subtotal,
          tax: 0,
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

      return order;
    });
  }
}
