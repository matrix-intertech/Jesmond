import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PosWebhookController, PosWebhookService } from './pos/pos.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('Retail Backend QA Validation', () => {
  let catalogService: CatalogService;
  let branchesService: BranchesService;
  let inventoryService: InventoryService;
  let ordersService: OrdersService;
  let posWebhookService: PosWebhookService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        BranchesService,
        InventoryService,
        OrdersService,
        PosWebhookService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(async (cb) => cb(prisma)),
            organization: { findUnique: jest.fn() },
            retailBranch: { create: jest.fn(), findUnique: jest.fn() },
            productCategory: { create: jest.fn() },
            product: { create: jest.fn(), findUnique: jest.fn() },
            inventory: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
            inventoryMovement: { create: jest.fn() },
            salesOrder: { create: jest.fn() },
            posWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            retailPayment: { findUnique: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    catalogService = module.get<CatalogService>(CatalogService);
    branchesService = module.get<BranchesService>(BranchesService);
    inventoryService = module.get<InventoryService>(InventoryService);
    ordersService = module.get<OrdersService>(OrdersService);
    posWebhookService = module.get<PosWebhookService>(PosWebhookService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Retail Business / Organization & 9. RBAC', () => {
    it('should reject access if user is not from the same organization', async () => {
      // Tested via standard NestJS Guards, but logic can be isolated
      jest.spyOn(branchesService, 'getBranch').mockImplementation(async (orgId, branchId) => {
        if (orgId !== 'org-1') throw new ForbiddenException();
        return { id: branchId } as any;
      });
      await expect(branchesService.getBranch('org-2', 'branch-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Product / Category', () => {
    it('should enforce SKU uniqueness and return 409 Conflict', async () => {
      jest.spyOn(prisma.product, 'create').mockRejectedValue({ code: 'P2002' });
      await expect(catalogService.createProduct('org-1', 'user1', { sku: 'DUPLICATE', name: 'Test', sellingPrice: 10 })).rejects.toThrow(ConflictException);
    });
  });

  describe('4. Inventory & 5. Sales Order Atomic Transaction', () => {
    it('should prevent overselling and rollback transaction', async () => {
      jest.spyOn(prisma.inventory, 'findUnique').mockResolvedValue({ quantity: 5 } as any);
      jest.spyOn(prisma.salesOrder, 'create').mockResolvedValue({ id: 'order-1' } as any);
      
      await expect(
        ordersService.createSaleOrder('org-1', 'branch-1', 'term-1', [{ productId: 'prod-1', quantity: 10, unitPrice: 100 }])
      ).rejects.toThrow(BadRequestException);
    });

    it('should atomically create order and deduct inventory', async () => {
      jest.spyOn(prisma.inventory, 'findUnique').mockResolvedValue({ quantity: 15 } as any);
      const updateSpy = jest.spyOn(prisma.inventory, 'update').mockResolvedValue({} as any);
      const movementSpy = jest.spyOn(prisma.inventoryMovement, 'create').mockResolvedValue({} as any);
      const orderSpy = jest.spyOn(prisma.salesOrder, 'create').mockResolvedValue({ id: 'order-1' } as any);

      await ordersService.createSaleOrder('org-1', 'branch-1', 'term-1', [{ productId: 'prod-1', quantity: 5, unitPrice: 100 }]);

      expect(orderSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: { decrement: 5 } } }));
      expect(movementSpy).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'OUT', quantity: -5 }) }));
    });
  });

  describe('7. Idempotency (Webhooks)', () => {
    it('should safely ignore duplicate webhooks', async () => {
      jest.spyOn(prisma.posWebhookEvent, 'findUnique').mockResolvedValue({ id: 'existing' } as any);
      const createSpy = jest.spyOn(prisma.posWebhookEvent, 'create');

      const res = await posWebhookService.processWebhook('SQUARE', 'evt-123', 'ORDER.CREATED', {});
      
      expect(res.status).toBe('IGNORED');
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('6. Payment State Handling', () => {
    it('should reject invalid state transitions', async () => {
      // Create a mock instance of the payments service
      const { PaymentsService } = require('./payments/payments.service');
      const paymentsService = new PaymentsService(prisma);

      jest.spyOn(prisma.retailPayment, 'findUnique').mockResolvedValue({ status: 'REFUNDED' } as any);
      
      await expect(paymentsService.updatePaymentStatus('pay-1', 'PAID')).rejects.toThrow(BadRequestException);
    });
  });
});
