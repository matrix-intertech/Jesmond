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
      count: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    foodMenuItem: {
      findMany: jest.fn(),
    },
    foodMenuCategory: {
      findMany: jest.fn(),
    },
    businessService: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
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

  describe('Search & Filter Capabilities (Confirmed Requirements)', () => {
    beforeEach(() => {
      mockPrisma.retailBranch.findMany.mockReset();
      mockPrisma.retailBranch.count.mockReset();
      mockPrisma.foodMenuItem.findMany.mockReset();
      mockPrisma.foodMenuCategory.findMany.mockReset();
      mockPrisma.businessService.findMany.mockReset();
      mockPrisma.product.findMany.mockReset();

      mockPrisma.retailBranch.count.mockResolvedValue(1);
      mockPrisma.foodMenuItem.findMany.mockResolvedValue([]);
      mockPrisma.foodMenuCategory.findMany.mockResolvedValue([]);
      mockPrisma.businessService.findMany.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([]);
    });

    it('Search for dishes (e.g. butter chicken) returns restaurants with matchedMenuItems', async () => {
      // Phase 1 direct matches: none
      mockPrisma.retailBranch.findMany
        .mockResolvedValueOnce([]) // direct matches
        .mockResolvedValueOnce([   // full branches fetch
          {
            id: 'rest-branch-1',
            name: 'Taj Mahal Jesmond',
            address: '50 University Dr, Jesmond NSW 2299',
            isActive: true,
            organization: {
              name: 'Taj Mahal Indian Restaurant',
              businessCategory: 'FOOD',
              branding: null,
            },
          },
        ]);

      // Phase 2a menu items: finds butter chicken at rest-branch-1
      mockPrisma.foodMenuItem.findMany.mockResolvedValueOnce([
        {
          id: 'item-1',
          name: 'Butter Chicken',
          description: 'Tender chicken simmered in rich creamy tomato sauce',
          price: 1850,
          category: {
            menu: {
              branchId: 'rest-branch-1',
            },
          },
        },
      ]);

      const res = await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        'butter chicken',
      );

      expect(res).toHaveProperty('data');
      expect(res).toHaveProperty('meta');
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('rest-branch-1');
      expect(res.data[0].matchedMenuItems).toHaveLength(1);
      expect(res.data[0].matchedMenuItems[0].name).toBe('Butter Chicken');
      expect(res.data[0].matchedMenuItems[0].price).toBe(1850);
    });

    it('Filters by Suburb correctly restricts the branch address', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([
        {
          id: 'branch-jesmond',
          name: 'Jesmond Auto Repair',
          address: '200 Auto Park, Jesmond NSW 2299',
          isActive: true,
          organization: {
            name: 'Jesmond Mechanics',
            businessCategory: 'MECHANICS',
            branding: null,
          },
        },
      ]);

      const res = await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'Jesmond',
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            address: { contains: 'Jesmond', mode: 'insensitive' },
          }),
        }),
      );
      expect(res.data[0].address).toContain('Jesmond');
    });

    it('Verified only filter: when OFF allows VERIFIED and PENDING but excludes SUSPENDED and REJECTED', async () => {
      // 1. Default / OFF: verifiedOnly = false -> includes VERIFIED & PENDING, always deletedAt: null
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);
      await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'ALL',
        false, // verifiedOnly: OFF
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization: expect.objectContaining({
              deletedAt: null,
              status: { in: ['VERIFIED', 'PENDING'] },
            }),
          }),
        }),
      );

      // 2. Filter ON: verifiedOnly = true -> only VERIFIED, always deletedAt: null
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);
      await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'ALL',
        true, // verifiedOnly: ON
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization: expect.objectContaining({
              deletedAt: null,
              status: 'VERIFIED',
            }),
          }),
        }),
      );
    });

    it('Open now filter: when ON restricts isActive to true, when OFF does not restrict', async () => {
      // 1. Open now: ON (default)
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);
      await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'ALL',
        false,
        true, // openNow: ON
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );

      // 2. Open now: OFF
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);
      await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'ALL',
        false,
        false, // openNow: OFF
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isActive: true,
          }),
        }),
      );

      // 3. Open now: undefined (omitted / default for public crawlers)
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);
      await service.listStores(
        undefined,
        undefined,
        undefined,
        'ALL',
        undefined,
        'ALL',
        false,
        undefined, // openNow: undefined (default)
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('Pagination input validation: handles invalid, negative, NaN, and excessive limits safely', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValue([]);
      mockPrisma.retailBranch.count.mockResolvedValue(50);

      // Test negative page and 0 limit -> defaults to page 1, limit 20
      const res1 = await service.listStores(
        undefined, undefined, undefined, 'ALL', undefined, 'ALL', false, true,
        -5 as any,
        0 as any,
      );
      expect(res1.meta.page).toBe(1);
      expect(res1.meta.limit).toBe(20);

      // Test NaN inputs -> defaults to page 1, limit 20
      const res2 = await service.listStores(
        undefined, undefined, undefined, 'ALL', undefined, 'ALL', false, true,
        NaN as any,
        NaN as any,
      );
      expect(res2.meta.page).toBe(1);
      expect(res2.meta.limit).toBe(20);

      // Test excessive limit -> capped at 100
      const res3 = await service.listStores(
        undefined, undefined, undefined, 'ALL', undefined, 'ALL', false, true,
        1,
        5000,
      );
      expect(res3.meta.page).toBe(1);
      expect(res3.meta.limit).toBe(100);
    });

    it('Stable pagination: candidate branch IDs are sorted deterministically and do not overlap between pages', async () => {
      // 3 branches matching keyword "coffee"
      const candidateBranches = [
        { id: 'branch-c', name: 'Branch C', organization: { name: 'Org C', businessCategory: 'RETAIL' } },
        { id: 'branch-a', name: 'Branch A', organization: { name: 'Org A', businessCategory: 'RETAIL' } },
        { id: 'branch-b', name: 'Branch B', organization: { name: 'Org B', businessCategory: 'RETAIL' } },
      ];

      // Page 1 with limit 2: direct matches returns all 3 candidates
      mockPrisma.retailBranch.findMany
        .mockResolvedValueOnce([{ id: 'branch-c' }, { id: 'branch-a' }, { id: 'branch-b' }]) // direct
        .mockResolvedValueOnce([candidateBranches[1], candidateBranches[2]]); // full for page 1: branch-a, branch-b

      const page1 = await service.listStores(
        undefined, undefined, undefined, 'ALL', 'coffee', 'ALL', false, true, 1, 2,
      );
      expect(page1.meta.total).toBe(3);
      expect(page1.meta.page).toBe(1);
      expect(page1.meta.totalPages).toBe(2);

      // The IDs queried for page 1 should be the first 2 alphabetically: branch-a, branch-b
      expect(mockPrisma.retailBranch.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['branch-a', 'branch-b'] },
          }),
        }),
      );

      // Page 2 with limit 2: direct matches returns all 3 candidates
      mockPrisma.retailBranch.findMany
        .mockResolvedValueOnce([{ id: 'branch-c' }, { id: 'branch-a' }, { id: 'branch-b' }]) // direct
        .mockResolvedValueOnce([candidateBranches[0]]); // full for page 2: branch-c

      const page2 = await service.listStores(
        undefined, undefined, undefined, 'ALL', 'coffee', 'ALL', false, true, 2, 2,
      );
      expect(page2.meta.page).toBe(2);

      // The IDs queried for page 2 should be the 3rd alphabetically: branch-c
      expect(mockPrisma.retailBranch.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['branch-c'] },
          }),
        }),
      );
    });

    it('Suburb matching: trims input whitespace correctly', async () => {
      mockPrisma.retailBranch.findMany.mockResolvedValueOnce([]);

      await service.listStores(
        undefined, undefined, undefined, 'ALL', undefined, '  Jesmond   ', false, true, 1, 20,
      );

      expect(mockPrisma.retailBranch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            address: { contains: 'Jesmond', mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});
