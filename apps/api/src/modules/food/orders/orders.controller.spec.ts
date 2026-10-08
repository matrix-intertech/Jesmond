import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';

describe('Food OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrisma = {
    retailBranch: { findUnique: jest.fn() },
    foodMenuItem: { findMany: jest.fn() },
    foodOrder: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  const mockUser = { id: 'user-1', organizationId: 'org-food-1' };
  const mockReq = { user: mockUser };

  describe('createOrder tests (Phase 5F Requirements)', () => {
    it('1. authenticated Food user can create order', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Burger',
          price: 1500,
          isActive: true,
          category: { menu: { branchId: 'branch-1', organizationId: 'org-food-1' } }
        }
      ]);
      mockPrisma.foodOrder.create.mockResolvedValue({ id: 'order-1', status: 'PENDING' });

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 2 }] };
      const res = await controller.createOrder(mockReq, dto);
      expect(res).toEqual({ id: 'order-1', status: 'PENDING' });
    });

    it('7. Food user cannot use another organizations branch', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-2',
        organizationId: 'org-other-1',
        organization: { businessCategory: 'FOOD' }
      });

      const dto: CreateFoodOrderDto = { branchId: 'branch-2', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      await expect(controller.createOrder(mockReq, dto)).rejects.toThrow(BadRequestException);
    });

    it('8. Food user cannot order another organizations item', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Burger',
          price: 1500,
          isActive: true,
          category: { menu: { branchId: 'branch-1', organizationId: 'org-other-1' } }
        }
      ]);

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      await expect(controller.createOrder(mockReq, dto)).rejects.toThrow('does not belong to your organization');
    });

    it('9. inactive menu item rejected', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Burger',
          price: 1500,
          isActive: false, // inactive!
          category: { menu: { branchId: 'branch-1', organizationId: 'org-food-1' } }
        }
      ]);

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      await expect(controller.createOrder(mockReq, dto)).rejects.toThrow('is inactive');
    });

    it('10. nonexistent menu item rejected', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([]); // returns empty

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      await expect(controller.createOrder(mockReq, dto)).rejects.toThrow('not found');
    });

    it('17. duplicate item IDs rejected', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      
      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [
        { foodMenuItemId: 'item-1', quantity: 1 },
        { foodMenuItemId: 'item-1', quantity: 2 } // duplicate
      ] };
      await expect(controller.createOrder(mockReq, dto)).rejects.toThrow('Duplicate menu items in order');
    });

    it('22, 23. item name and price snapshot created (11, 12, 13 client prices ignored, 19 lineTotal, 20 subtotal, 21 total)', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          name: 'Burger',
          price: 1500, // authoritative price
          isActive: true,
          category: { menu: { branchId: 'branch-1', organizationId: 'org-food-1' } }
        }
      ]);
      mockPrisma.foodOrder.create.mockResolvedValue({ id: 'order-1', status: 'PENDING' });

      const dto: any = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 2, unitPrice: 1, lineTotal: 1 }] };
      // client unitPrice and lineTotal are completely ignored by the DTO and service payload
      
      await controller.createOrder(mockReq, dto);
      
      expect(mockPrisma.foodOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 3000,
          total: 3000,
          items: {
            create: [
              {
                foodMenuItemId: 'item-1',
                itemName: 'Burger', // snapshot name
                unitPrice: 1500,    // snapshot price
                quantity: 2,
                lineTotal: 3000     // 1500 * 2
              }
            ]
          }
        })
      }));
    });

    it('24. repeated idempotency key does not duplicate order', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      
      // existing order with same user
      mockPrisma.foodOrder.findUnique.mockResolvedValue({
        id: 'order-existing',
        userId: 'user-1',
      });

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      const res = await controller.createOrder(mockReq, dto, 'key123');
      
      // should return existing without creating new one
      expect(res).toEqual({ id: 'order-existing', userId: 'user-1' });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('25. same idempotency key from another user is rejected', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-food-1',
        organization: { businessCategory: 'FOOD' }
      });
      
      // existing order with DIFFERENT user
      mockPrisma.foodOrder.findUnique.mockResolvedValue({
        id: 'order-existing',
        userId: 'user-other',
      });

      const dto: CreateFoodOrderDto = { branchId: 'branch-1', items: [{ foodMenuItemId: 'item-1', quantity: 1 }] };
      await expect(controller.createOrder(mockReq, dto, 'key123')).rejects.toThrow(ConflictException);
    });
  });
});
