import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;

  const mockPrisma = {
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    retailBranch: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('1. createProduct succeeds with valid imageUrl', async () => {
      mockPrisma.product.create.mockResolvedValue({
        id: 'p1',
        imageUrl: 'http://img.com/a.jpg',
      });
      const result = await service.createProduct('org1', 'u1', {
        name: 'A',
        sellingPrice: 100,
        imageUrl: 'http://img.com/a.jpg',
      });
      expect(result.id).toBe('p1');
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });

    it('2. createProduct rejects null imageUrl', async () => {
      await expect(
        service.createProduct('org1', 'u1', {
          name: 'A',
          sellingPrice: 100,
          imageUrl: null as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. createProduct rejects empty imageUrl', async () => {
      await expect(
        service.createProduct('org1', 'u1', {
          name: 'A',
          sellingPrice: 100,
          imageUrl: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. createProduct rejects whitespace imageUrl', async () => {
      await expect(
        service.createProduct('org1', 'u1', {
          name: 'A',
          sellingPrice: 100,
          imageUrl: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProduct', () => {
    beforeEach(() => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        organizationId: 'org1',
        isActive: true,
        imageUrl: 'http://old.jpg',
      });
      mockPrisma.product.update.mockImplementation((args) =>
        Promise.resolve({ id: 'p1', ...args.data }),
      );
    });

    it('5. updateProduct updates normal product fields', async () => {
      await service.updateProduct('org1', 'u1', 'p1', { name: 'New Name' });
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('6. updateProduct preserves imageUrl when omitted', async () => {
      await service.updateProduct('org1', 'u1', 'p1', { name: 'New Name' });
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: 'http://old.jpg' }),
        }),
      );
    });

    it('7. updateProduct rejects explicit null/empty/whitespace imageUrl', async () => {
      await expect(
        service.updateProduct('org1', 'u1', 'p1', { imageUrl: null as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProduct('org1', 'u1', 'p1', { imageUrl: '' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProduct('org1', 'u1', 'p1', { imageUrl: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. updateProduct sets isActive=false', async () => {
      await service.updateProduct('org1', 'u1', 'p1', { isActive: false });
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('9. updateProduct sets isActive=true', async () => {
      await service.updateProduct('org1', 'u1', 'p1', { isActive: true });
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('10. omitted isActive does not change existing state', async () => {
      await service.updateProduct('org1', 'u1', 'p1', { name: 'New Name' });
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('getCatalog', () => {
    it('11. getCatalog returns imageUrl', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          imageUrl: 'http://img.com/a.jpg',
          isActive: true,
          category: null,
        },
      ]);
      const res = await service.getCatalog('org1', {});
      expect(res[0].imageUrl).toBe('http://img.com/a.jpg');
    });

    it('12. branch-specific inventory relationship is returned correctly', async () => {
      mockPrisma.retailBranch.findUnique.mockResolvedValue({
        id: 'b1',
        organizationId: 'org1',
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', isActive: true, inventory: [{ quantity: 5 }] },
      ]);
      const res = await service.getCatalog('org1', { branchId: 'b1' });
      expect(res[0].quantity).toBe(5);
    });

    it('13. inactive product behavior matches the intended public/provider behavior', async () => {
      await service.getCatalog('org1', {});
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ isActive: true }), // No longer forces true!
        }),
      );

      await service.getCatalog('org1', { active: false });
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('Ownership / Conflict', () => {
    it('14. SKU uniqueness conflict is handled', async () => {
      mockPrisma.product.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.createProduct('org1', 'u1', {
          name: 'A',
          sellingPrice: 100,
          imageUrl: 'http://i.jpg',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('15. organization ownership is respected', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        organizationId: 'org2',
      });
      await expect(
        service.updateProduct('org1', 'u1', 'p1', { name: 'A' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
