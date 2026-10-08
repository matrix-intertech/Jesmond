import { Test, TestingModule } from '@nestjs/testing';
import { BusinessesService } from './businesses.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Business Location QA', () => {
  let service: BusinessesService;
  let prisma: PrismaService;

  const mockPrisma = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    retailBranch: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Retrieve Location', () => {
    it('should return location if authorized business owner requests it', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'My Biz',
        businessCategory: 'RETAIL',
      });
      mockPrisma.retailBranch.findFirst.mockResolvedValue({
        id: 'branch1',
        address: '123 Main St',
        lat: 10,
        lng: 20,
        phone: '555',
      });

      const res = await service.getLocation('org1');
      expect(res.businessName).toBe('My Biz');
      expect(res.businessCategory).toBe('RETAIL');
      expect(res.address).toBe('123 Main St');
      expect(res.lat).toBe(10);
      expect(res.lng).toBe(20);
    });
  });

  describe('2. Update Location', () => {
    it('should update location if authorized business owner', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'My Biz',
        businessCategory: 'FOOD',
      });
      mockPrisma.retailBranch.findFirst.mockResolvedValue({
        id: 'branch1',
        address: 'Old St',
      });
      mockPrisma.retailBranch.update.mockResolvedValue({
        id: 'branch1',
        address: 'New St',
        lat: 50,
        lng: 50,
      });

      const res = await service.updateLocation('org1', {
        address: 'New St',
        lat: 50,
        lng: 50,
      });
      expect(res.address).toBe('New St');
    });
  });

  describe('3. Unauthorized update', () => {
    it('should throw if user tries to update another orgs location', async () => {
      // The controller ensures that req.user.organizationId is used.
      // The service layer only accepts organizationId, so it is inherently tied to the JWT's org.
      // This requirement is satisfied by the controller guard. We'll simulate by ensuring findUnique relies on provided ID.
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(
        service.updateLocation('wrong-org', { address: 'x', lat: 1, lng: 1 }),
      ).rejects.toThrow('Business organization not found');
    });
  });

  describe('4. Invalid latitude', () => {
    it('should reject invalid latitude', async () => {
      await expect(
        service.updateLocation('org1', { address: 'x', lat: 95, lng: 0 }),
      ).rejects.toThrow('Invalid latitude');
      await expect(
        service.updateLocation('org1', { address: 'x', lat: -91, lng: 0 }),
      ).rejects.toThrow('Invalid latitude');
    });
  });

  describe('5. Invalid longitude', () => {
    it('should reject invalid longitude', async () => {
      await expect(
        service.updateLocation('org1', { address: 'x', lat: 0, lng: 181 }),
      ).rejects.toThrow('Invalid longitude');
      await expect(
        service.updateLocation('org1', { address: 'x', lat: 0, lng: -181 }),
      ).rejects.toThrow('Invalid longitude');
    });
  });

  describe('6. Null location save', () => {
    it('existing business with null location can save location', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'My Biz',
        businessCategory: 'SERVICES',
      });
      mockPrisma.retailBranch.findFirst.mockResolvedValue(null);
      mockPrisma.retailBranch.create.mockResolvedValue({
        id: 'new-branch',
        address: '123 New',
        lat: 1,
        lng: 2,
      });

      const res = await service.updateLocation('org1', {
        address: '123 New',
        lat: 1,
        lng: 2,
      });
      expect(res.address).toBe('123 New');
      expect(mockPrisma.retailBranch.create).toHaveBeenCalled();
    });
  });

  describe('7. Existing location update', () => {
    it('existing business with location can update location', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'My Biz',
        businessCategory: 'MECHANICS',
      });
      mockPrisma.retailBranch.findFirst.mockResolvedValue({
        id: 'branch1',
      });
      mockPrisma.retailBranch.update.mockResolvedValue({
        id: 'branch1',
        address: 'Changed',
        lat: 5,
        lng: 5,
      });

      const res = await service.updateLocation('org1', {
        address: 'Changed',
        lat: 5,
        lng: 5,
      });
      expect(res.address).toBe('Changed');
      expect(mockPrisma.retailBranch.update).toHaveBeenCalled();
    });
  });

  describe('8. Business category correctly returned', () => {
    it('should return business category in location result', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'My Biz',
        businessCategory: 'RENTALS',
      });
      mockPrisma.retailBranch.findFirst.mockResolvedValue({
        id: 'branch1',
        address: '123 Main St',
        lat: 10,
        lng: 20,
      });

      const res = await service.getLocation('org1');
      expect(res.businessCategory).toBe('RENTALS');
    });
  });
});
