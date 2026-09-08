import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/services/email.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ApplicationsService - Withdraw & Remove Student', () => {
  let service: ApplicationsService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      application: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      roomType: {
        update: jest.fn(),
        updateMany: jest.fn(),
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
      prisma.application.findUnique.mockResolvedValue(mockApp); // Fix tx findUnique mock
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-5');

      expect(result.status).toBe('CANCELLED');
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
      prisma.application.findUnique.mockResolvedValue(mockApp); // Fix tx findUnique mock
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-6');

      expect(result.status).toBe('CANCELLED');
    });
  });
});
