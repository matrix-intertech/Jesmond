import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PaymentSettingsService } from '../payments/payment-settings.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prismaMock: any;
  let redisMock: any;
  let paymentSettingsMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      retailBranch: { findMany: jest.fn(), findUnique: jest.fn() },
      product: { findMany: jest.fn(), findUnique: jest.fn() },
      inventory: { findUnique: jest.fn(), updateMany: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      salesOrder: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      retailPayment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      retailCustomer: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    };

    paymentSettingsMock = {
      getSettings: jest.fn().mockResolvedValue({
        onlinePaymentsEnabled: true,
        stripeConfigured: true,
        gateway: 'STRIPE'
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: PaymentSettingsService, useValue: paymentSettingsMock },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
  });

  const setupSuccessCheckoutMocks = () => {
    prismaMock.retailBranch.findUnique.mockResolvedValue({
      id: 'branch-1', isActive: true, organizationId: 'org-1', takeawayEnabled: true, deliveryEnabled: true
    });
    prismaMock.product.findMany.mockResolvedValue([
      { id: 'p-1', name: 'Coffee', sellingPrice: 500, organizationId: 'org-1', isActive: true },
    ]);
    prismaMock.inventory.findUnique.mockResolvedValue({ quantity: 10, reservedQuantity: 0 });
    prismaMock.inventory.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'user@test.com', firstName: 'John', lastName: 'Doe' });
    prismaMock.retailCustomer.findFirst.mockResolvedValue({ id: 'c-1', email: 'user@test.com' });
    prismaMock.salesOrder.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'ORD-123' });
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    prismaMock.retailPayment.create.mockResolvedValue({ id: 'pay-1' });
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Checkout - Delivery and Takeaway Validation', () => {
    it('should require deliveryAddress if fulfillment is DELIVERY', async () => {
      setupSuccessCheckoutMocks();
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'DELIVERY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      await expect(service.checkout('u-1', checkoutData)).rejects.toThrow(BadRequestException);
    });

    it('should succeed DELIVERY if address provided', async () => {
      setupSuccessCheckoutMocks();
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'DELIVERY', paymentMethod: 'CASH', deliveryAddress: { city: 'Sydney' }, items: [{ productId: 'p-1', quantity: 1 }] };
      const order = await service.checkout('u-1', checkoutData);
      expect(order).toBeDefined();
    });

    it('should succeed TAKEAWAY without address', async () => {
      setupSuccessCheckoutMocks();
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      const order = await service.checkout('u-1', checkoutData);
      expect(order).toBeDefined();
    });
  });

  describe('Checkout - Inventory & Pricing', () => {
    it('should rollback if reserved quantity update fails (count 0)', async () => {
      setupSuccessCheckoutMocks();
      prismaMock.inventory.updateMany.mockResolvedValue({ count: 0 }); // simulate concurrent stock out
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      await expect(service.checkout('u-1', checkoutData)).rejects.toThrow('checked out concurrently');
      expect(prismaMock.salesOrder.create).not.toHaveBeenCalled();
    });

    it('should reject checkout if product is inactive', async () => {
      setupSuccessCheckoutMocks();
      prismaMock.product.findMany.mockResolvedValue([
        // simulate product inactive (won't be found in query with isActive: true)
      ]);
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      await expect(service.checkout('u-1', checkoutData)).rejects.toThrow('Product p-1 is unavailable');
    });

    it('should use backend authoritative pricing', async () => {
      setupSuccessCheckoutMocks();
      // Even if frontend passed price, it's ignored.
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 2 }] };
      await service.checkout('u-1', checkoutData);
      // product price is 500
      expect(prismaMock.salesOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ subtotal: 1000, total: 1000 })
      }));
    });
  });

  describe('Checkout - Idempotency', () => {
    it('should return existing order on duplicate idempotencyKey', async () => {
      setupSuccessCheckoutMocks();
      prismaMock.salesOrder.findFirst.mockResolvedValue({ id: 'existing-1', customerId: 'c-1' });
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-1', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      const order = await service.checkout('u-1', checkoutData);
      expect(order.id).toBe('existing-1');
      expect(prismaMock.salesOrder.create).not.toHaveBeenCalled();
    });

    it('should handle P2002 race condition cleanly', async () => {
      setupSuccessCheckoutMocks();
      // Throw P2002 from transaction
      prismaMock.$transaction.mockImplementationOnce(() => {
        const err: any = new Error();
        err.code = 'P2002';
        err.meta = { target: ['idempotencyKey'] };
        throw err;
      });
      // But return existing when caught
      prismaMock.salesOrder.findFirst
        .mockResolvedValueOnce(null) // first check
        .mockResolvedValueOnce({ id: 'race-winner', customerId: 'c-1' }); // caught check
      
      const checkoutData = { branchId: 'branch-1', idempotencyKey: 'k-race', fulfillmentType: 'TAKEAWAY', paymentMethod: 'CASH', items: [{ productId: 'p-1', quantity: 1 }] };
      const order = await service.checkout('u-1', checkoutData);
      expect(order.id).toBe('race-winner');
    });
  });
});
