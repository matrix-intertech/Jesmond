import { PrismaService } from '../../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      retailBranch: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      inventory: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
      inventoryMovement: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('adjustInventory', () => {
    it('should throw ForbiddenException if branch does not exist', async () => {
      prismaMock.retailBranch.findFirst.mockResolvedValue(null);

      await expect(
        service.adjustInventory('org-1', 'branch-1', 'prod-1', 10, 'user-1', 'Refill')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if new quantity is negative', async () => {
      prismaMock.retailBranch.findFirst.mockResolvedValue({ id: 'branch-1', organizationId: 'org-1' });
      prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1', organizationId: 'org-1' });
      prismaMock.inventory.findUnique.mockResolvedValue({ quantity: 5 });

      await expect(
        service.adjustInventory('org-1', 'branch-1', 'prod-1', -10, 'user-1', 'Damaged')
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update quantity and log movement', async () => {
      prismaMock.retailBranch.findFirst.mockResolvedValue({ id: 'branch-1', organizationId: 'org-1' });
      prismaMock.product.findFirst.mockResolvedValue({ id: 'prod-1', organizationId: 'org-1' });
      prismaMock.inventory.findUnique.mockResolvedValue({ quantity: 5 });
      prismaMock.inventory.upsert.mockResolvedValue({ id: 'inv-1', branchId: 'branch-1', productId: 'prod-1', quantity: 15 });

      const result = await service.adjustInventory('org-1', 'branch-1', 'prod-1', 10, 'user-1', 'Stock Receipt');

      expect(result.quantity).toBe(15);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: 'branch-1',
          productId: 'prod-1',
          type: 'ADJUSTMENT',
          quantity: 10,
          reason: 'Stock Receipt',
          createdBy: 'user-1',
        }),
      });
    });
  });

  describe('getInventoryMovements', () => {
    it('should throw ForbiddenException if branch not found for organization', async () => {
      prismaMock.retailBranch.findFirst.mockResolvedValue(null);

      await expect(
        service.getInventoryMovements('org-1', 'branch-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return movement records for branch', async () => {
      prismaMock.retailBranch.findFirst.mockResolvedValue({ id: 'branch-1', organizationId: 'org-1' });
      prismaMock.inventoryMovement.findMany.mockResolvedValue([
        { id: 'mov-1', type: 'ADJUSTMENT', quantity: 10, reason: 'Refill' },
      ]);

      const movements = await service.getInventoryMovements('org-1', 'branch-1', 'prod-1');
      expect(movements.length).toBe(1);
      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith({
        where: { branchId: 'branch-1', productId: 'prod-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: expect.any(Object),
      });
    });
  });
});
