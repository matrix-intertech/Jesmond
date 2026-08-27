import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async createProduct(organizationId: string, userId: string, data: { sku?: string; name: string; sellingPrice: number }) {
    try {
      const product = await this.prisma.product.create({
        data: {
          organizationId,
          sku: data.sku,
          name: data.name,
          sellingPrice: data.sellingPrice,
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
}
