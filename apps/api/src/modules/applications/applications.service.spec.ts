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
      },
      lease: {
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    emailService = {
      sendApplicationWithdrawalEmail: jest.fn().mockResolvedValue(true),
      sendApplicationRemovalEmail: jest.fn().mockResolvedValue(true),
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
      expect(emailService.sendApplicationWithdrawalEmail).toHaveBeenCalledWith({
        providerEmail: 'admin@org.com',
        providerName: 'Org 1',
        studentName: 'John Doe',
        propertyName: 'Sunny Lodge',
      });
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

    it('should throw BadRequestException if application is already WITHDRAWN', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'app-3',
        studentId: 'student-1',
        status: 'WITHDRAWN',
      });

      await expect(service.withdrawApplication('student-1', 'app-3')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if student does not own application', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'app-4',
        studentId: 'other-student',
        status: 'PENDING_REVIEW',
      });

      await expect(service.withdrawApplication('student-1', 'app-4')).rejects.toThrow(NotFoundException);
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
      prisma.application.update.mockResolvedValue({ ...mockApp, status: 'CANCELLED' });

      const result = await service.removeStudent('org-1', 'app-5');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.roomType.update).not.toHaveBeenCalled();
      expect(emailService.sendApplicationRemovalEmail).toHaveBeenCalledWith({
        studentEmail: 'john@student.com',
        studentName: 'John Doe',
        propertyName: 'Sunny Lodge',
      });
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

    it('should throw BadRequestException if application is already CANCELLED', async () => {
      jest.spyOn(service, 'getProviderApplication').mockResolvedValue({
        id: 'app-7',
        status: 'CANCELLED',
      } as any);

      await expect(service.removeStudent('org-1', 'app-7')).rejects.toThrow(BadRequestException);
    });
  });
});
