import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FulfillmentType, OrderSource, OrderStatus } from '@prisma/client';
import { PaymentSettingsService } from '../payments/payment-settings.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private paymentSettingsService: PaymentSettingsService
  ) {}

  async listStores(lat?: number, lng?: number, radius?: number) {
    const cacheKey = `retail:marketplace:stores:${lat ?? 'all'}:${lng ?? 'all'}:${radius ?? 'all'}`;
    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Return active branches. In a real app with PostGIS we'd calculate distance.
    const stores = await this.prisma.retailBranch.findMany({
      where: {
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

    const mappedStores = stores.map(store => ({
      ...store,
      availability: {
        available: store.isActive,
        label: store.isActive ? 'Available' : 'Currently Unavailable',
      }
    }));

    await this.redisService.set(cacheKey, mappedStores, 45); // 45 seconds TTL
    return mappedStores;
  }

  async invalidateStoreCache() {
    await this.redisService.delPattern('retail:marketplace:stores:*');
  }

  async getStoreCatalog(branchId: string) {
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Store not found');
    }

    const isBranchActive = branch.isActive;

    // Return active products for the branch's organization with availability derived from inventory
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: branch.organizationId,
        isActive: true,
      },
      include: {
        inventory: {
          where: { branchId },
        },
      },
      orderBy: { name: 'asc' },
    });

    const catalog = products.map(product => {
      const inv = product.inventory && product.inventory.length > 0 ? product.inventory[0] : null;
      const quantity = inv ? inv.quantity : 0;
      const reservedQuantity = inv ? inv.reservedQuantity : 0;
      const availableQuantity = Math.max(0, quantity - reservedQuantity);

      return {
        ...product,
        availableQuantity,
        isAvailable: isBranchActive && availableQuantity > 0,
        outOfStock: isBranchActive && availableQuantity <= 0,
        availability: {
          available: isBranchActive && availableQuantity > 0,
          outOfStock: isBranchActive && availableQuantity <= 0,
          quantity: availableQuantity,
          label: !isBranchActive ? 'Currently Unavailable' : (availableQuantity > 0 ? 'Available' : 'Out of Stock')
        },
      };
    });

    const paymentSettings = await this.paymentSettingsService.getSettings(branch.organizationId);

    return {
      branch,
      catalog,
      paymentSettings,
    };
  }

  async checkout(userId: string, data: any) {
    const { branchId, items, fulfillmentType, deliveryAddress, idempotencyKey } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryAddress) {
      throw new BadRequestException('Delivery address is required for DELIVERY fulfillment');
    }

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required');
    }

    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
      include: { organization: true },
    });

    if (!branch) {
      throw new NotFoundException('Store not found');
    }
    
    if (!branch.isActive) {
      throw new BadRequestException('Branch is currently unavailable');
    }

    if (fulfillmentType === 'DELIVERY' && !branch.deliveryEnabled) {
      throw new BadRequestException('Delivery is not available for this store');
    }
    if (fulfillmentType === 'TAKEAWAY' && !branch.takeawayEnabled) {
      throw new BadRequestException('Takeaway is not available for this store');
    }

    // Check if idempotent request already succeeded
    const existingOrder = await this.prisma.salesOrder.findFirst({
      where: { organizationId: branch.organizationId, idempotencyKey }
    });
    
    if (existingOrder) {
      // If the customer payload was entirely different for the same key, it's a conflict
      if (existingOrder.customerId) {
        // verify it belongs to same user
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        const existingCustomer = await this.prisma.retailCustomer.findUnique({ where: { id: existingOrder.customerId } });
        if (existingCustomer && user && existingCustomer.email !== user.email) {
          throw new BadRequestException('Idempotency key conflict');
        }
      }
      return existingOrder;
    }

    // Ensure customer exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    let customer = await this.prisma.retailCustomer.findFirst({
      where: { organizationId: branch.organizationId, email: user.email },
    });

    if (!customer) {
      customer = await this.prisma.retailCustomer.create({
        data: {
          organizationId: branch.organizationId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      // Double check idempotency inside transaction
      const existingTx = await tx.salesOrder.findFirst({
        where: { organizationId: branch.organizationId, idempotencyKey }
      });
      if (existingTx) return existingTx;

      let subtotal = 0;
      const orderItems = [];

      const productIds = Array.from(new Set(items.map((i: any) => i.productId))) as string[];
      const fetchedProducts = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: branch.organizationId,
          isActive: true,
        },
      });
      const productMap = new Map(fetchedProducts.map(p => [p.id, p]));

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} is unavailable`);
        }

        const inv = await tx.inventory.findUnique({
          where: { branchId_productId: { branchId, productId: item.productId } },
        });

        if (!inv || (inv.quantity - inv.reservedQuantity) < item.quantity) {
          throw new BadRequestException(`Insufficient inventory for product ${product.name}`);
        }

        // Atomically increment reserved quantity
        const result = await tx.inventory.updateMany({
          where: {
             branchId,
             productId: item.productId,
             quantity: { gte: inv.reservedQuantity + item.quantity } // Ensure enough left
          },
          data: {
             reservedQuantity: { increment: item.quantity },
          },
        });

        if (result.count === 0) {
          throw new BadRequestException(`Insufficient inventory for product ${product.name} (checked out concurrently)`);
        }

        const lineTotal = product.sellingPrice * item.quantity;
        subtotal += lineTotal;

        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          lineTotal,
        });
      }

      const tax = 0;
      const deliveryFee = fulfillmentType === 'DELIVERY' ? 500 : 0; 
      const total = subtotal + tax + deliveryFee;

      const order = await tx.salesOrder.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          organizationId: branch.organizationId,
          branchId,
          customerId: customer.id,
          status: 'PENDING',
          subtotal,
          tax,
          total,
          deliveryFee,
          fulfillmentType,
          deliveryAddress: deliveryAddress ? deliveryAddress : null,
          idempotencyKey,
          source: 'ONLINE',
          items: {
            create: orderItems,
          },
        },
      });

      return order;
    });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        const existingOrder = await this.prisma.salesOrder.findFirst({
          where: { organizationId: branch.organizationId, idempotencyKey }
        });
        if (existingOrder) {
          // Verify customer match
          if (existingOrder.customerId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            const existingCustomer = await this.prisma.retailCustomer.findUnique({ where: { id: existingOrder.customerId as string } });
            if (existingCustomer && user && existingCustomer.email !== user.email) {
              throw new BadRequestException('Idempotency key conflict');
            }
          }
          return existingOrder;
        }
      }
      throw error;
    }
  }


  async getOrder(userId: string, orderId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true }
        },
        payments: true,
        branch: {
          select: { name: true, organization: { select: { name: true } } }
        }
      }
    });

    if (!order) throw new NotFoundException('Order not found');

    // Securely match customer to user
    const customer = await this.prisma.retailCustomer.findUnique({ where: { id: order.customerId as string } });
    if (!customer || customer.email !== user.email) {
      throw new ForbiddenException('Order belongs to a different user');
    }

    return order;
  }
}
