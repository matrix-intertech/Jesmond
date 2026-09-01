import { PrismaService } from '../../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from './branches.controller';

describe('BranchesController', () => {
  let controller: BranchesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController], providers: [{ provide: PrismaService, useValue: { $transaction: jest.fn(), inventory: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() }, inventoryMovement: { create: jest.fn() }, salesOrder: { create: jest.fn() }, posWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } }],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
