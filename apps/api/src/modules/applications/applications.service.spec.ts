import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/services/email.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ApplicationsService - Inventory Allocation & Restoration', () => {
  let service: ApplicationsService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      application: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      roomType: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      property: {
        findUnique: jest.fn(),
      },
      lease: {
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    emailService = {
      sendApplicationWithdrawalEmail: jest.fn().mockResolvedValue(true),
      sendApplicationRemovalEmail: jest.fn().mockResolvedValue(true),
      sendApplicationApprovalEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  describe('approveApplication', () => {
    it('should fail and not decrement inventory if application is not PENDING_REVIEW inside transaction', async () => {
      const mockApp = {
        id: 'app-approve',
        status: 'APPROVED',
        roomType: { id: 'room-1', property: { status: 'PUBLISHED' } },
        studentId: 'stud-1',
        moveInDate: new Date(),
        durationMonths: 12
      };

      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp); // Re-fetch inside tx

      await expect(service.approveApplication('org-1', 'app-approve')).rejects.toThrow(BadRequestException);
      expect(prisma.roomType.updateMany).not.toHaveBeenCalled();
    });

    it('should rollback transaction (throw) if inventory decrement returns count 0 (out of stock)', async () => {
      const mockApp = {
        id: 'app-approve-2',
        status: 'PENDING_REVIEW',
        roomType: { id: 'room-1', property: { status: 'PUBLISHED' } },
        studentId: 'stud-1',
        moveInDate: new Date(),
        durationMonths: 12
      };

      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp); // Re-fetch inside tx

      // Simulate inventory decrement returning 0 updated rows
      prisma.roomType.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approveApplication('org-1', 'app-approve-2')).rejects.toThrow(BadRequestException);
      expect(prisma.lease.create).not.toHaveBeenCalled();
      expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it('should successfully approve, decrement inventory via updateMany, and create lease', async () => {
      const mockApp = {
        id: 'app-approve-3',
        status: 'PENDING_REVIEW',
        roomType: { id: 'room-1', property: { status: 'PUBLISHED', organization: { name: 'Org', staff: [] } } },
        studentId: 'stud-1',
        moveInDate: new Date(),
        durationMonths: 12,
        student: { firstName: 'John' }
      };

      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp); // Re-fetch inside tx

      prisma.roomType.updateMany.mockResolvedValue({ count: 1 });
      prisma.lease.create.mockResolvedValue({ id: 'lease-new' });
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'APPROVED' });

      const result = await service.approveApplication('org-1', 'app-approve-3');

      expect(result.application.status).toBe('APPROVED');
      expect(prisma.roomType.updateMany).toHaveBeenCalledWith({
        where: { id: 'room-1', inventory: { gt: 0 } },
        data: { inventory: { decrement: 1 } }
      });
      expect(prisma.lease.create).toHaveBeenCalled();
    });
  });

  describe('withdrawApplication', () => {
    it('should withdraw PENDING_REVIEW application without incrementing inventory', async () => {
      const mockApp = {
        id: 'app-1',
        studentId: 'student-1',
        status: 'PENDING_REVIEW',
        roomTypeId: 'room-1',
        roomType: {
          property: {
            name: 'Sunny Lodge',
            organization: { name: 'Org 1', staff: [{ role: 'ADMIN', user: { email: 'admin@org.com' } }] },
          },
        },
        student: { firstName: 'John', lastName: 'Doe', email: 'john@student.com' },
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'WITHDRAWN' });

      const result = await service.withdrawApplication('student-1', 'app-1');

      expect(result.status).toBe('WITHDRAWN');
      expect(prisma.roomType.update).not.toHaveBeenCalled();
      expect(prisma.lease.update).not.toHaveBeenCalled();
    });

    it('should withdraw APPROVED application, restore inventory (+1), and terminate lease', async () => {
      const mockApp = {
        id: 'app-2',
        studentId: 'student-1',
        status: 'APPROVED',
        roomTypeId: 'room-1',
        lease: { id: 'lease-1', status: 'DRAFT' },
        roomType: {
          property: {
            name: 'Sunny Lodge',
            organization: { name: 'Org 1', staff: [{ role: 'ADMIN', user: { email: 'admin@org.com' } }] },
          },
        },
        student: { firstName: 'John', lastName: 'Doe', email: 'john@student.com' },
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'WITHDRAWN' });

      const result = await service.withdrawApplication('student-1', 'app-2');

      expect(result.status).toBe('WITHDRAWN');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-1' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should withdraw LEASE_PENDING application, restore inventory (+1), and terminate lease', async () => {
      const mockApp = {
        id: 'app-lease-pending',
        studentId: 'student-1',
        status: 'LEASE_PENDING',
        roomTypeId: 'room-1',
        lease: { id: 'lease-lp', status: 'DRAFT' },
        roomType: {
          property: {
            name: 'Sunny Lodge',
            organization: { name: 'Org 1', staff: [] },
          },
        },
        student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@student.com' },
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'WITHDRAWN' });

      const result = await service.withdrawApplication('student-1', 'app-lease-pending');

      expect(result.status).toBe('WITHDRAWN');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-lp' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should withdraw BOOKED application, restore inventory (+1), and terminate lease', async () => {
      const mockApp = {
        id: 'app-booked',
        studentId: 'student-1',
        status: 'BOOKED',
        roomTypeId: 'room-1',
        lease: { id: 'lease-bk', status: 'ACTIVE' },
        roomType: {
          property: {
            name: 'Sunny Lodge',
            organization: { name: 'Org 1', staff: [] },
          },
        },
        student: { firstName: 'Bob', lastName: 'Taylor', email: 'bob@student.com' },
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'WITHDRAWN' });

      const result = await service.withdrawApplication('student-1', 'app-booked');

      expect(result.status).toBe('WITHDRAWN');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-bk' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should throw BadRequestException on already WITHDRAWN application without restoring inventory', async () => {
      const mockApp = {
        id: 'app-withdrawn',
        studentId: 'student-1',
        status: 'WITHDRAWN',
        roomTypeId: 'room-1',
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);

      await expect(service.withdrawApplication('student-1', 'app-withdrawn')).rejects.toThrow(BadRequestException);
      expect(prisma.roomType.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on CANCELLED, REJECTED, or EXPIRED application', async () => {
      const mockAppCancelled = { id: 'app-c', studentId: 'student-1', status: 'CANCELLED' };
      prisma.application.findUnique.mockResolvedValue(mockAppCancelled);
      await expect(service.withdrawApplication('student-1', 'app-c')).rejects.toThrow(BadRequestException);

      const mockAppRejected = { id: 'app-r', studentId: 'student-1', status: 'REJECTED' };
      prisma.application.findUnique.mockResolvedValue(mockAppRejected);
      await expect(service.withdrawApplication('student-1', 'app-r')).rejects.toThrow(BadRequestException);

      const mockAppExpired = { id: 'app-e', studentId: 'student-1', status: 'EXPIRED' };
      prisma.application.findUnique.mockResolvedValue(mockAppExpired);
      await expect(service.withdrawApplication('student-1', 'app-e')).rejects.toThrow(BadRequestException);

      expect(prisma.roomType.update).not.toHaveBeenCalled();
    });

    it('should fail if concurrent transaction already transitioned application to WITHDRAWN', async () => {
      const mockInitialApp = {
        id: 'app-conc',
        studentId: 'student-1',
        status: 'APPROVED',
        roomTypeId: 'room-1',
        roomType: { property: { organization: { staff: [] } } },
        student: { firstName: 'John', lastName: 'Doe', email: 'john@student.com' },
      };
      // Initial findUnique returns APPROVED
      prisma.application.findUnique.mockResolvedValueOnce(mockInitialApp);
      // In-transaction findUnique returns WITHDRAWN (simulating another request completed first)
      prisma.application.findUnique.mockResolvedValueOnce({ ...mockInitialApp, status: 'WITHDRAWN' });

      await expect(service.withdrawApplication('student-1', 'app-conc')).rejects.toThrow(BadRequestException);
      expect(prisma.roomType.update).not.toHaveBeenCalled();
    });
  });

  describe('removeStudent', () => {
    it('should remove PENDING_REVIEW student setting status to CANCELLED without changing inventory', async () => {
      const mockApp = {
        id: 'app-5',
        status: 'PENDING_REVIEW',
        roomTypeId: 'room-1',
        roomType: {
          property: {
            organizationId: 'org-1',
            name: 'Sunny Lodge',
          },
        },
        student: { email: 'john@student.com', firstName: 'John', lastName: 'Doe' },
      };
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-5');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.roomType.update).not.toHaveBeenCalled();
      expect(prisma.lease.update).not.toHaveBeenCalled();
    });

    it('should remove APPROVED student setting status to CANCELLED, incrementing inventory and terminating lease', async () => {
      const mockApp = {
        id: 'app-6',
        status: 'APPROVED',
        roomTypeId: 'room-1',
        lease: { id: 'lease-2', status: 'DRAFT' },
        roomType: {
          property: {
            organizationId: 'org-1',
            name: 'Sunny Lodge',
          },
        },
        student: { email: 'john@student.com', firstName: 'John', lastName: 'Doe' },
      };
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-6');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-2' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should remove LEASE_PENDING student, increment inventory (+1), and terminate lease', async () => {
      const mockApp = {
        id: 'app-rem-lp',
        status: 'LEASE_PENDING',
        roomTypeId: 'room-1',
        lease: { id: 'lease-lp-rem', status: 'DRAFT' },
        roomType: {
          property: {
            organizationId: 'org-1',
            name: 'Sunny Lodge',
          },
        },
        student: { email: 'lp@student.com', firstName: 'Jane', lastName: 'Doe' },
      };
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-rem-lp');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-lp-rem' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should remove BOOKED student, increment inventory (+1), and terminate lease', async () => {
      const mockApp = {
        id: 'app-rem-bk',
        status: 'BOOKED',
        roomTypeId: 'room-1',
        lease: { id: 'lease-bk-rem', status: 'ACTIVE' },
        roomType: {
          property: {
            organizationId: 'org-1',
            name: 'Sunny Lodge',
          },
        },
        student: { email: 'bk@student.com', firstName: 'Mark', lastName: 'Lee' },
      };
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);
      prisma.application.findUnique.mockResolvedValue(mockApp);
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-rem-bk');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-bk-rem' },
        data: { status: 'TERMINATED' },
      });
    });

    it('should throw BadRequestException if application is already CANCELLED or closed', async () => {
      const mockApp = {
        id: 'app-closed',
        status: 'CANCELLED',
        roomTypeId: 'room-1',
        roomType: { property: { organizationId: 'org-1', name: 'Sunny Lodge' } },
        student: { email: 'test@student.com', firstName: 'A', lastName: 'B' },
      };
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue(mockApp as any);

      await expect(service.removeStudent('org-1', 'app-closed')).rejects.toThrow(BadRequestException);
      expect(prisma.roomType.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelPropertyApplications', () => {
    it('should cancel all pending and allocated applications, restoring inventory only for allocated ones', async () => {
      const mockApps = [
        {
          id: 'app-prop-pending',
          status: 'PENDING_REVIEW',
          roomTypeId: 'room-1',
          lease: null,
          student: { firstName: 'Student1', lastName: 'One', email: 's1@test.com' },
          roomType: { property: { name: 'Sunny Lodge' } },
        },
        {
          id: 'app-prop-approved',
          status: 'APPROVED',
          roomTypeId: 'room-1',
          lease: { id: 'lease-app-1', status: 'DRAFT' },
          student: { firstName: 'Student2', lastName: 'Two', email: 's2@test.com' },
          roomType: { property: { name: 'Sunny Lodge' } },
        },
        {
          id: 'app-prop-lease-pending',
          status: 'LEASE_PENDING',
          roomTypeId: 'room-2',
          lease: { id: 'lease-app-2', status: 'DRAFT' },
          student: { firstName: 'Student3', lastName: 'Three', email: 's3@test.com' },
          roomType: { property: { name: 'Sunny Lodge' } },
        },
        {
          id: 'app-prop-booked',
          status: 'BOOKED',
          roomTypeId: 'room-2',
          lease: { id: 'lease-app-3', status: 'ACTIVE' },
          student: { firstName: 'Student4', lastName: 'Four', email: 's4@test.com' },
          roomType: { property: { name: 'Sunny Lodge' } },
        },
      ];

      prisma.application.findMany.mockResolvedValue(mockApps);
      prisma.application.findUnique
        .mockResolvedValueOnce(mockApps[0])
        .mockResolvedValueOnce(mockApps[1])
        .mockResolvedValueOnce(mockApps[2])
        .mockResolvedValueOnce(mockApps[3]);

      await service.cancelPropertyApplications('property-1');

      // Room-1 updated once for APPROVED
      // Room-2 updated twice (for LEASE_PENDING and BOOKED)
      // PENDING_REVIEW does NOT increment inventory
      expect(prisma.roomType.update).toHaveBeenCalledTimes(3);
      expect(prisma.roomType.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'room-1' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.roomType.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'room-2' },
        data: { inventory: { increment: 1 } },
      });
      expect(prisma.roomType.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'room-2' },
        data: { inventory: { increment: 1 } },
      });

      // Leases for the 3 allocated applications terminated
      expect(prisma.lease.update).toHaveBeenCalledTimes(3);
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-app-1' },
        data: { status: 'TERMINATED' },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-app-2' },
        data: { status: 'TERMINATED' },
      });
      expect(prisma.lease.update).toHaveBeenCalledWith({
        where: { id: 'lease-app-3' },
        data: { status: 'TERMINATED' },
      });

      // All 4 applications updated to CANCELLED
      expect(prisma.application.update).toHaveBeenCalledTimes(4);
    });

    it('should skip already closed applications within cancelPropertyApplications', async () => {
      const mockApps = [
        {
          id: 'app-closed-skip',
          status: 'APPROVED',
          roomTypeId: 'room-1',
          lease: { id: 'lease-closed', status: 'TERMINATED' },
          student: { firstName: 'Student', lastName: 'X', email: 'x@test.com' },
          roomType: { property: { name: 'Sunny Lodge' } },
        },
      ];

      prisma.application.findMany.mockResolvedValue(mockApps);
      // In transaction, application was already WITHDRAWN
      prisma.application.findUnique.mockResolvedValueOnce({
        ...mockApps[0],
        status: 'WITHDRAWN',
      });

      await service.cancelPropertyApplications('property-1');

      expect(prisma.roomType.update).not.toHaveBeenCalled();
      expect(prisma.lease.update).not.toHaveBeenCalled();
      expect(prisma.application.update).not.toHaveBeenCalled();
    });
  });
});
