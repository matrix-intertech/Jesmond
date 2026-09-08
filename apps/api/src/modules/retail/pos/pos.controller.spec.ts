import { Test, TestingModule } from '@nestjs/testing';
import { PosWebhookController, PosWebhookService } from './pos.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotImplementedException } from '@nestjs/common';

describe('PosWebhookController', () => {
  let controller: PosWebhookController;
  let service: PosWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosWebhookController],
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

    controller = module.get<PosWebhookController>(PosWebhookController);
    service = module.get<PosWebhookService>(PosWebhookService);
  });

  describe('Webhook Security', () => {
    it('should throw BadRequestException if signature is missing for Stripe', async () => {
      await expect(
        controller.handleWebhook({}, '', '', '', '', {}, 'stripe')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if provider is entirely unknown', async () => {
      // Pass a dummy signature so it passes the empty signature check
      await expect(
        controller.handleWebhook({}, 'dummy-sig', '', '', '', {}, 'unknown_provider')
      ).rejects.toThrow(new BadRequestException('Provider not configured: unknown_provider'));
    });

    it('should throw NotImplementedException for Square because integration is safely disabled', async () => {
      await expect(
        controller.handleWebhook({}, 'dummy-sig', '', '', '', {}, 'square')
      ).rejects.toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for Stripe because integration is safely disabled', async () => {
      await expect(
        controller.handleWebhook({}, '', 'dummy-sig', '', '', {}, 'stripe')
      ).rejects.toThrow(NotImplementedException);
    });
  });
});
