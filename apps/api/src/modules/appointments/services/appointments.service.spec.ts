import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma: any = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      $executeRaw: jest.fn(),
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      orgStaff: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      businessService: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      staffServiceAssignment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      staffWorkingHours: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      staffTimeOff: {
        findMany: jest.fn(),
      },
      appointment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addBusinessStaff', () => {
    const orgId = 'org-123';

    it('should successfully create a new staff member with user, assignments, and working hours', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'doctor@example.com',
        firstName: 'Sarah',
        lastName: 'Connor',
      });
      prisma.orgStaff.create.mockResolvedValue({
        id: 'staff-456',
        userId: 'new-user-id',
        organizationId: orgId,
      });
      prisma.orgStaff.findUnique.mockResolvedValue({
        id: 'staff-456',
        userId: 'new-user-id',
        organizationId: orgId,
        user: {
          id: 'new-user-id',
          firstName: 'Sarah',
          lastName: 'Connor',
          email: 'doctor@example.com',
          phone: null,
          avatarUrl: null,
        },
        serviceAssignments: [],
        workingHours: [],
      });

      const result = await service.addBusinessStaff(orgId, {
        email: 'doctor@example.com',
        firstName: 'Sarah',
        lastName: 'Connor',
        workingHours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isWorking: true },
        ],
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'doctor@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.orgStaff.create).toHaveBeenCalledWith({
        data: {
          userId: 'new-user-id',
          organizationId: orgId,
          role: 'ORG_STAFF',
        },
      });
      expect(prisma.staffWorkingHours.deleteMany).toHaveBeenCalledWith({
        where: { staffId: 'staff-456' },
      });
      expect(prisma.staffWorkingHours.createMany).toHaveBeenCalledWith({
        data: [{ staffId: 'staff-456', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      });
      expect(result.id).toBe('staff-456');
    });

    it('should throw BadRequestException if staff member already belongs to the organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@example.com',
      });
      prisma.orgStaff.findUnique.mockResolvedValue({
        id: 'existing-staff-id',
        userId: 'existing-user-id',
        organizationId: orgId,
        deletedAt: null,
      });

      await expect(
        service.addBusinessStaff(orgId, {
          email: 'existing@example.com',
          firstName: 'Existing',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invalid service IDs are provided', async () => {
      prisma.businessService.findMany.mockResolvedValue([{ id: 'valid-svc-1' }]);

      await expect(
        service.addBusinessStaff(orgId, {
          email: 'new@example.com',
          firstName: 'New',
          serviceIds: ['valid-svc-1', 'invalid-svc-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-activate staff member if they were previously soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'deleted-user-id',
        email: 'reactivate@example.com',
      });
      prisma.orgStaff.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId_organizationId) {
          return Promise.resolve({
            id: 'staff-deleted-id',
            userId: 'deleted-user-id',
            organizationId: orgId,
            deletedAt: new Date(),
          });
        }
        if (where.id) {
          return Promise.resolve({
            id: 'staff-deleted-id',
            user: { id: 'deleted-user-id', firstName: 'Back', lastName: 'Again' },
            serviceAssignments: [],
            workingHours: [],
          });
        }
        return null;
      });
      prisma.orgStaff.update.mockResolvedValue({
        id: 'staff-deleted-id',
        deletedAt: null,
      });

      const result = await service.addBusinessStaff(orgId, {
        email: 'reactivate@example.com',
        firstName: 'Back',
      });

      expect(prisma.orgStaff.update).toHaveBeenCalledWith({
        where: { id: 'staff-deleted-id' },
        data: { deletedAt: null },
      });
      expect(result.id).toBe('staff-deleted-id');
    });
  });
});
