import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async createProduct(organizationId: string, data: { sku?: string; name: string; sellingPrice: number }) {
    try {
      return await this.prisma.product.create({
        data: {
          organizationId,
          sku: data.sku,
          name: data.name,
          sellingPrice: data.sellingPrice,
        },
      });
    } catch (error) {
      if (error && error.code === 'P2002') {
        throw new ConflictException('SKU must be unique for the organization');
      }
      throw new InternalServerErrorException('Failed to create product');
    }
  }
}
