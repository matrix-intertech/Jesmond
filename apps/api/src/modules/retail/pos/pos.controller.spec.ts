import { Test, TestingModule } from '@nestjs/testing';
import { PosWebhookController, PosWebhookService } from './pos.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('PosWebhookController', () => {
  let controller: PosWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosWebhookController],
      providers: [
        { provide: PosWebhookService, useValue: {} },
        { provide: PrismaService, useValue: { orgStaff: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<PosWebhookController>(PosWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
