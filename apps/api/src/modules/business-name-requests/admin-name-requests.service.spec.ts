import { Test, TestingModule } from '@nestjs/testing';
import { AdminNameRequestsService } from './admin-name-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../properties/core/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessNameChangeStatus, UserRole } from '@prisma/client';

describe('AdminNameRequestsService', () => {
  let service: AdminNameRequestsService;
  let prisma: any;
  let storage: any;
  let notifications: any;

  const mockAdminId = 'admin-user-1';
  const mockOrgId = 'org-1';
  const mockRequestId = 'req-1';

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      organization: {
        update: jest.fn(),
      },
      businessNameChangeRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    storage = {
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.com/doc'),
    };

    notifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminNameRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AdminNameRequestsService>(AdminNameRequestsService);
  });

  describe('Administrative Self-Approval Guard', () => {
    it('should throw ForbiddenException if reviewer belongs to target organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [{ organizationId: mockOrgId }],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      await expect(
        service.approveRequest(mockRequestId, mockAdminId, { reviewerNotes: 'Looks good' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.name_change_review_attempt_rejected',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if reviewer is not ADMIN or SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      await expect(
        service.approveRequest(mockRequestId, 'student-1', { reviewerNotes: 'OK' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('startReview', () => {
    it('should move SUBMITTED request to UNDER_REVIEW and notify user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        requestedByUserId: 'user-requester',
        proposedName: 'Acme Supermarket',
        status: BusinessNameChangeStatus.SUBMITTED,
      });

      prisma.businessNameChangeRequest.update.mockResolvedValue({
        id: mockRequestId,
        status: BusinessNameChangeStatus.UNDER_REVIEW,
      });

      const res = await service.startReview(mockRequestId, mockAdminId);
      expect(res.status).toBe(BusinessNameChangeStatus.UNDER_REVIEW);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.name_change_review_started',
          }),
        }),
      );
      expect(notifications.createNotification).toHaveBeenCalled();
    });

    it('should throw BadRequestException if request is already UNDER_REVIEW or finalized', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.UNDER_REVIEW,
      });

      await expect(service.startReview(mockRequestId, mockAdminId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approveRequest', () => {
    it('should transactionally update Organization.name to proposedName and mark request APPROVED', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        requestedByUserId: 'user-requester',
        currentName: 'Old Acme Corp',
        proposedName: 'Acme Supermarket',
        status: BusinessNameChangeStatus.UNDER_REVIEW,
      });

      prisma.organization.update.mockResolvedValue({
        id: mockOrgId,
        name: 'Acme Supermarket',
      });

      prisma.businessNameChangeRequest.update.mockResolvedValue({
        id: mockRequestId,
        status: BusinessNameChangeStatus.APPROVED,
        reviewedByUserId: mockAdminId,
      });

      const res = await service.approveRequest(mockRequestId, mockAdminId, {
        reviewerNotes: 'Verified against ASIC documentation.',
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrgId },
        data: { name: 'Acme Supermarket' },
      });

      expect(prisma.businessNameChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockRequestId },
          data: expect.objectContaining({
            status: BusinessNameChangeStatus.APPROVED,
            reviewedByUserId: mockAdminId,
            reviewerNotes: 'Verified against ASIC documentation.',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.name_change_approved',
            changes: expect.objectContaining({
              previousName: 'Old Acme Corp',
              newName: 'Acme Supermarket',
            }),
          }),
        }),
      );

      expect(notifications.createNotification).toHaveBeenCalled();
    });

    it('should reject approval if request is already finalized', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        status: BusinessNameChangeStatus.APPROVED,
      });

      await expect(
        service.approveRequest(mockRequestId, mockAdminId, { reviewerNotes: 'OK' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectRequest', () => {
    it('should require mandatory reviewer notes when rejecting', async () => {
      await expect(
        service.rejectRequest(mockRequestId, mockAdminId, { reviewerNotes: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject request, leave Organization.name untouched, and record audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminId,
        role: UserRole.ADMIN,
        orgStaffRoles: [],
      });

      prisma.businessNameChangeRequest.findUnique.mockResolvedValue({
        id: mockRequestId,
        organizationId: mockOrgId,
        requestedByUserId: 'user-requester',
        currentName: 'Old Acme Corp',
        proposedName: 'Acme Supermarket',
        status: BusinessNameChangeStatus.UNDER_REVIEW,
      });

      prisma.businessNameChangeRequest.update.mockResolvedValue({
        id: mockRequestId,
        status: BusinessNameChangeStatus.REJECTED,
      });

      await service.rejectRequest(mockRequestId, mockAdminId, {
        reviewerNotes: 'Invalid documentation provided.',
      });

      // Organization.name must NOT be updated
      expect(prisma.organization.update).not.toHaveBeenCalled();

      expect(prisma.businessNameChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockRequestId },
          data: expect.objectContaining({
            status: BusinessNameChangeStatus.REJECTED,
            reviewerNotes: 'Invalid documentation provided.',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.name_change_rejected',
          }),
        }),
      );
    });
  });
});
