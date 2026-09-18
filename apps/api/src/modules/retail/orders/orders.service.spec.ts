import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      salesOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: InventoryService, useValue: { deductInventoryForSale: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listOrders with pagination', () => {
    it('should return paginated data with meta metadata when page & limit are passed', async () => {
      const mockOrders = [{ id: 'ord-1', orderNumber: 'ORD-1' }];
      prismaMock.salesOrder.findMany.mockResolvedValue(mockOrders);
      prismaMock.salesOrder.count.mockResolvedValue(45);

      const result = await service.listOrders('org-1', undefined, 2, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect((result as any).meta).toEqual({
        page: 2,
        limit: 10,
        total: 45,
        totalPages: 5,
      });
      expect(prismaMock.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should cap limit to maximum 100', async () => {
      prismaMock.salesOrder.findMany.mockResolvedValue([]);
      prismaMock.salesOrder.count.mockResolvedValue(0);

      const result = await service.listOrders('org-1', undefined, 1, 500);
      expect((result as any).meta.limit).toBe(100);
    });
  });

  describe('getOrderStats', () => {
    it('should aggregate status counts and today revenue', async () => {
      prismaMock.salesOrder.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { _all: 3 } },
        { status: 'DELIVERED', _count: { _all: 8 } },
      ]);
      prismaMock.salesOrder.count.mockResolvedValue(11);
      prismaMock.salesOrder.aggregate.mockResolvedValue({
        _sum: { total: 4500 },
      });

      const stats = await service.getOrderStats('org-1');

      expect(stats.totalOrders).toBe(11);
      expect(stats.todayRevenue).toBe(4500);
      expect(stats.statusCounts.pending).toBe(3);
      expect(stats.statusCounts.delivered).toBe(8);
      expect(stats.statusCounts.accepted).toBe(0);
    });
  });
});
