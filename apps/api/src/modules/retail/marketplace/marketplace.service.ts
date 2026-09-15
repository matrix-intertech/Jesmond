import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentType, OrderSource, OrderStatus } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async listStores(lat?: number, lng?: number, radius?: number) {
    // Return active branches. In a real app with PostGIS we'd calculate distance.
    // Here we'll just return all active branches for retail orgs.
    return this.prisma.retailBranch.findMany({
      where: {
        isActive: true,
        organization: {
          status: 'VERIFIED',
          type: 'RETAIL',
        },
      },
      include: {
        organization: {
          select: {
            name: true,
            branding: true,
          },
        },
      },
    });
  }

  async getStoreCatalog(branchId: string) {
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch || !branch.isActive) {
      throw new NotFoundException('Store not found or inactive');
    }

    // Only return products with inventory > 0 for this branch
    const inventory = await this.prisma.inventory.findMany({
      where: {
        branchId,
        quantity: { gt: 0 }, // Only available stock
        product: {
          isActive: true,
          imageUrl: { not: null },
        },
      },
      include: {
        product: true,
      },
    });

    return {
      branch,
      catalog: inventory.map(inv => ({
        ...inv.product,
        availableQuantity: inv.quantity - inv.reservedQuantity,
      })),
    };
  }

  async checkout(userId: string, data: any) {
    const { branchId, items, fulfillmentType } = data; // items: { productId: string, quantity: number }[]

    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
      include: { organization: true },
    });

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Store not found or inactive');
    }

    if (fulfillmentType === 'DELIVERY' && !branch.deliveryEnabled) {
      throw new BadRequestException('Delivery is not available for this store');
    }
    if (fulfillmentType === 'TAKEAWAY' && !branch.takeawayEnabled) {
      throw new BadRequestException('Takeaway is not available for this store');
    }

    // Validate and create order inside a transaction
    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        // Find product and inventory
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.isActive || product.organizationId !== branch.organizationId) {
          throw new BadRequestException(`Product ${item.productId} is unavailable`);
        }

        const inv = await tx.inventory.findUnique({
          where: { branchId_productId: { branchId, productId: item.productId } },
        });

        if (!inv || (inv.quantity - inv.reservedQuantity) < item.quantity) {
          throw new BadRequestException(`Insufficient inventory for product ${product.name}`);
        }

        // Atomic deduction to avoid race condition
        const result = await tx.inventory.updateMany({
          where: {
             branchId,
             productId: item.productId,
             quantity: { gte: item.quantity + inv.reservedQuantity }
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        if (result.count === 0) {
          throw new BadRequestException(`Insufficient inventory for product ${product.name} (checked out concurrently)`);
        }

        // Add inventory movement
        await tx.inventoryMovement.create({
          data: {
            branchId,
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            referenceType: 'SALE',
            reason: 'Marketplace Order',
            createdBy: userId,
          }
        });

        const lineTotal = product.sellingPrice * item.quantity;
        subtotal += lineTotal;

        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          lineTotal,
        });
      }

      const tax = 0; // Simplified
      const deliveryFee = fulfillmentType === 'DELIVERY' ? 500 : 0; // Flat $5 for demo
      const total = subtotal + tax + deliveryFee;

      // Ensure customer exists
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');

      let customer = await tx.retailCustomer.findFirst({
        where: { organizationId: branch.organizationId, email: user.email },
      });

      if (!customer) {
        customer = await tx.retailCustomer.create({
          data: {
            organizationId: branch.organizationId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
        });
      }

      // Create Order
      const order = await tx.salesOrder.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          organizationId: branch.organizationId,
          branchId,
          customerId: customer.id,
          status: OrderStatus.PENDING,
          subtotal,
          tax,
          total,
          deliveryFee,
          fulfillmentType: fulfillmentType as FulfillmentType,
          source: OrderSource.ONLINE,
          items: {
            create: orderItems,
          },
        },
      });

      return order;
    });
  }
}
