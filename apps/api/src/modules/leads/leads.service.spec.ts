import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadSourceType, LeadTemperature, LeadStatus } from '@prisma/client';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: PrismaService;

  const mockPrisma = {
    lead: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    property: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('trackVisit', () => {
    it('Authenticated user + same visitorId + same property -> existing Lead updated', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop1',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead1' });

      await service.trackVisit({
        visitorId: 'v1',
        propertyId: 'prop1',
        userId: 'u1',
      });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          propertyId: 'prop1',
          OR: [{ userId: 'u1' }, { visitorId: 'v1', userId: null }],
        },
        data: expect.objectContaining({ userId: 'u1' }),
      });
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org1', propertyId: 'prop1', userId: 'u1' },
      });
    });

    it('Authenticated user + different visitorId + same userId + same property -> existing Lead updated', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop1',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead1' });

      await service.trackVisit({
        visitorId: 'v2',
        propertyId: 'prop1',
        userId: 'u1',
      });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          propertyId: 'prop1',
          OR: [{ userId: 'u1' }, { visitorId: 'v2', userId: null }],
        },
        data: expect.objectContaining({ userId: 'u1' }),
      });
    });

    it('Different authenticated users + same property -> separate Leads', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop1',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead2' });

      await service.trackVisit({
        visitorId: 'v3',
        propertyId: 'prop1',
        userId: 'u2',
      });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          propertyId: 'prop1',
          OR: [{ userId: 'u2' }, { visitorId: 'v3', userId: null }],
        },
        data: expect.objectContaining({ userId: 'u2' }),
      });
      expect(mockPrisma.lead.create).toHaveBeenCalled();
    });

    it('Same authenticated user + different properties -> separate Leads', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop2',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead3' });

      await service.trackVisit({
        visitorId: 'v1',
        propertyId: 'prop2',
        userId: 'u1',
      });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          propertyId: 'prop2',
          OR: [{ userId: 'u1' }, { visitorId: 'v1', userId: null }],
        },
        data: expect.objectContaining({ userId: 'u1' }),
      });
      expect(mockPrisma.lead.create).toHaveBeenCalled();
    });

    it('Legacy Lead with userId = null -> existing visitorId behavior preserved', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop1',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead4' });

      await service.trackVisit({ visitorId: 'v4', propertyId: 'prop1' });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          propertyId: 'prop1',
          visitorId: 'v4',
        },
        data: expect.objectContaining({ userId: undefined }),
      });
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org1', propertyId: 'prop1', visitorId: 'v4' },
      });
    });

    it('Agency-level Lead where propertyId = null -> existing behavior preserved', async () => {
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead5' });

      await service.trackVisit({
        visitorId: 'v5',
        organizationId: 'org2',
        userId: 'u5',
      });

      expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org2',
          propertyId: null,
          OR: [{ userId: 'u5' }, { visitorId: 'v5', userId: null }],
        },
        data: expect.objectContaining({ userId: 'u5' }),
      });
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org2', propertyId: null, userId: 'u5' },
      });
    });

    it('Concurrent creation/update behavior -> existing P2002 recovery behavior remains intact', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        organizationId: 'org1',
        id: 'prop1',
      });
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.lead.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead6' });

      await service.trackVisit({
        visitorId: 'v6',
        propertyId: 'prop1',
        userId: 'u6',
      });

      expect(mockPrisma.lead.create).toHaveBeenCalled();
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org1', propertyId: 'prop1', userId: 'u6' },
      });
    });
  });
});
