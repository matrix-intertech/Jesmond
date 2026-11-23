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
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    retailBranch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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

  describe('Universal Barcode System & Lookup', () => {
    it('16. createProduct rejects duplicate barcode within the same organization', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'existing-p',
        name: 'Existing Item',
        barcode: '9312345001021',
      });

      await expect(
        service.createProduct('org1', 'u1', {
          name: 'Duplicate Item',
          sellingPrice: 200,
          imageUrl: 'http://img.com/b.jpg',
          barcode: '9312345001021',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('17. createProduct succeeds with valid unique barcode', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        id: 'p-new',
        name: 'New Product',
        barcode: '9312345001021',
        sellingPrice: 1500,
        imageUrl: 'http://img.com/new.jpg',
      });

      const res = await service.createProduct('org1', 'u1', {
        name: 'New Product',
        sellingPrice: 1500,
        imageUrl: 'http://img.com/new.jpg',
        barcode: '  9312345001021  ',
      });

      expect(res.id).toBe('p-new');
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ barcode: '9312345001021' }),
        }),
      );
    });

    it('18. lookupBarcode finds product and resolves branch inventory stock', async () => {
      mockPrisma.retailBranch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org1' });
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Water Bottle',
        sku: 'BOT-001',
        barcode: '9312345002028',
        sellingPrice: 2500,
        isActive: true,
        inventory: [{ quantity: 15 }],
        category: { id: 'c1', name: 'Home' },
      });

      const result = await service.lookupBarcode('org1', '9312345002028', 'b1');
      expect(result.found).toBe(true);
      expect(result.product?.name).toBe('Water Bottle');
      expect(result.product?.quantity).toBe(15);
      expect(result.product?.outOfStock).toBe(false);
    });

    it('19. lookupBarcode handles unknown barcodes cleanly', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      const result = await service.lookupBarcode('org1', '0000000000000');
      expect(result.found).toBe(false);
      expect(result.barcode).toBe('0000000000000');
    });

    it('20. lookupBarcode flags inactive and out of stock products', async () => {
      mockPrisma.retailBranch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org1' });
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p2',
        name: 'Sold Out Item',
        sku: 'SOL-001',
        barcode: '9312345009999',
        sellingPrice: 1000,
        isActive: false,
        inventory: [{ quantity: 0 }],
      });

      const result = await service.lookupBarcode('org1', '9312345009999', 'b1');
      expect(result.found).toBe(true);
      expect(result.inactive).toBe(true);
      expect(result.product?.outOfStock).toBe(true);
    });
  });
});
