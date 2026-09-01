import { PrismaService } from '../../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController], providers: [{ provide: PrismaService, useValue: { $transaction: jest.fn(), inventory: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() }, inventoryMovement: { create: jest.fn() }, salesOrder: { create: jest.fn() }, posWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } }],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
