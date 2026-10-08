import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { randomBytes } from 'crypto';
import { FoodOrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, organizationId: string, dto: CreateFoodOrderDto, idempotencyKey?: string) {
    // 1. Verify branch belongs to organization and is a FOOD business
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: dto.branchId },
      include: { organization: true },
    });

    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    if (branch.organizationId !== organizationId) {
      throw new BadRequestException('Branch does not belong to your organization');
    }

    if (branch.organization.businessCategory !== 'FOOD') {
      throw new BadRequestException('Branch does not belong to a FOOD business');
    }

    // 2. Check Idempotency Key
    if (idempotencyKey) {
      const existingOrder = await this.prisma.foodOrder.findUnique({
        where: { idempotencyKey },
      });

      if (existingOrder) {
        if (existingOrder.userId !== userId) {
          throw new ConflictException('Idempotency key conflict');
        }
        return this.getOrderWithDetails(existingOrder.id);
      }
    }

    // 3. Process items and calculate totals inside a transaction
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Double check idempotency inside transaction to avoid race conditions
        if (idempotencyKey) {
          const existingTxOrder = await tx.foodOrder.findUnique({
            where: { idempotencyKey },
          });
          if (existingTxOrder) {
            if (existingTxOrder.userId !== userId) {
              throw new ConflictException('Idempotency key conflict');
            }
            return existingTxOrder; // Will fetch details later
          }
        }

        const productIds = dto.items.map((i) => i.foodMenuItemId);
        
        // Detect duplicates in request
        if (new Set(productIds).size !== productIds.length) {
          throw new BadRequestException('Duplicate menu items in order');
        }

        const menuItems = await tx.foodMenuItem.findMany({
          where: { id: { in: productIds } },
          include: { category: { include: { menu: true } } },
        });

        const itemMap = new Map(menuItems.map((i) => [i.id, i]));

        const orderItemsToCreate = [];
        let subtotal = 0;

        for (const reqItem of dto.items) {
          const menuItem = itemMap.get(reqItem.foodMenuItemId);

          if (!menuItem) {
            throw new BadRequestException(`Menu item ${reqItem.foodMenuItemId} not found`);
          }

          if (!menuItem.isActive) {
            throw new BadRequestException(`Menu item ${menuItem.name} is inactive`);
          }

          if (menuItem.category.menu.branchId !== dto.branchId) {
            throw new BadRequestException(`Menu item ${menuItem.name} does not belong to the selected branch`);
          }

          if (menuItem.category.menu.organizationId !== organizationId) {
            throw new BadRequestException(`Menu item ${menuItem.name} does not belong to your organization`);
          }

          const lineTotal = menuItem.price * reqItem.quantity;
          subtotal += lineTotal;

          orderItemsToCreate.push({
            foodMenuItemId: menuItem.id,
            itemName: menuItem.name,
            unitPrice: menuItem.price,
            quantity: reqItem.quantity,
            lineTotal,
          });
        }

        const total = subtotal; // No taxes/delivery fees for phase 5F
        const orderNumber = `FOOD-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;

        const order = await tx.foodOrder.create({
          data: {
            orderNumber,
            organizationId,
            branchId: dto.branchId,
            userId,
            status: 'PENDING',
            subtotal,
            total,
            idempotencyKey,
            fulfillmentType: dto.fulfillmentType,
            deliveryAddress: dto.deliveryAddress as any || null,
            paymentMethod: 'CASH',
            items: {
              create: orderItemsToCreate,
            },
            statusHistory: {
              create: [{
                toStatus: 'PENDING',
                changedByUserId: userId,
              }],
            },
          },
          include: {
            items: true,
            branch: { select: { name: true } },
            statusHistory: { orderBy: { createdAt: 'desc' } },
          }
        });

        return order;
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        const existingOrder = await this.prisma.foodOrder.findUnique({
          where: { idempotencyKey: idempotencyKey! },
        });
        if (existingOrder) {
          if (existingOrder.userId !== userId) {
            throw new ConflictException('Idempotency key conflict');
          }
          return this.getOrderWithDetails(existingOrder.id);
        }
      }
      throw error;
    }
  }

  async getOrderWithDetails(orderId: string) {
    return this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        branch: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getOrderForUser(orderId: string, userId: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        branch: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order not found');
    }

    return order;
  }

  async getBusinessOrders(organizationId: string, page: number = 1, limit: number = 20, status?: string, branchId?: string) {
    const take = limit;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }
    if (branchId) {
      where.branchId = branchId;
    }

    const [data, total] = await Promise.all([
      this.prisma.foodOrder.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          branch: { select: { name: true } },
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.foodOrder.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBusinessOrder(orderId: string, organizationId: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        branch: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.organizationId !== organizationId) {
      throw new BadRequestException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(orderId: string, organizationId: string, newStatus: FoodOrderStatus, changedByUserId: string) {
    const order = await this.getBusinessOrder(orderId, organizationId);

    const validTransitions: Record<FoodOrderStatus, FoodOrderStatus[]> = {
      [FoodOrderStatus.PENDING]: [FoodOrderStatus.ACCEPTED, FoodOrderStatus.CANCELLED],
      [FoodOrderStatus.ACCEPTED]: [FoodOrderStatus.PREPARING, FoodOrderStatus.CANCELLED],
      [FoodOrderStatus.PREPARING]: [FoodOrderStatus.READY, FoodOrderStatus.CANCELLED],
      [FoodOrderStatus.READY]: [FoodOrderStatus.COMPLETED],
      [FoodOrderStatus.COMPLETED]: [],
      [FoodOrderStatus.CANCELLED]: [],
    };

    const allowedNext = validTransitions[order.status];
    if (!allowedNext || !allowedNext.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${order.status} to ${newStatus}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.foodOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: newStatus,
              changedByUserId,
            },
          },
        },
        include: {
          items: true,
          branch: { select: { name: true } },
          user: { select: { firstName: true, lastName: true, phone: true } },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });
      return updatedOrder;
    });
  }
}


