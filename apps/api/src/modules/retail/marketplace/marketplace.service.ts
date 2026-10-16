import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FulfillmentType, OrderSource, OrderStatus } from '@prisma/client';
import { PaymentSettingsService } from '../payments/payment-settings.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private paymentSettingsService: PaymentSettingsService,
  ) {}

  async listStores(
    lat?: number,
    lng?: number,
    radius?: number,
    category?: string,
    q?: string,
    suburb?: string,
    verifiedOnly?: boolean,
    openNow?: boolean,
    page?: number,
    limit?: number,
  ) {
    const searchQuery = (q ?? '').trim();
    const hasSearch = searchQuery.length > 0;
    const cleanSuburb = typeof suburb === 'string' ? suburb.trim() : '';
    const hasSuburb = cleanSuburb.length > 0 && cleanSuburb !== 'ALL';
    const isFiltered = (category && category !== 'ALL') || hasSuburb || verifiedOnly !== undefined || openNow !== undefined;
    const isPaginated = page !== undefined || limit !== undefined;

    // ----------------------------------------------------------------
    // Classic fast-path for unparameterised/legacy calls (e.g. unit tests,
    // callers passing only lat, lng, radius, category).
    // Returns plain Array for 100% backward compatibility.
    // ----------------------------------------------------------------
    if (!hasSearch && !hasSuburb && verifiedOnly === undefined && openNow === undefined && !isPaginated) {
      const cacheKey = `retail:marketplace:stores:${lat ?? 'all'}:${lng ?? 'all'}:${radius ?? 'all'}:${category ?? 'all'}`;
      const cached = await this.redisService.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const stores = await this.prisma.retailBranch.findMany({
        where: {
          organization: {
            deletedAt: null,
            status: 'VERIFIED',
            type: 'RETAIL',
            businessCategory: category ? (category as any) : undefined,
          },
        },
        include: {
          organization: {
            select: {
              name: true,
              branding: true,
              businessCategory: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      const mappedStores = stores.map((store) => ({
        ...store,
        matchedMenuItems: [] as any[],
        availability: {
          available: store.isActive,
          label: store.isActive ? 'Available' : 'Currently Unavailable',
        },
      }));

      await this.redisService.set(cacheKey, mappedStores, 45);
      return mappedStores;
    }

    // ----------------------------------------------------------------
    // Extended search & filter path
    // ----------------------------------------------------------------
    // Safe pagination validation at service layer:
    // Non-integer, zero, negative, NaN fallback safely (page -> 1, limit -> 20, max limit -> 100)
    const pageNum = typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : 1;
    const limitNum = typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? Math.min(100, limit) : 20;

    // Build organization-level filter:
    // - Always exclude soft-deleted organizations (deletedAt: null)
    // - Always exclude SUSPENDED and REJECTED organizations
    // - When verifiedOnly === true, restrict to VERIFIED organizations
    // - When verifiedOnly === false (default), include VERIFIED and PENDING
    const orgWhere: any = {
      type: 'RETAIL',
      deletedAt: null,
      status: verifiedOnly === true ? 'VERIFIED' : { in: ['VERIFIED', 'PENDING'] },
    };
    if (category && category !== 'ALL') {
      orgWhere.businessCategory = category as any;
    }

    // Build branch-level filter
    const branchWhere: any = { organization: orgWhere };
    // Default requirement: "Open now: ON"
    if (openNow === true) {
      branchWhere.isActive = true;
    }
    if (hasSuburb) {
      // Known limitation: RetailBranch schema does not link to the structured Suburb model (unlike Property.suburbId);
      // address substring matching is used on the freeform address text.
      branchWhere.address = { contains: cleanSuburb, mode: 'insensitive' };
    }

    // Cache unsearched filtered queries
    const cacheKey = !hasSearch
      ? `retail:marketplace:stores:v3:${lat ?? 'all'}:${lng ?? 'all'}:${radius ?? 'all'}:${category ?? 'all'}:sb=${cleanSuburb || 'all'}:vf=${verifiedOnly ? 1 : 0}:on=${openNow === false ? 0 : 1}:p=${pageNum}:l=${limitNum}`
      : null;

    if (cacheKey) {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) return cached;
    }

    // Simple path — no keyword search
    if (!hasSearch) {
      const skip = (pageNum - 1) * limitNum;
      const [stores, totalCount] = await Promise.all([
        this.prisma.retailBranch.findMany({
          where: branchWhere,
          include: {
            organization: {
              select: {
                name: true,
                branding: true,
                businessCategory: true,
              },
            },
          },
          skip,
          take: limitNum,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        typeof this.prisma.retailBranch.count === 'function'
          ? this.prisma.retailBranch.count({ where: branchWhere })
          : Promise.resolve(0),
      ]);

      const mappedStores = stores.map((store) => ({
        ...store,
        matchedMenuItems: [] as any[],
        availability: {
          available: store.isActive,
          label: store.isActive ? 'Available' : 'Currently Unavailable',
        },
      }));

      const total = totalCount || mappedStores.length;
      const result = {
        data: mappedStores,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      if (cacheKey) {
        await this.redisService.set(cacheKey, result, 45);
      }
      return result;
    }

    // ----------------------------------------------------------------
    // Search path — find matching branch IDs from multiple dimensions:
    // 1. Business / branch name, address, organization name
    // 2. Food menu items (dish name & description)
    // 3. Food menu categories / cuisines
    // 4. Business services & relevant keywords
    // 5. Retail products (name, description, SKU)
    //
    // Concurrent execution with Promise.all across independent queries.
    // ----------------------------------------------------------------
    const ilike = () => ({ contains: searchQuery, mode: 'insensitive' as const });

    const [
      directMatches,
      menuItemMatches,
      foodCategoryMatches,
      serviceMatches,
      productMatches,
    ] = await Promise.all([
      // Phase 1: direct branch / org matches
      this.prisma.retailBranch.findMany({
        where: {
          ...branchWhere,
          OR: [
            { name: ilike() },
            { address: ilike() },
            { organization: { ...orgWhere, name: ilike() } },
          ],
        },
        select: { id: true },
      }),

      // Phase 2a: restaurant menu items (dishes & descriptions)
      this.prisma.foodMenuItem.findMany({
        where: {
          isActive: true,
          OR: [{ name: ilike() }, { description: ilike() }],
          category: {
            isActive: true,
            menu: {
              isActive: true,
              branch: branchWhere,
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: {
            select: {
              menu: { select: { branchId: true } },
            },
          },
        },
      }),

      // Phase 2b: food menu categories (cuisines, meal categories)
      this.prisma.foodMenuCategory.findMany({
        where: {
          isActive: true,
          OR: [{ name: ilike() }, { description: ilike() }],
          menu: {
            isActive: true,
            branch: branchWhere,
          },
        },
        select: {
          menu: { select: { branchId: true } },
        },
      }),

      // Phase 2c: business services (mechanics, cleaning, consulting, etc.)
      this.prisma.businessService.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [{ name: ilike() }, { description: ilike() }],
          branch: branchWhere,
        },
        select: { branchId: true },
      }),

      // Phase 2d: retail products (SKU, product name & description)
      this.prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ name: ilike() }, { description: ilike() }, { sku: ilike() }],
          organization: orgWhere,
        },
        select: {
          organization: {
            select: {
              RetailBranch: {
                where: branchWhere,
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const matchedBranchIds = new Set<string>();
    for (const b of directMatches) {
      matchedBranchIds.add(b.id);
    }

    // Group menu items by branchId for inclusion on restaurant cards
    const menuItemsByBranch = new Map<string, any[]>();
    for (const item of menuItemMatches) {
      const branchId = item.category.menu.branchId;
      matchedBranchIds.add(branchId);
      if (!menuItemsByBranch.has(branchId)) {
        menuItemsByBranch.set(branchId, []);
      }
      menuItemsByBranch.get(branchId)!.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
      });
    }

    for (const c of foodCategoryMatches) {
      matchedBranchIds.add(c.menu.branchId);
    }

    for (const svc of serviceMatches) {
      matchedBranchIds.add(svc.branchId);
    }

    for (const prod of productMatches) {
      for (const b of prod.organization.RetailBranch) {
        matchedBranchIds.add(b.id);
      }
    }

    if (matchedBranchIds.size === 0) {
      return { data: [], meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } };
    }

    // Deterministic ID sorting before pagination slicing ensures stable, non-overlapping pages
    const allIds = Array.from(matchedBranchIds).sort((a, b) => a.localeCompare(b));
    const total = allIds.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedIds = allIds.slice(skip, skip + limitNum);

    const fullBranches = await this.prisma.retailBranch.findMany({
      where: {
        id: { in: paginatedIds },
        ...branchWhere,
      },
      include: {
        organization: {
          select: {
            name: true,
            branding: true,
            businessCategory: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const mappedStores = fullBranches.map((store) => ({
      ...store,
      matchedMenuItems: menuItemsByBranch.get(store.id) ?? [],
      availability: {
        available: store.isActive,
        label: store.isActive ? 'Available' : 'Currently Unavailable',
      },
    }));

    return {
      data: mappedStores,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async invalidateStoreCache() {
    await this.redisService.delPattern('retail:marketplace:stores:*');
  }

  async getStoreCatalog(branchId: string) {
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
      include: {
        organization: {
          select: { name: true, businessCategory: true },
        },
      },
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

    const catalog = products.map((product) => {
      const inv =
        product.inventory && product.inventory.length > 0
          ? product.inventory[0]
          : null;
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
          label: !isBranchActive
            ? 'Currently Unavailable'
            : availableQuantity > 0
              ? 'Available'
              : 'Out of Stock',
        },
      };
    });

    const paymentSettings = await this.paymentSettingsService.getSettings(
      branch.organizationId,
    );

    return {
      branch,
      catalog,
      paymentSettings,
    };
  }

  async checkout(userId: string, data: CheckoutDto) {
    const { branchId, items, fulfillmentType, idempotencyKey } = data;
    let { deliveryAddress } = data;
    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryAddress) {
      throw new BadRequestException(
        'Delivery address is required for DELIVERY fulfillment',
      );
    }

    if (fulfillmentType !== 'DELIVERY') {
      deliveryAddress = undefined; // Force null/undefined for non-delivery
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
      where: { organizationId: branch.organizationId, idempotencyKey },
    });

    if (existingOrder) {
      // If the customer payload was entirely different for the same key, it's a conflict
      if (existingOrder.customerId) {
        // verify it belongs to same user
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        const existingCustomer = await this.prisma.retailCustomer.findUnique({
          where: { id: existingOrder.customerId },
        });
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
          where: { organizationId: branch.organizationId, idempotencyKey },
        });
        if (existingTx) return existingTx;

        let subtotal = 0;
        const orderItems = [];

        const productIds = Array.from(
          new Set(items.map((i: any) => i.productId)),
        ) as string[];
        const fetchedProducts = await tx.product.findMany({
          where: {
            id: { in: productIds },
            organizationId: branch.organizationId,
            isActive: true,
          },
        });
        const productMap = new Map(fetchedProducts.map((p) => [p.id, p]));

        for (const item of items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new BadRequestException(
              `Product ${item.productId} is unavailable`,
            );
          }

          const inv = await tx.inventory.findUnique({
            where: {
              branchId_productId: { branchId, productId: item.productId },
            },
          });

          if (!inv || inv.quantity - inv.reservedQuantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient inventory for product ${product.name}`,
            );
          }

          // Atomically increment reserved quantity
          const result = await tx.inventory.updateMany({
            where: {
              branchId,
              productId: item.productId,
              quantity: { gte: inv.reservedQuantity + item.quantity }, // Ensure enough left
            },
            data: {
              reservedQuantity: { increment: item.quantity },
            },
          });

          if (result.count === 0) {
            throw new BadRequestException(
              `Insufficient inventory for product ${product.name} (checked out concurrently)`,
            );
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
            deliveryAddress: deliveryAddress
              ? (deliveryAddress as any)
              : undefined,
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
      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('idempotencyKey')
      ) {
        const existingOrder = await this.prisma.salesOrder.findFirst({
          where: { organizationId: branch.organizationId, idempotencyKey },
        });
        if (existingOrder) {
          // Verify customer match
          if (existingOrder.customerId) {
            const user = await this.prisma.user.findUnique({
              where: { id: userId },
            });
            const existingCustomer =
              await this.prisma.retailCustomer.findUnique({
                where: { id: existingOrder.customerId },
              });
            if (
              existingCustomer &&
              user &&
              existingCustomer.email !== user.email
            ) {
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
          include: { product: true },
        },
        payments: true,
        branch: {
          select: { name: true, organization: { select: { name: true } } },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Securely match customer to user
    const customer = await this.prisma.retailCustomer.findUnique({
      where: { id: order.customerId as string },
    });
    if (!customer || customer.email !== user.email) {
      throw new ForbiddenException('Order belongs to a different user');
    }

    return order;
  }
}
