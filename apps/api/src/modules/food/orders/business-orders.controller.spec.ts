import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { BusinessOrdersController } from './business-orders.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { FoodOrderStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Business Orders (Phase 5H)', () => {
  let controller: BusinessOrdersController;
  let service: OrdersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessOrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            getBusinessOrders: jest.fn(),
            getBusinessOrder: jest.fn(),
            updateOrderStatus: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<BusinessOrdersController>(BusinessOrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  describe('updateOrderStatus', () => {
    it('should call updateOrderStatus with the correct parameters', async () => {
      const req = { user: { organizationId: 'org123', id: 'user123' } };
      await controller.updateOrderStatus(req, 'order123', { status: FoodOrderStatus.ACCEPTED });
      expect(service.updateOrderStatus).toHaveBeenCalledWith('order123', 'org123', FoodOrderStatus.ACCEPTED, 'user123');
    });
  });
});
