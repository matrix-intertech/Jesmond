import { Injectable, ConflictException, InternalServerErrorException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async createProduct(organizationId: string, userId: string, data: { sku?: string; name: string; sellingPrice: number; imageUrl?: string }) {
    if (!data.imageUrl || data.imageUrl.trim() === '') {
      throw new BadRequestException('Image is required for retail products');
    }
    if (!data.imageUrl.startsWith('http')) {
      throw new BadRequestException('Invalid image URL');
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          organizationId,
          sku: data.sku,
          name: data.name,
          sellingPrice: data.sellingPrice,
          imageUrl: data.imageUrl,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'product.create',
          resourceType: 'Product',
          resourceId: product.id,
          changes: { new: product as any }
        }
      });

      return product;
    } catch (error) {
      if (error && error.code === 'P2002') {
        throw new ConflictException('SKU must be unique for the organization');
      }
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async updateProduct(
    organizationId: string,
    userId: string,
    productId: string,
    data: { sku?: string; name?: string; sellingPrice?: number; imageUrl?: string }
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    if (existing.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have access to this product');
    }

    if (data.imageUrl !== undefined) {
      if (data.imageUrl === null || data.imageUrl.trim() === '') {
        throw new BadRequestException('Image is required for retail products');
      }
      if (!data.imageUrl.startsWith('http')) {
        throw new BadRequestException('Invalid image URL');
      }
    }

    try {
      const product = await this.prisma.product.update({
        where: { id: productId },
        data: {
          sku: data.sku !== undefined ? data.sku : existing.sku,
          name: data.name !== undefined ? data.name : existing.name,
          sellingPrice: data.sellingPrice !== undefined ? data.sellingPrice : existing.sellingPrice,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorType: 'USER',
          action: 'product.update',
          resourceType: 'Product',
          resourceId: product.id,
          changes: { old: existing as any, new: product as any },
        },
      });

      return product;
    } catch (error) {
      if (error && error.code === 'P2002') {
        throw new ConflictException('SKU must be unique for the organization');
      }
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  async getCatalog(
    organizationId: string,
    query: {
      branchId?: string;
      search?: string;
      category?: string;
      active?: boolean;
    }
  ) {
    if (query.branchId) {
      const branch = await this.prisma.retailBranch.findUnique({
        where: { id: query.branchId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (branch.organizationId !== organizationId) {
        throw new ForbiddenException('You do not have access to this branch');
      }
    }

    const where: any = {
      organizationId,
    };

    if (query.active !== undefined) {
      where.isActive = query.active;
    } else {
      where.isActive = true;
    }

    if (query.category) {
      where.category = {
        name: {
          equals: query.category,
          mode: 'insensitive',
        },
      };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        ...(query.branchId ? {
          inventory: {
            where: { branchId: query.branchId }
          }
        } : {})
      },
      orderBy: {
        name: 'asc',
      },
    });

    return products.map((product) => {
      const branchInventory = query.branchId ? product.inventory?.[0] : null;
      const quantity = branchInventory ? branchInventory.quantity : 0;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: product.sellingPrice,
        isActive: product.isActive,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        quantity,
      };
    });
  }
}
