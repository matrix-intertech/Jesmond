import { Test, TestingModule } from '@nestjs/testing';
import { BusinessNameRequestsService } from './business-name-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../properties/core/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BusinessNameChangeStatus, ActorType } from '@prisma/client';

describe('BusinessNameRequestsService', () => {
  let service: BusinessNameRequestsService;
  let prisma: any;
  let storage: any;
  let notifications: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
      businessNameChangeRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      businessNameChangeDocument: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    storage = {
      uploadNameChangeDocument: jest.fn(),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.com/doc'),
    };

    notifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessNameRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<BusinessNameRequestsService>(BusinessNameRequestsService);
  });

  describe('submitRequest', () => {
    it('should throw NotFoundException if organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.submitRequest(mockOrgId, mockUserId, {
          proposedName: 'New Org Name',
          reason: 'Business Rebranding',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if proposed name is identical to current name', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: mockOrgId,
        name: 'Current Business Name',
      });

      await expect(
        service.submitRequest(mockOrgId, mockUserId, {
          proposedName: 'Current Business Name',
          reason: 'Business Rebranding',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if an active request already exists', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: mockOrgId,
        name: 'Current Business Name',
      });

      prisma.businessNameChangeRequest.findFirst.mockResolvedValue({
        id: 'existing-req',
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      await expect(
        service.submitRequest(mockOrgId, mockUserId, {
          proposedName: 'Brand New Name',
          reason: 'Business Rebranding',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully submit request, create audit log, and dispatch notification', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: mockOrgId,
        name: 'Current Business Name',
      });
      prisma.businessNameChangeRequest.findFirst.mockResolvedValue(null);
      prisma.businessNameChangeRequest.create.mockResolvedValue({
        id: 'new-req-1',
        organizationId: mockOrgId,
        requestedByUserId: mockUserId,
        currentName: 'Current Business Name',
        proposedName: 'Brand New Name',
        reason: 'Business Rebranding',
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      const res = await service.submitRequest(mockOrgId, mockUserId, {
        proposedName: 'Brand New Name',
        reason: 'Business Rebranding',
      });

      expect(res.id).toBe('new-req-1');
      expect(prisma.businessNameChangeRequest.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrgId,
          requestedByUserId: mockUserId,
          currentName: 'Current Business Name',
          proposedName: 'Brand New Name',
          reason: 'Business Rebranding',
          status: BusinessNameChangeStatus.SUBMITTED,
        },
        include: { documents: true },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.name_change_requested',
            actorId: mockUserId,
            resourceId: 'new-req-1',
          }),
        }),
      );

      expect(notifications.createNotification).toHaveBeenCalled();
    });
  });

  describe('uploadDocument', () => {
    it('should reject if request does not belong to the organization', async () => {
      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        organizationId: 'other-org',
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      await expect(
        service.uploadDocument(mockOrgId, 'req-1', mockUserId, {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if request is already finalized', async () => {
      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.APPROVED,
      });

      await expect(
        service.uploadDocument(mockOrgId, 'req-1', mockUserId, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload document and create record if request is active', async () => {
      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      storage.uploadNameChangeDocument.mockResolvedValue({
        key: 'name-change-requests/org/req/file.pdf',
        filename: 'certificate.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      });

      prisma.businessNameChangeDocument.create.mockResolvedValue({
        id: 'doc-1',
        filename: 'certificate.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: new Date(),
      });

      const res = await service.uploadDocument(mockOrgId, 'req-1', mockUserId, {} as any);
      expect(res.id).toBe('doc-1');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
