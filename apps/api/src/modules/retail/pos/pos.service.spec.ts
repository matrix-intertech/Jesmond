import { PrismaService } from '../../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from './pos.service';

describe('PosService', () => {
  let service: PosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PosService, { provide: PrismaService, useValue: { $transaction: jest.fn(), inventory: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() }, inventoryMovement: { create: jest.fn() }, salesOrder: { create: jest.fn() }, posWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } }],
    }).compile();

    service = module.get<PosService>(PosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
