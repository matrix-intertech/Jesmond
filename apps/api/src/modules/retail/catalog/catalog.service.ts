import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageCounterService } from '../../subscriptions/services/usage-counter.service';

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    @Optional() private usageCounterService?: UsageCounterService,
  ) {}

  async createProduct(
    organizationId: string,
    userId: string,
    data: {
      sku?: string;
      barcode?: string | null;
      name: string;
      sellingPrice: number;
      imageUrl?: string;
    },
  ) {
    if (!data.imageUrl || data.imageUrl.trim() === '') {
      throw new BadRequestException('Image is required for retail products');
    }
    if (!data.imageUrl.startsWith('http')) {
      throw new BadRequestException('Invalid image URL');
    }

    const cleanBarcode = data.barcode ? data.barcode.trim() : null;
    if (cleanBarcode) {
      const existingBarcode = await this.prisma.product.findFirst({
        where: {
          organizationId,
          barcode: cleanBarcode,
        },
      });
      if (existingBarcode) {
        throw new ConflictException(
          `Barcode ${cleanBarcode} is already assigned to product "${existingBarcode.name}" in this organization`,
        );
      }
    }

    try {
      const useTx =
        this.usageCounterService &&
        typeof this.prisma.$transaction === 'function';

      const product = useTx
        ? await this.prisma.$transaction(async (tx) => {
            await this.usageCounterService!.enforceAndIncrementInTransaction(
              tx,
              organizationId,
              'RETAIL_PRODUCTS',
              1,
            );
            const created = await tx.product.create({
              data: {
                organizationId,
                sku: data.sku,
                barcode: cleanBarcode,
                name: data.name,
                sellingPrice: data.sellingPrice,
                imageUrl: data.imageUrl!,
              },
            });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                actorType: 'USER',
                action: 'product.create',
                resourceType: 'Product',
                resourceId: created.id,
                changes: { new: created as any },
              },
            });
            return created;
          })
        : await (async () => {
            const created = await this.prisma.product.create({
              data: {
                organizationId,
                sku: data.sku,
                barcode: cleanBarcode,
                name: data.name,
                sellingPrice: data.sellingPrice,
                imageUrl: data.imageUrl!,
              },
            });
            await this.prisma.auditLog.create({
              data: {
                actorId: userId,
                actorType: 'USER',
                action: 'product.create',
                resourceType: 'Product',
                resourceId: created.id,
                changes: { new: created as any },
              },
            });
            return created;
          })();

      return product;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
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
    data: {
      sku?: string;
      barcode?: string | null;
      name?: string;
      sellingPrice?: number;
      imageUrl?: string;
      isActive?: boolean;
    },
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

    let finalBarcode = existing.barcode;
    if (data.barcode !== undefined) {
      const cleanBarcode = data.barcode ? data.barcode.trim() : null;
      if (cleanBarcode && cleanBarcode !== existing.barcode) {
        const existingBarcode = await this.prisma.product.findFirst({
          where: {
            organizationId,
            barcode: cleanBarcode,
            NOT: { id: productId },
          },
        });
        if (existingBarcode) {
          throw new ConflictException(
            `Barcode ${cleanBarcode} is already assigned to product "${existingBarcode.name}" in this organization`,
          );
        }
      }
      finalBarcode = cleanBarcode;
    }

    try {
      const nextIsActive =
        data.isActive !== undefined ? data.isActive : existing.isActive;
      const deactivating = existing.isActive && nextIsActive === false;
      const restoring = !existing.isActive && nextIsActive === true;
      const useTx =
        this.usageCounterService &&
        typeof this.prisma.$transaction === 'function' &&
        (deactivating || restoring);

      const updateData = {
        sku: data.sku !== undefined ? data.sku : existing.sku,
        barcode: finalBarcode,
        name: data.name !== undefined ? data.name : existing.name,
        sellingPrice:
          data.sellingPrice !== undefined
            ? data.sellingPrice
            : existing.sellingPrice,
        imageUrl:
          data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
        isActive: nextIsActive,
      };

      const product = useTx
        ? await this.prisma.$transaction(async (tx) => {
            let currentActive = existing.isActive;
            if (typeof (tx as any).$queryRaw === 'function') {
              const rows = await (tx as any).$queryRaw<
                Array<{ isActive: boolean }>
              >`SELECT "isActive" FROM "Product" WHERE id = ${productId} FOR UPDATE`;
              if (rows[0]) {
                currentActive = rows[0].isActive;
              }
            }
            const txDeactivating = currentActive && nextIsActive === false;
            const txRestoring = !currentActive && nextIsActive === true;

            if (txRestoring) {
              await this.usageCounterService!.enforceAndIncrementInTransaction(
                tx,
                organizationId,
                'RETAIL_PRODUCTS',
                1,
              );
            }
            const updated = await tx.product.update({
              where: { id: productId },
              data: updateData,
            });
            if (txDeactivating) {
              await this.usageCounterService!.decrementCounterInTransaction(
                tx,
                organizationId,
                'RETAIL_PRODUCTS',
                1,
              );
            }
            await tx.auditLog.create({
              data: {
                actorId: userId,
                actorType: 'USER',
                action: 'product.update',
                resourceType: 'Product',
                resourceId: updated.id,
                changes: { old: existing as any, new: updated as any },
              },
            });
            return updated;
          })
        : await (async () => {
            const updated = await this.prisma.product.update({
              where: { id: productId },
              data: updateData,
            });
            await this.prisma.auditLog.create({
              data: {
                actorId: userId,
                actorType: 'USER',
                action: 'product.update',
                resourceType: 'Product',
                resourceId: updated.id,
                changes: { old: existing as any, new: updated as any },
              },
            });
            return updated;
          })();

      return product;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error && error.code === 'P2002') {
        throw new ConflictException('SKU must be unique for the organization');
      }
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  async lookupBarcode(
    organizationId: string,
    rawBarcode: string,
    branchId?: string,
  ) {
    if (!rawBarcode || typeof rawBarcode !== 'string' || !rawBarcode.trim()) {
      throw new BadRequestException('Valid barcode string is required');
    }

    const cleanBarcode = rawBarcode.trim();

    if (branchId) {
      const branch = await this.prisma.retailBranch.findFirst({
        where: { id: branchId, organizationId },
      });
      if (!branch) {
        throw new ForbiddenException('Branch does not exist or access denied');
      }
    }

    // Look up by barcode first, fallback to SKU
    const product = await this.prisma.product.findFirst({
      where: {
        organizationId,
        OR: [
          { barcode: cleanBarcode },
          { sku: cleanBarcode },
        ],
      },
      include: {
        category: true,
        inventory: branchId
          ? {
              where: { branchId },
            }
          : true,
      },
    });

    if (!product) {
      return {
        found: false,
        barcode: cleanBarcode,
        message: `Product with barcode or SKU '${cleanBarcode}' was not found.`,
      };
    }

    const branchQty = branchId
      ? product.inventory?.[0]?.quantity ?? 0
      : product.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) ?? 0;

    return {
      found: true,
      inactive: !product.isActive,
      barcode: cleanBarcode,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        taxRate: product.taxRate,
        unit: product.unit,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        category: product.category
          ? { id: product.category.id, name: product.category.name }
          : null,
        quantity: branchQty,
        branchId: branchId || null,
        outOfStock: branchQty <= 0,
      },
    };
  }

  async getCatalog(
    organizationId: string,
    query: {
      branchId?: string;
      search?: string;
      category?: string;
      active?: boolean;
    },
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
        ...(query.branchId
          ? {
              inventory: {
                where: { branchId: query.branchId },
              },
            }
          : {}),
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
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        category: product.category
          ? { id: product.category.id, name: product.category.name }
          : null,
        quantity,
      };
    });
  }
}
