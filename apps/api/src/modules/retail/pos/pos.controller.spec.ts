import { Test, TestingModule } from '@nestjs/testing';
import { PosWebhookController, PosWebhookService } from './pos.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('PosWebhookController', () => {
  let controller: PosWebhookController;

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
