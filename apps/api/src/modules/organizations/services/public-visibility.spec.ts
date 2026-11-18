import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessesService } from '../../retail/businesses/businesses.service';
import { ProviderSettingsService } from '../../settings/provider-settings.service';
import { AgencyService } from './agency.service';
import { MarketplaceService } from '../../retail/marketplace/marketplace.service';
import { PropertiesService } from '../../properties/core/properties.service';
import { AppointmentsService } from '../../appointments/services/appointments.service';
import { MenuService } from '../../food/menu/menu.service';
import { NotFoundException } from '@nestjs/common';

describe('Universal Public Visibility Suite', () => {
  let prisma: PrismaService;
  let businessesService: BusinessesService;
  let providerSettingsService: ProviderSettingsService;
  let agencyService: AgencyService;
  let marketplaceService: MarketplaceService;
  let propertiesService: PropertiesService;
  let appointmentsService: AppointmentsService;
  let menuService: MenuService;

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    delPattern: jest.fn().mockResolvedValue(true),
  };

  const mockEmail = { sendEmail: jest.fn().mockResolvedValue(true) };
  const mockWhatsApp = { sendNotification: jest.fn().mockResolvedValue(true) };
  const mockNotifications = { createNotification: jest.fn().mockResolvedValue(true) };
  const mockPaymentSettings = { getSettings: jest.fn().mockResolvedValue({ id: 'dummy' }) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        BusinessesService,
        ProviderSettingsService,
        AgencyService,
        {
          provide: MarketplaceService,
          useFactory: (p: PrismaService) =>
            new MarketplaceService(
              p,
              mockRedis as any,
              mockPaymentSettings as any,
              mockWhatsApp as any,
              mockEmail as any,
            ),
          inject: [PrismaService],
        },
        {
          provide: PropertiesService,
          useFactory: (p: PrismaService) => new PropertiesService(p, mockEmail as any, mockWhatsApp as any),
          inject: [PrismaService],
        },
        {
          provide: AppointmentsService,
          useFactory: (p: PrismaService) => new AppointmentsService(p, mockNotifications as any, mockWhatsApp as any, mockEmail as any),
          inject: [PrismaService],
        },
        MenuService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    businessesService = module.get<BusinessesService>(BusinessesService);
    providerSettingsService = module.get<ProviderSettingsService>(ProviderSettingsService);
    agencyService = module.get<AgencyService>(AgencyService);
    marketplaceService = module.get<MarketplaceService>(MarketplaceService);
    propertiesService = module.get<PropertiesService>(PropertiesService);
    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
    menuService = module.get<MenuService>(MenuService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Part A — Universal Public Visibility Field & Defaults', () => {
    it('should default isPubliclyVisible to true when a new Organization is created', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Visibility Test Org Default',
          type: 'RETAIL',
          businessCategory: 'RETAIL',
        },
      });

      expect(org.isPubliclyVisible).toBe(true);

      // Clean up
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('allows updating isPubliclyVisible to false via BusinessesService (Retail/Services/Mechanics/Food)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Retail Visibility Org',
          type: 'RETAIL',
          businessCategory: 'MECHANICS',
          isPubliclyVisible: true,
        },
      });

      const user = await prisma.user.create({
        data: {
          email: `test.vis.${Date.now()}@jesmond.test`,
          password: 'dummy',
          firstName: 'Test',
          lastName: 'User',
          role: 'ORG_STAFF',
        },
      });

      // Update visibility to false
      const updated = await businessesService.updateProfile(
        org.id,
        { isPubliclyVisible: false },
        user.id,
      );

      expect(updated.isPubliclyVisible).toBe(false);

      // Private profile fetch still returns the business details and isPubliclyVisible: false
      const profile = await businessesService.getProfile(org.id);
      expect(profile.isPubliclyVisible).toBe(false);
      expect(profile.id).toBe(org.id);

      // Clean up
      await prisma.auditLog.deleteMany({ where: { resourceId: org.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('allows updating isPubliclyVisible via ProviderSettingsService (Accommodation Providers)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Provider Visibility Org',
          type: 'PROVIDER',
          isPubliclyVisible: true,
        },
      });

      // Update visibility to false
      const updated = await providerSettingsService.updateBusinessProfile(org.id, {
        isPubliclyVisible: false,
      });

      expect(updated.isPubliclyVisible).toBe(false);

      // Private business profile fetch returns isPubliclyVisible: false
      const profile = await providerSettingsService.getBusinessProfile(org.id);
      expect(profile.isPubliclyVisible).toBe(false);

      // Clean up
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('allows updating isPubliclyVisible via AgencyService (Agencies)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Agency Visibility Org',
          type: 'PROVIDER',
          isPubliclyVisible: true,
        },
      });

      const updated = await agencyService.updateAgency(
        { organizationId: org.id },
        { isPubliclyVisible: false },
      );

      expect(updated.isPubliclyVisible).toBe(false);

      // Clean up
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  describe('Part A — Public Discovery Query Exclusion', () => {
    let visibleOrg: any;
    let hiddenOrg: any;
    let visibleBranch: any;
    let hiddenBranch: any;

    beforeAll(async () => {
      // Create visible organization and branch
      visibleOrg = await prisma.organization.create({
        data: {
          name: 'Visible Store Org',
          type: 'RETAIL',
          businessCategory: 'FOOD',
          status: 'VERIFIED',
          isPubliclyVisible: true,
        },
      });
      visibleBranch = await prisma.retailBranch.create({
        data: {
          organizationId: visibleOrg.id,
          name: 'Visible Store Branch',
          isActive: true,
        },
      });

      // Create hidden organization and branch
      hiddenOrg = await prisma.organization.create({
        data: {
          name: 'Hidden Store Org',
          type: 'RETAIL',
          businessCategory: 'FOOD',
          status: 'VERIFIED',
          isPubliclyVisible: false,
        },
      });
      hiddenBranch = await prisma.retailBranch.create({
        data: {
          organizationId: hiddenOrg.id,
          name: 'Hidden Store Branch',
          isActive: true,
        },
      });
    });

    afterAll(async () => {
      await prisma.retailBranch.deleteMany({
        where: { id: { in: [visibleBranch.id, hiddenBranch.id] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [visibleOrg.id, hiddenOrg.id] } },
      });
    });

    it('MarketplaceService.listStores excludes branches of hidden organizations (fast-path)', async () => {
      const stores = await marketplaceService.listStores(
        undefined,
        undefined,
        undefined,
        'FOOD',
      );
      const storeIds = stores.map((s: any) => s.id);

      expect(storeIds).toContain(visibleBranch.id);
      expect(storeIds).not.toContain(hiddenBranch.id);
    });

    it('MarketplaceService.listStores excludes branches of hidden organizations (paginated path)', async () => {
      const result: any = await marketplaceService.listStores(
        undefined,
        undefined,
        undefined,
        'FOOD',
        undefined,
        undefined,
        true,
        undefined,
        1,
        50,
      );
      const storeIds = result.data.map((s: any) => s.id);

      expect(storeIds).toContain(visibleBranch.id);
      expect(storeIds).not.toContain(hiddenBranch.id);
    });

    it('MarketplaceService.getStoreCatalog throws NotFoundException when organization isPubliclyVisible is false', async () => {
      // Hidden branch throws NotFoundException
      await expect(
        marketplaceService.getStoreCatalog(hiddenBranch.id),
      ).rejects.toThrow(NotFoundException);

      // Visible branch resolves
      const catalog = await marketplaceService.getStoreCatalog(visibleBranch.id);
      expect(catalog).toBeDefined();
    });

    it('Food Menu: getPublicMenu returns empty array when organization isPubliclyVisible is false', async () => {
      const menu = await menuService.getPublicMenu(hiddenBranch.id);
      expect(menu).toEqual([]);
    });

    it('Appointments: getServicesForBranch returns empty array when organization isPubliclyVisible is false', async () => {
      const services = await appointmentsService.getServicesForBranch(hiddenBranch.id);
      expect(services).toEqual([]);
    });

    it('Agencies: getPublicAgencies and getPublicAgencyDetails exclude hidden agencies', async () => {
      const hiddenAgency = await prisma.organization.create({
        data: {
          name: 'Hidden Agency Org',
          type: 'PROVIDER',
          status: 'VERIFIED',
          isPubliclyVisible: false,
        },
      });

      const res = await agencyService.getPublicAgencies({ search: 'Hidden Agency Org' });
      expect(res.data.find((a: any) => a.id === hiddenAgency.id)).toBeUndefined();

      await expect(
        agencyService.getPublicAgencyDetails(hiddenAgency.id),
      ).rejects.toThrow(NotFoundException);

      await prisma.organization.delete({ where: { id: hiddenAgency.id } });
    });

    it('Properties: search and getPublicProperty exclude properties with isPubliclyVisible = false', async () => {
      const suburb = await prisma.suburb.findFirst();
      if (!suburb) return; // skip if no seed suburbs

      const hiddenPropOrg = await prisma.organization.create({
        data: {
          name: 'Hidden Property Provider',
          type: 'PROVIDER',
          status: 'VERIFIED',
          isPubliclyVisible: false,
        },
      });

      const property = await prisma.property.create({
        data: {
          organizationId: hiddenPropOrg.id,
          name: 'Hidden Luxury Apartment',
          status: 'PUBLISHED',
          address: '456 Hidden Way',
          postcode: '2307',
          suburbId: suburb.id,
          lat: -32.9,
          lng: 151.7,
          description: 'A hidden property for test',
        },
      });

      // 1. Search should exclude it
      const searchRes = await propertiesService.search({});
      const found = searchRes.data.find((p: any) => p.id === property.id);
      expect(found).toBeUndefined();

      // 2. Direct lookup throws NotFoundException
      await expect(
        propertiesService.getPublicProperty(property.id),
      ).rejects.toThrow(NotFoundException);

      // Clean up
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.organization.delete({ where: { id: hiddenPropOrg.id } });
    });
  });
});
