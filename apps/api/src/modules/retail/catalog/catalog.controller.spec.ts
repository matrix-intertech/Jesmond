import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from '../../properties/core/storage.service';

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: {} },
        { provide: StorageService, useValue: { uploadFile: jest.fn() } },
        { provide: PrismaService, useValue: { orgStaff: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
