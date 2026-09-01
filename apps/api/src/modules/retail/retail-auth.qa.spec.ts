import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('Retail Backend Auth & Isolation QA', () => {
  let branchesController: BranchesController;
  let catalogController: CatalogController;
  let inventoryController: InventoryController;
  let ordersController: OrdersController;

  const mockBranchesService = { getBranch: jest.fn() };
  const mockCatalogService = { createProduct: jest.fn() };
  const mockInventoryService = { adjustInventory: jest.fn() };
  const mockOrdersService = { createSaleOrder: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController, CatalogController, InventoryController, OrdersController],
      providers: [
        { provide: BranchesService, useValue: mockBranchesService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    branchesController = module.get<BranchesController>(BranchesController);
    catalogController = module.get<CatalogController>(CatalogController);
    inventoryController = module.get<InventoryController>(InventoryController);
    ordersController = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Valid Authenticated Context', () => {
    it('should successfully pass organizationId from req.user to service', async () => {
      mockBranchesService.getBranch.mockResolvedValue({ id: 'branch-1', organizationId: 'org-A' });
      const req = { user: { id: 'user-1', organizationId: 'org-A' } };
      
      await branchesController.getBranch(req, 'branch-1');
      expect(mockBranchesService.getBranch).toHaveBeenCalledWith('org-A', 'branch-1');
    });
  });

  describe('2. Missing Organization Context', () => {
    it('should throw ForbiddenException for BranchesController', async () => {
      const req = { user: { id: 'user-1' } }; // Missing organizationId
      await expect(branchesController.getBranch(req, 'branch-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for CatalogController', async () => {
      const req = { user: { id: 'user-1' } }; // Missing organizationId
      await expect(catalogController.createProduct(req, { sku: '123', name: 'Test', sellingPrice: 10 })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Missing Authenticated User ID', () => {
    it('should throw UnauthorizedException for InventoryController adjustment', async () => {
      const req = { user: { organizationId: 'org-A' } }; // Missing id
      await expect(inventoryController.adjustInventory(req, 'branch-1', 'prod-1', 5, 'Restock')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Organization Isolation', () => {
    it('should not allow org-A user to request org-B branch directly (service enforces it)', async () => {
      // In the real app, BranchesService.getBranch throws Forbidden if the DB branch.organizationId !== requested orgId.
      // We simulate the service enforcement here to prove the controller passes the exact org down.
      mockBranchesService.getBranch.mockImplementation((orgId) => {
        if (orgId !== 'org-B') throw new ForbiddenException();
        return { id: 'branch-1' };
      });

      const req = { user: { id: 'user-A', organizationId: 'org-A' } };
      await expect(branchesController.getBranch(req, 'branch-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. No Fallbacks', () => {
    it('should never substitute org-1 when req.user is undefined', async () => {
      const req = { user: undefined };
      await expect(ordersController.createOrder(req, { branchId: 'b-1', terminalId: 't-1', items: [] })).rejects.toThrow(ForbiddenException);
    });
  });
});
