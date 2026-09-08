import { Test, TestingModule } from '@nestjs/testing';
import { PosSandboxController } from './pos.sandbox.controller';
import { PosWebhookService } from './pos.controller';
import { ForbiddenException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

describe('PosSandboxController', () => {
  let controller: PosSandboxController;
  let service: PosWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosSandboxController],
      providers: [
        PosWebhookService,
        {
          provide: PrismaService,
          useValue: {
            posWebhookEvent: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<PosSandboxController>(PosSandboxController);
    service = module.get<PosWebhookService>(PosWebhookService);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.POS_SANDBOX_ENABLED;
  });

  describe('Security and Sandbox Isolation', () => {
    it('should throw ForbiddenException if NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.POS_SANDBOX_ENABLED = 'true';

      await expect(
        controller.simulateWebhook({
          provider: 'TYRO',
          transactionId: 'txn_123',
          success: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if POS_SANDBOX_ENABLED is not true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.POS_SANDBOX_ENABLED = 'false';

      await expect(
        controller.simulateWebhook({
          provider: 'TYRO',
          transactionId: 'txn_123',
          success: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotImplementedException for TYRO (preventing direct processWebhook bypass)', async () => {
      process.env.NODE_ENV = 'development';
      process.env.POS_SANDBOX_ENABLED = 'true';

      // Tyro must go through verifySignature which throws NotImplementedException
      await expect(
        controller.simulateWebhook({
          provider: 'TYRO',
          transactionId: 'txn_123',
          success: true,
        })
      ).rejects.toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for STRIPE (preventing fake events)', async () => {
      process.env.NODE_ENV = 'development';
      process.env.POS_SANDBOX_ENABLED = 'true';

      await expect(
        controller.simulateWebhook({
          provider: 'STRIPE',
          transactionId: 'txn_123',
          success: true,
        })
      ).rejects.toThrow(NotImplementedException);
    });
  });
});
