import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BadRequestException } from '@nestjs/common';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prismaMock: any;
  let redisMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      retailBranch: { findMany: jest.fn(), findUnique: jest.fn() },
      product: { findMany: jest.fn(), findUnique: jest.fn() },
      inventory: { findUnique: jest.fn(), updateMany: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      salesOrder: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      retailCustomer: { findFirst: jest.fn(), create: jest.fn() },
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listStores Redis Caching', () => {
    it('should return cached stores if Redis cache hit', async () => {
      const mockCached = [{ id: 'b-1', name: 'Cached Branch' }];
      redisMock.get.mockResolvedValue(mockCached);

      const result = await service.listStores();

      expect(result).toEqual(mockCached);
      expect(prismaMock.retailBranch.findMany).not.toHaveBeenCalled();
    });

    it('should query DB and set Redis cache on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);
      const mockStores = [{ id: 'b-1', name: 'DB Branch', isActive: true }];
      prismaMock.retailBranch.findMany.mockResolvedValue(mockStores);

      const result = await service.listStores();

      const expectedStores = [{
        id: 'b-1',
        name: 'DB Branch',
        isActive: true,
        availability: {
          available: true,
          label: 'Available'
        }
      }];

      expect(result).toEqual(expectedStores);
      expect(prismaMock.retailBranch.findMany).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalledWith(expect.stringContaining('retail:marketplace:stores:'), expectedStores, 45);
    });
  });

  describe('checkout Query Batching', () => {
    it('should batch product lookups using in-memory Map', async () => {
      prismaMock.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        isActive: true,
        organizationId: 'org-1',
        takeawayEnabled: true,
      });

      prismaMock.product.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Coffee', sellingPrice: 500, organizationId: 'org-1', isActive: true },
        { id: 'p-2', name: 'Muffin', sellingPrice: 300, organizationId: 'org-1', isActive: true },
      ]);

      prismaMock.inventory.findUnique.mockResolvedValue({ quantity: 10, reservedQuantity: 0 });
      prismaMock.inventory.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'user@test.com', firstName: 'John', lastName: 'Doe' });
      prismaMock.retailCustomer.findFirst.mockResolvedValue({ id: 'c-1' });
      prismaMock.salesOrder.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'ORD-123' });

      const checkoutData = {
        branchId: 'branch-1',
        fulfillmentType: 'TAKEAWAY',
        items: [
          { productId: 'p-1', quantity: 2 },
          { productId: 'p-2', quantity: 1 },
        ],
      };

      const order = await service.checkout('u-1', checkoutData);

      expect(order).toBeDefined();
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['p-1', 'p-2'] },
          organizationId: 'org-1',
          isActive: true,
        },
      });
    });
  });
});
