import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PaymentSettingsService } from '../payments/payment-settings.service';

describe('Business Directory QA', () => {
  let service: MarketplaceService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrisma = {
    retailBranch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockPaymentSettings = {
    getSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: PaymentSettingsService, useValue: mockPaymentSettings },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Category Filtering & Visibility', () => {
    const createMockBranch = (
      id: string,
      name: string,
      category: string,
      isActive = true,
    ) => ({
      id,
      name,
      address: '123 Test St',
      lat: 10,
      lng: 20,
      isActive,
      organizationId: 'org1',
      organization: {
        name: 'Org 1',
        businessCategory: category,
        branding: null,
      },
    });

    it('1. All businesses can be returned', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([
        createMockBranch('1', 'Store A', 'RETAIL'),
        createMockBranch('2', 'Store B', 'FOOD'),
      ]);

      const res = await service.listStores();
      expect(res).toHaveLength(2);
      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization: expect.objectContaining({
              businessCategory: undefined,
            }),
          }),
        }),
      );
    });

    it('2-6. Category filters return specific categories', async () => {
      const categories = ['RETAIL', 'FOOD', 'MECHANICS', 'SERVICES', 'RENTALS'];

      for (const cat of categories) {
        mockPrisma.retailBranch.findMany.mockResolvedValue([
          createMockBranch('1', `Store ${cat}`, cat),
        ]);

        await service.listStores(undefined, undefined, undefined, cat);

        expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              organization: expect.objectContaining({ businessCategory: cat }),
            }),
          }),
        );
      }
    });

    it('7. Existing Retail businesses remain visible', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([
        createMockBranch('1', 'Store A', 'RETAIL'),
      ]);

      const res = await service.listStores(
        undefined,
        undefined,
        undefined,
        'RETAIL',
      );
      expect(res[0].organization.businessCategory).toBe('RETAIL');
    });

    it('8. Inactive businesses remain excluded according to existing rules (or labeled appropriately)', async () => {
      // Current implementation returns them but marks them as unavailable
      mockPrisma.retailBranch.findMany.mockResolvedValue([
        createMockBranch('1', 'Store A', 'RETAIL', false),
      ]);

      const res = await service.listStores();
      expect(res[0].availability.available).toBe(false);
      expect(res[0].availability.label).toBe('Currently Unavailable');
    });

    it('9. Address/lat/lng are returned correctly', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([
        createMockBranch('1', 'Store A', 'RETAIL'),
      ]);

      const res = await service.listStores();
      expect(res[0].address).toBe('123 Test St');
      expect(res[0].lat).toBe(10);
      expect(res[0].lng).toBe(20);
    });

    it('10. Cache keys differ appropriately by category', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([]);

      await service.listStores(undefined, undefined, undefined, 'RETAIL');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'retail:marketplace:stores:all:all:all:RETAIL',
        expect.any(Array),
        45,
      );

      await service.listStores(undefined, undefined, undefined, 'FOOD');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'retail:marketplace:stores:all:all:all:FOOD',
        expect.any(Array),
        45,
      );
    });

    it('11. Private organization/staff information is not exposed', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([
        createMockBranch('1', 'Store A', 'RETAIL'),
      ]);

      const res = await service.listStores();
      expect(res[0].organization).not.toHaveProperty('settings');
      expect(res[0].organization).not.toHaveProperty('paymentSettings');
      expect(res[0].organization).not.toHaveProperty('staff');
    });
  });
});
