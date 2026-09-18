import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Adjust inventory levels manually or via sync.
   * This handles creating the movement log atomically.
   */
  async adjustInventory(
    organizationId: string,
    branchId: string,
    productId: string,
    quantity: number,
    userId: string,
    reason: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Verify branch belongs to the authenticated organization
      const branch = await tx.retailBranch.findFirst({
        where: { id: branchId, organizationId },
      });

      if (!branch) {
        throw new ForbiddenException('You do not have access to this branch or it does not exist');
      }

      // Verify product belongs to the authenticated organization
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId },
      });

      if (!product) {
        throw new ForbiddenException('You do not have access to this product or it does not exist');
      }

      // Find current inventory
      const current = await tx.inventory.findUnique({
        where: { branchId_productId: { branchId, productId } },
      });

      const currentQty = current ? current.quantity : 0;
      const newQty = currentQty + quantity;

      if (newQty < 0) {
        throw new BadRequestException('Inventory cannot be negative');
      }

      // Upsert inventory
      const updated = await tx.inventory.upsert({
        where: { branchId_productId: { branchId, productId } },
        update: { quantity: newQty },
        create: {
          branchId,
          productId,
          quantity: newQty,
        },
      });

      // Log movement
      await tx.inventoryMovement.create({
        data: {
          branchId,
          productId,
          type: 'ADJUSTMENT',
          quantity,
          referenceType: 'MANUAL',
          reason,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'inventory.adjust',
          resourceType: 'Inventory',
          resourceId: updated.id,
          changes: { old: current as any, new: updated as any }
        }
      });

      return updated;
    });
  }

  /**
   * Deduct inventory atomically when a sale is completed.
   */
  async deductInventoryForSale(
    tx: Prisma.TransactionClient,
    branchId: string,
    productId: string,
    quantity: number,
    orderId: string
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Deduction quantity must be positive');
    }

    const affected = await tx.inventory.updateMany({
      where: {
        branchId,
        productId,
        quantity: { gte: quantity },
      },
      data: {
        quantity: { decrement: quantity },
      },
    });

    if (affected.count === 0) {
      throw new BadRequestException(`Insufficient inventory for product ${productId}`);
    }

    const updated = await tx.inventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });

    await tx.inventoryMovement.create({
      data: {
        branchId,
        productId,
        type: 'OUT',
        quantity: -quantity,
        referenceType: 'SALE',
        referenceId: orderId,
        reason: 'Order Fulfillment',
        createdBy: 'SYSTEM',
      },
    });

    return updated!;
  }

  /**
   * Fetch inventory for a specific branch, including product details.
   */
  async getInventoryByBranch(organizationId: string, branchId: string) {
    // Verify branch belongs to organization
    const branch = await this.prisma.retailBranch.findFirst({
      where: {
        id: branchId,
        organizationId: organizationId
      }
    });

    if (!branch) {
      throw new ForbiddenException('You do not have access to this branch or it does not exist');
    }

    return this.prisma.inventory.findMany({
      where: { branchId },
      include: {
        product: {
          include: {
            category: true,
          }
        },
      },
    });
  }

  /**
   * Fetch inventory movement history for a branch (and optional product).
   */
  async getInventoryMovements(organizationId: string, branchId: string, productId?: string) {
    const branch = await this.prisma.retailBranch.findFirst({
      where: {
        id: branchId,
        organizationId
      }
    });

    if (!branch) {
      throw new ForbiddenException('You do not have access to this branch or it does not exist');
    }

    const where: any = { branchId };
    if (productId) {
      where.productId = productId;
    }

    return this.prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          }
        }
      }
    });
  }
}
