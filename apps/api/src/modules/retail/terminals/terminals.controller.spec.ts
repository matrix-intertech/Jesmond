import { Test, TestingModule } from '@nestjs/testing';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TerminalsController', () => {
  let controller: TerminalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TerminalsController],
      providers: [
        { provide: TerminalsService, useValue: {} },
        { provide: PrismaService, useValue: { orgStaff: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<TerminalsController>(TerminalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
