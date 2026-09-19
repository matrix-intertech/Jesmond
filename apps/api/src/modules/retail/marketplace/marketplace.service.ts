import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FulfillmentType, OrderSource, OrderStatus } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService
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

    return {
      branch,
      catalog,
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

    // Validate and create order inside a transaction
    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItems = [];

      // Phase 1D: Batched Product Lookup (Eliminates N+1 query overhead while preserving branch & org validation)
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
