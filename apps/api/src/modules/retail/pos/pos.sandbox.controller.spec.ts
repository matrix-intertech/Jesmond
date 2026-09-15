import { Test, TestingModule } from '@nestjs/testing';
import { PosSandboxController } from './pos.sandbox.controller';
import { PosWebhookService } from './pos.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('PosSandboxController', () => {
  let controller: PosSandboxController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosSandboxController],
      providers: [
        { provide: PosWebhookService, useValue: {} },
        { provide: PrismaService, useValue: { orgStaff: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<PosSandboxController>(PosSandboxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
