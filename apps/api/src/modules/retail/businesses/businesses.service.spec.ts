import { PrismaService } from '../../prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
  let service: BusinessesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessesService, { provide: PrismaService, useValue: { $transaction: jest.fn(), inventory: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() }, inventoryMovement: { create: jest.fn() }, salesOrder: { create: jest.fn() }, posWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } } }],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
