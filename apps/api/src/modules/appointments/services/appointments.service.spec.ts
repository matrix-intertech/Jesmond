import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AppointmentWhatsAppService } from './appointment-whatsapp.service';
import { AppointmentEmailService } from './appointment-email.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let waService: any;
  let emailService: any;

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
      retailBranch: {
        findUnique: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
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
        {
          provide: AppointmentWhatsAppService,
          useValue: {
            notifyBookingRequestReceived: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentRequestReceived: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentConfirmed: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentCancelled: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentRescheduled: jest.fn().mockResolvedValue({ sent: true }),
            notifyProviderNewAppointment: jest.fn().mockResolvedValue({ sent: true }),
          },
        },
        {
          provide: AppointmentEmailService,
          useValue: {
            notifyAppointmentRequestReceived: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentConfirmed: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentCancelled: jest.fn().mockResolvedValue({ sent: true }),
            notifyAppointmentRescheduled: jest.fn().mockResolvedValue({ sent: true }),
            notifyProviderNewAppointment: jest.fn().mockResolvedValue({ sent: true }),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    waService = module.get<AppointmentWhatsAppService>(AppointmentWhatsAppService);
    emailService = module.get<AppointmentEmailService>(AppointmentEmailService);
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
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            isWorking: true,
          },
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
        data: [
          {
            staffId: 'staff-456',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
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
      prisma.businessService.findMany.mockResolvedValue([
        { id: 'valid-svc-1' },
      ]);

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
            user: {
              id: 'deleted-user-id',
              firstName: 'Back',
              lastName: 'Again',
            },
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

  describe('createPendingAppointment', () => {
    it('should create a pending appointment and dispatch request notifications to customer and provider', async () => {
      const now = new Date(Date.now() + 86400000);
      const startTime = new Date(now.getTime() + 3600000);
      const endTime = new Date(startTime.getTime() + 30 * 60000);

      prisma.businessService.findUnique.mockResolvedValue({
        id: 'svc-1',
        isActive: true,
        branchId: 'branch-1',
        organizationId: 'org-1',
        durationMins: 30,
        price: 100,
        currency: 'AUD',
        name: 'General Consultation',
      });
      prisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-1',
      });
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        businessCategory: 'SERVICES',
        deletedAt: null,
        isPubliclyVisible: true,
      });
      prisma.appointment.count.mockResolvedValue(0);
      prisma.staffServiceAssignment.count.mockResolvedValue(1);
      prisma.appointment.create.mockResolvedValue({
        id: 'appt-123',
        customerId: 'cust-1',
        serviceName: 'General Consultation',
        status: 'PENDING_APPROVAL',
      });

      const result = await service.createPendingAppointment({
        customerId: 'cust-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        startTime,
        endTime,
        timezone: 'Australia/Sydney',
        customerNotes: 'Need assistance',
      });

      expect(result.id).toBe('appt-123');
      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 100,
            currency: 'AUD',
            serviceName: 'General Consultation',
          }),
        }),
      );
      expect(waService.notifyBookingRequestReceived).toHaveBeenCalledWith('appt-123');
      expect(emailService.notifyAppointmentRequestReceived).toHaveBeenCalledWith('appt-123');
      expect(emailService.notifyProviderNewAppointment).toHaveBeenCalledWith('appt-123');
    });
  });

  describe('createOfflineAppointment', () => {
    it('should successfully create an immediately confirmed offline appointment for walk-in customer', async () => {
      const startTime = '2026-11-20T10:00:00.000Z';
      const endTime = '2026-11-20T11:00:00.000Z';

      prisma.businessService.findUnique.mockResolvedValue({
        id: 'svc-offline-1',
        organizationId: 'org-1',
        name: 'Comprehensive Vehicle Safety Inspection',
        durationMins: 60,
        price: 8900,
        currency: 'AUD',
        deletedAt: null,
      });

      prisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-1',
      });

      prisma.orgStaff.findUnique.mockResolvedValue({
        id: 'staff-1',
        organizationId: 'org-1',
        deletedAt: null,
        user: { id: 'user-staff-1', firstName: 'John', lastName: 'Mechanic' },
      });

      prisma.staffServiceAssignment.findUnique.mockResolvedValue({
        staffId: 'staff-1',
        serviceId: 'svc-offline-1',
      });

      prisma.appointment.findFirst.mockResolvedValue(null); // No conflict
      prisma.staffTimeOff.findMany.mockResolvedValue([]); // No time-off conflict

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'cust-walkin-1',
        email: 'walkin@example.com',
        firstName: 'Dave',
        lastName: 'Walkin',
      });

      prisma.appointment.create.mockResolvedValue({
        id: 'appt-offline-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'svc-offline-1',
        staffId: 'staff-1',
        customerId: 'cust-walkin-1',
        status: 'CONFIRMED',
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        price: 8900,
        currency: 'AUD',
        serviceName: 'Comprehensive Vehicle Safety Inspection',
        customerNotes: '[Offline Booking] Urgent walk-in inspection (Customer: Dave Walkin)',
      });

      const result = await service.createOfflineAppointment('org-1', 'staff-creator-1', {
        branchId: 'branch-1',
        serviceId: 'svc-offline-1',
        staffId: 'staff-1',
        startTime,
        endTime,
        timezone: 'Australia/Sydney',
        customerName: 'Dave Walkin',
        customerPhone: '0412 345 678',
        customerEmail: 'walkin@example.com',
        notes: 'Urgent walk-in inspection',
      });

      expect(result.id).toBe('appt-offline-1');
      expect(result.status).toBe('CONFIRMED');
      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            branchId: 'branch-1',
            serviceId: 'svc-offline-1',
            staffId: 'staff-1',
            status: 'CONFIRMED',
            price: 8900,
            currency: 'AUD',
            serviceName: 'Comprehensive Vehicle Safety Inspection',
          }),
        }),
      );
    });

    it('should reject offline appointment if start time is after end time', async () => {
      await expect(
        service.createOfflineAppointment('org-1', 'staff-creator-1', {
          branchId: 'branch-1',
          serviceId: 'svc-offline-1',
          staffId: 'staff-1',
          startTime: '2026-11-20T12:00:00.000Z',
          endTime: '2026-11-20T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject offline appointment if staff has overlapping confirmed appointment', async () => {
      const startTime = '2026-11-20T10:00:00.000Z';
      const endTime = '2026-11-20T11:00:00.000Z';

      prisma.businessService.findUnique.mockResolvedValue({
        id: 'svc-offline-1',
        organizationId: 'org-1',
        name: 'Oil Change',
        durationMins: 60,
        price: 7900,
        currency: 'AUD',
        deletedAt: null,
      });

      prisma.retailBranch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-1',
      });

      prisma.orgStaff.findUnique.mockResolvedValue({
        id: 'staff-1',
        organizationId: 'org-1',
        deletedAt: null,
        user: { id: 'user-staff-1' },
      });

      prisma.staffServiceAssignment.findUnique.mockResolvedValue({
        staffId: 'staff-1',
        serviceId: 'svc-offline-1',
      });

      // Conflict exists
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'appt-existing',
        startTime: new Date('2026-11-20T10:30:00.000Z'),
        endTime: new Date('2026-11-20T11:30:00.000Z'),
      });

      await expect(
        service.createOfflineAppointment('org-1', 'staff-creator-1', {
          branchId: 'branch-1',
          serviceId: 'svc-offline-1',
          staffId: 'staff-1',
          startTime,
          endTime,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCustomerAppointmentHistory', () => {
    const mockCustomer = {
      id: 'cust-123',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '0412 999 888',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const mockAppointments = [
      {
        id: 'appt-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        customerId: 'cust-123',
        serviceId: 'svc-1',
        serviceName: 'Standard Car Service',
        status: AppointmentStatus.COMPLETED,
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 3600000),
        timezone: 'Australia/Sydney',
        price: 18900,
        currency: 'AUD',
        customerNotes: 'Please check brakes',
        staff: {
          id: 'staff-1',
          user: { id: 'u-1', firstName: 'Dave', lastName: 'Tradie', email: 'dave@tradie.com' },
        },
        service: { id: 'svc-1', name: 'Standard Car Service', durationMins: 60, price: 18900 },
        branch: { id: 'branch-1', name: 'Jesmond Central' },
      },
      {
        id: 'appt-2',
        organizationId: 'org-1',
        branchId: 'branch-1',
        customerId: 'cust-123',
        serviceId: 'svc-2',
        serviceName: 'Brake Inspection',
        status: AppointmentStatus.CONFIRMED,
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 1800000),
        timezone: 'Australia/Sydney',
        price: 8900,
        currency: 'AUD',
        customerNotes: '[Offline Booking] Urgent check',
        staff: {
          id: 'staff-1',
          user: { id: 'u-1', firstName: 'Dave', lastName: 'Tradie', email: 'dave@tradie.com' },
        },
        service: { id: 'svc-2', name: 'Brake Inspection', durationMins: 30, price: 8900 },
        branch: { id: 'branch-1', name: 'Jesmond Central' },
      },
      {
        id: 'appt-3',
        organizationId: 'org-1',
        branchId: 'branch-1',
        customerId: 'cust-123',
        serviceId: 'svc-3',
        serviceName: 'Wheel Alignment',
        status: AppointmentStatus.CANCELLED,
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 1800000),
        timezone: 'Australia/Sydney',
        price: 9900,
        currency: 'AUD',
        customerNotes: 'Cancelled by customer',
        staff: null,
        service: { id: 'svc-3', name: 'Wheel Alignment', durationMins: 30, price: 9900 },
        branch: { id: 'branch-1', name: 'Jesmond Central' },
      },
    ];

    it('should return customer details, summary metrics, and appointments list', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCustomer);
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await service.getCustomerAppointmentHistory('org-1', 'cust-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-123' },
        select: expect.objectContaining({ id: true, email: true }),
      });
      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', customerId: 'cust-123', deletedAt: null },
        orderBy: { startTime: 'desc' },
        include: expect.any(Object),
      });

      expect(result.customer.id).toBe('cust-123');
      expect(result.customer.firstName).toBe('Alice');
      expect(result.summary.total).toBe(3);
      expect(result.summary.completed).toBe(1);
      expect(result.summary.upcoming).toBe(1);
      expect(result.summary.cancelled).toBe(1);
      expect(result.appointments).toHaveLength(3);
    });

    it('should throw NotFoundException if customer does not exist in User table', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getCustomerAppointmentHistory('org-1', 'cust-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if customer belongs exclusively to another organization', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCustomer);
      prisma.appointment.findMany.mockResolvedValue([]);
      prisma.appointment.count.mockResolvedValue(3); // Belongs to other orgs

      await expect(
        service.getCustomerAppointmentHistory('org-1', 'cust-123'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.appointment.count).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-123',
          organizationId: { not: 'org-1' },
          deletedAt: null,
        },
      });
    });

    it('should return empty appointments and 0 summary counts if customer exists with no appointments', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCustomer);
      prisma.appointment.findMany.mockResolvedValue([]);
      prisma.appointment.count.mockResolvedValue(0);

      const result = await service.getCustomerAppointmentHistory('org-1', 'cust-123');

      expect(result.customer.id).toBe('cust-123');
      expect(result.summary.total).toBe(0);
      expect(result.summary.completed).toBe(0);
      expect(result.summary.upcoming).toBe(0);
      expect(result.summary.cancelled).toBe(0);
      expect(result.appointments).toHaveLength(0);
    });

    it('should apply filters correctly (status, search, date range)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCustomer);
      prisma.appointment.findMany.mockResolvedValue(mockAppointments);

      // Status filter
      const completedResult = await service.getCustomerAppointmentHistory('org-1', 'cust-123', {
        status: AppointmentStatus.COMPLETED,
      });
      expect(completedResult.appointments).toHaveLength(1);
      expect(completedResult.appointments[0].id).toBe('appt-1');

      // Search filter
      const searchResult = await service.getCustomerAppointmentHistory('org-1', 'cust-123', {
        search: 'Brake',
      });
      expect(searchResult.appointments).toHaveLength(1);
      expect(searchResult.appointments[0].id).toBe('appt-2');
    });
  });
});
