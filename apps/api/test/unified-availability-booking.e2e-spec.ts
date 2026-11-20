import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import { AppointmentsModule } from '../src/modules/appointments/appointments.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AppointmentsService } from '../src/modules/appointments/services/appointments.service';
import { AvailabilityService } from '../src/modules/appointments/services/availability.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AppointmentWhatsAppService } from '../src/modules/appointments/services/appointment-whatsapp.service';
import { AppointmentEmailService } from '../src/modules/appointments/services/appointment-email.service';
import { BusinessCategory, OrgType, UserRole } from '@prisma/client';

describe('Unified Staff Availability & Booking Validation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appointmentsService: AppointmentsService;
  let availabilityService: AvailabilityService;

  let orgId: string;
  let branchId: string;
  let managerId: string;
  let customerId: string;

  let mechanicAStaffId: string;
  let mechanicBStaffId: string;

  let standardServiceId: string;
  let tyreServiceId: string;

  const testMonday = '2026-11-23'; // Monday (dayOfWeek = 1, in the future)
  const testTuesday = '2026-11-24'; // Tuesday (dayOfWeek = 2, in the future)
  const testWednesday = '2026-11-25'; // Wednesday (dayOfWeek = 3, in the future)
  const testThursday = '2026-11-26'; // Thursday (dayOfWeek = 4, in the future)
  const testSunday = '2026-11-29'; // Sunday (dayOfWeek = 0, in the future)

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        AppointmentsService,
        AvailabilityService,
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue(undefined) },
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

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    appointmentsService = app.get<AppointmentsService>(AppointmentsService);
    availabilityService = app.get<AvailabilityService>(AvailabilityService);

    const suffix = `unified_${Date.now()}`;

    // 1. Create Organization (MECHANICS category)
    const org = await prisma.organization.create({
      data: {
        name: `Jesmond Auto Garage ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
        isPubliclyVisible: true,
      },
    });
    orgId = org.id;

    // 2. Create Branch
    const branch = await prisma.retailBranch.create({
      data: {
        name: `Jesmond Workshop ${suffix}`,
        organizationId: orgId,
        isActive: true,
      },
    });
    branchId = branch.id;

    // 3. Create Manager User
    const manager = await prisma.user.create({
      data: {
        email: `manager_${suffix}@workshop.com`,
        firstName: 'Bob',
        lastName: 'Manager',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: orgId, role: UserRole.ADMIN, retailBranchId: branchId },
        },
      },
    });
    managerId = manager.id;

    // 4. Create Customer User
    const customer = await prisma.user.create({
      data: {
        email: `customer_${suffix}@client.com`,
        firstName: 'Alice',
        lastName: 'Motorist',
        role: UserRole.RESIDENT,
        password: 'hash',
      },
    });
    customerId = customer.id;

    // 5. Create Mechanic A (qualified for Standard Service & Tyre Service)
    const mechanicAUser = await prisma.user.create({
      data: {
        email: `mechA_${suffix}@workshop.com`,
        firstName: 'Dave',
        lastName: 'MechanicA',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: orgId, role: UserRole.ORG_STAFF, retailBranchId: branchId },
        },
      },
      include: { orgStaffRoles: true },
    });
    mechanicAStaffId = mechanicAUser.orgStaffRoles[0].id;

    // 6. Create Mechanic B (qualified for Standard Service only)
    const mechanicBUser = await prisma.user.create({
      data: {
        email: `mechB_${suffix}@workshop.com`,
        firstName: 'Steve',
        lastName: 'MechanicB',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: orgId, role: UserRole.ORG_STAFF, retailBranchId: branchId },
        },
      },
      include: { orgStaffRoles: true },
    });
    mechanicBStaffId = mechanicBUser.orgStaffRoles[0].id;

    // 7. Create Services
    // Standard Service (60 min)
    const standardService = await prisma.businessService.create({
      data: {
        name: `Full Vehicle Service ${suffix}`,
        durationMins: 60,
        price: 18000,
        organizationId: orgId,
        branchId,
        isActive: true,
      },
    });
    standardServiceId = standardService.id;

    // Tyre Service (60 min)
    const tyreService = await prisma.businessService.create({
      data: {
        name: `Tyre Replacement ${suffix}`,
        durationMins: 60,
        price: 12000,
        organizationId: orgId,
        branchId,
        isActive: true,
      },
    });
    tyreServiceId = tyreService.id;

    // Assign Service Qualifications:
    // Mechanic A -> Standard & Tyre
    await prisma.staffServiceAssignment.createMany({
      data: [
        { staffId: mechanicAStaffId, serviceId: standardServiceId },
        { staffId: mechanicAStaffId, serviceId: tyreServiceId },
      ],
    });

    // Mechanic B -> Standard only
    await prisma.staffServiceAssignment.create({
      data: { staffId: mechanicBStaffId, serviceId: standardServiceId },
    });

    // 8. Configure Working Hours:
    // Mechanic A:
    // - Monday: 09:00 - 17:00
    // - Tuesday: 09:00 - 13:00 (morning shift)
    await prisma.staffWorkingHours.createMany({
      data: [
        { staffId: mechanicAStaffId, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { staffId: mechanicAStaffId, dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
      ],
    });

    // Mechanic B:
    // - Monday: 10:00 - 18:00
    // - Tuesday: 13:00 - 17:00 (afternoon shift)
    await prisma.staffWorkingHours.createMany({
      data: [
        { staffId: mechanicBStaffId, dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
        { staffId: mechanicBStaffId, dayOfWeek: 2, startTime: '13:00', endTime: '17:00' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.appointmentStatusHistory.deleteMany({
      where: { appointment: { organizationId: orgId } },
    });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.staffTimeOff.deleteMany({ where: { organizationId: orgId } });
    await prisma.staffWorkingHours.deleteMany({
      where: { staffId: { in: [mechanicAStaffId, mechanicBStaffId] } },
    });
    await prisma.staffServiceAssignment.deleteMany({
      where: { staffId: { in: [mechanicAStaffId, mechanicBStaffId] } },
    });
    await prisma.businessService.deleteMany({ where: { organizationId: orgId } });
    await prisma.retailBranch.deleteMany({ where: { organizationId: orgId } });
    await prisma.orgStaff.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({
      where: { id: { in: [managerId, customerId] } },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await app.close();
  });

  describe('Unified Availability Engine Scenarios', () => {
    it('Scenario 1: One employee available — slot enabled (09:00 Monday)', async () => {
      // Mechanic A works 09:00-17:00, Mechanic B starts at 10:00.
      const res = await availabilityService.getAvailability(
        standardServiceId,
        testMonday,
        'Australia/Sydney',
      );

      const slot09 = res.slots.find((s) => s.startTime === '09:00');
      expect(slot09).toBeDefined();
      expect(slot09?.isAvailable).toBe(true);
      expect(res.availableSlots.some((s) => s.startTime === '09:00')).toBe(true);
    });

    it('Scenario 4: Two employees, one busy — slot remains enabled (10:00 Monday)', async () => {
      // Both Mechanic A and B work at 10:00.
      // Book Mechanic A for 10:00 - 11:00
      await prisma.appointment.create({
        data: {
          organizationId: orgId,
          branchId,
          serviceId: standardServiceId,
          staffId: mechanicAStaffId,
          customerId,
          startTime: new Date(`${testMonday}T10:00:00.000Z`),
          endTime: new Date(`${testMonday}T11:00:00.000Z`),
          timezone: 'Australia/Sydney',
          status: 'CONFIRMED',
          serviceName: 'Vehicle Service',
          durationMins: 60,
        },
      });

      const res = await availabilityService.getAvailability(
        standardServiceId,
        testMonday,
        'Australia/Sydney',
      );

      // Mechanic B is still free, so 10:00 must remain enabled
      const slot10 = res.slots.find((s) => s.startTime === '10:00');
      expect(slot10).toBeDefined();
      expect(slot10?.isAvailable).toBe(true);
      expect(res.availableSlots.some((s) => s.startTime === '10:00')).toBe(true);
    });

    it('Scenario 2 & 5: All employees busy / offline — slot disabled (10:00 Monday)', async () => {
      // Mechanic A is already busy at 10:00-11:00.
      // Now Mechanic B marks offline work from 10:00 to 12:00.
      const block = await appointmentsService.createTimeOffBlock(orgId, managerId, {
        staffId: mechanicBStaffId,
        startTime: `${testMonday}T10:00:00.000Z`,
        endTime: `${testMonday}T12:00:00.000Z`,
        type: 'OFFLINE_WORK',
        reason: 'Workshop stock inventory',
      });
      expect(block.id).toBeDefined();

      const res = await availabilityService.getAvailability(
        standardServiceId,
        testMonday,
        'Australia/Sydney',
      );

      // At 10:00, Mechanic A is busy and Mechanic B is offline -> 10:00 must be DISABLED
      const slot10 = res.slots.find((s) => s.startTime === '10:00');
      expect(slot10?.isAvailable).toBe(false);
      expect(res.availableSlots.some((s) => s.startTime === '10:00')).toBe(false);

      // Slots outside the blocked window (e.g. 12:00) should remain available
      const slot12 = res.slots.find((s) => s.startTime === '12:00');
      expect(slot12?.isAvailable).toBe(true);
    });

    it('Scenario 3: Employee on leave — slot disabled (Tuesday morning)', async () => {
      // On Tuesday, Mechanic A is scheduled 09:00-13:00, Mechanic B is scheduled 13:00-17:00.
      // Mark Mechanic A on LEAVE for the entire day.
      await appointmentsService.createTimeOffBlock(orgId, managerId, {
        staffId: mechanicAStaffId,
        startTime: `${testTuesday}T00:00:00.000Z`,
        endTime: `${testTuesday}T23:59:59.000Z`,
        type: 'LEAVE',
        reason: 'Annual leave',
      });

      const res = await availabilityService.getAvailability(
        standardServiceId,
        testTuesday,
        'Australia/Sydney',
      );

      // 09:00 Tuesday: Mechanic A on leave, Mechanic B not yet working -> DISABLED
      const slot09 = res.slots.find((s) => s.startTime === '09:00');
      expect(slot09?.isAvailable).toBe(false);

      // 13:00 Tuesday: Mechanic B is working and free -> ENABLED
      const slot13 = res.slots.find((s) => s.startTime === '13:00');
      expect(slot13?.isAvailable).toBe(true);
    });

    it('Scenario 7 & 8: Existing appointment overlaps requested duration — employee excluded', async () => {
      // Mechanic B has an appointment at 14:00 - 15:00 on Monday.
      // A customer requests 14:30 - 15:30.
      // That window overlaps with 14:00-15:00.
      await prisma.appointment.create({
        data: {
          organizationId: orgId,
          branchId,
          serviceId: standardServiceId,
          staffId: mechanicBStaffId,
          customerId,
          startTime: new Date(`${testMonday}T14:00:00.000Z`),
          endTime: new Date(`${testMonday}T15:00:00.000Z`),
          timezone: 'Australia/Sydney',
          status: 'CONFIRMED',
          serviceName: 'Job Booking',
          durationMins: 60,
        },
      });

      // Also book Mechanic A at 14:00-15:00
      await prisma.appointment.create({
        data: {
          organizationId: orgId,
          branchId,
          serviceId: standardServiceId,
          staffId: mechanicAStaffId,
          customerId,
          startTime: new Date(`${testMonday}T14:00:00.000Z`),
          endTime: new Date(`${testMonday}T15:00:00.000Z`),
          timezone: 'Australia/Sydney',
          status: 'CONFIRMED',
          serviceName: 'Job Booking',
          durationMins: 60,
        },
      });

      const res = await availabilityService.getAvailability(
        standardServiceId,
        testMonday,
        'Australia/Sydney',
      );

      const slot14 = res.slots.find((s) => s.startTime === '14:00');
      expect(slot14?.isAvailable).toBe(false);
    });

    it('Scenario 9: Requested duration extends beyond employee availability — slot disabled', async () => {
      // Mechanic A shift ends at 17:00.
      // If a booking is requested at 16:30 for 60 mins (ends at 17:30), it extends beyond working hours.
      const validation = await prisma.$transaction((tx) =>
        availabilityService.validateBookingSlot(tx, {
          branchId,
          serviceId: standardServiceId,
          startTime: new Date(`${testMonday}T16:30:00.000Z`),
          endTime: new Date(`${testMonday}T17:30:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      );

      // Mechanic A ends at 17:00 (cannot cover until 17:30).
      // Mechanic B works until 18:00, so Mechanic B covers 16:30-17:30.
      expect(validation.isAvailable).toBe(true);

      // Now test 17:30 - 18:30 (extends beyond Mechanic B's 18:00 end time):
      const lateValidation = await prisma.$transaction((tx) =>
        availabilityService.validateBookingSlot(tx, {
          branchId,
          serviceId: standardServiceId,
          startTime: new Date(`${testMonday}T17:30:00.000Z`),
          endTime: new Date(`${testMonday}T18:30:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      );
      expect(lateValidation.isAvailable).toBe(false);
    });

    it('Scenario 10: Employee not eligible for requested service — excluded', async () => {
      // On Tuesday at 13:00:
      // Mechanic B is working (13:00 - 17:00) and completely free.
      // Mechanic A is on leave.
      // Mechanic B is qualified for Standard Service, but NOT for Tyre Service.
      
      // Standard Service at 13:00 Tuesday is AVAILABLE (Mechanic B covers it)
      const standardRes = await availabilityService.getAvailability(
        standardServiceId,
        testTuesday,
        'Australia/Sydney',
      );
      const standardSlot13 = standardRes.slots.find((s) => s.startTime === '13:00');
      expect(standardSlot13?.isAvailable).toBe(true);

      // Tyre Service at 13:00 Tuesday must be DISABLED because Mechanic B is not qualified for it
      const tyreRes = await availabilityService.getAvailability(
        tyreServiceId,
        testTuesday,
        'Australia/Sydney',
      );
      const tyreSlot13 = tyreRes.slots.find((s) => s.startTime === '13:00');
      expect(tyreSlot13).toBeDefined();
      expect(tyreSlot13?.isAvailable).toBe(false);
      expect(tyreRes.availableSlots.some((s) => s.startTime === '13:00')).toBe(false);

      // Direct booking of Tyre Service at 13:00 must be rejected by server
      await expect(
        appointmentsService.createPendingAppointment({
          customerId,
          branchId,
          serviceId: tyreServiceId,
          startTime: new Date(`${testTuesday}T13:00:00.000Z`),
          endTime: new Date(`${testTuesday}T14:00:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 11: Direct API request for unavailable slot — rejected by server', async () => {
      // At 10:00 Monday, both mechanics are occupied (A busy, B offline).
      // Attempt to bypass UI and book directly via appointmentsService.createPendingAppointment:
      await expect(
        appointmentsService.createPendingAppointment({
          customerId,
          branchId,
          serviceId: standardServiceId,
          startTime: new Date(`${testMonday}T10:00:00.000Z`),
          endTime: new Date(`${testMonday}T11:00:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 12: Concurrency protection — two simultaneous requests for the last employee', async () => {
      // At 13:00 Monday, Mechanic A and B are working, with NO existing bookings.
      // Suppose we have 1 pending appointment occupying 1 capacity, leaving exactly 1 available slot.
      await prisma.appointment.create({
        data: {
          organizationId: orgId,
          branchId,
          serviceId: standardServiceId,
          staffId: mechanicAStaffId, // Mechanic A booked
          customerId,
          startTime: new Date(`${testMonday}T13:00:00.000Z`),
          endTime: new Date(`${testMonday}T14:00:00.000Z`),
          timezone: 'Australia/Sydney',
          status: 'CONFIRMED',
          serviceName: 'Job Booking',
          durationMins: 60,
        },
      });

      // Now exactly 1 mechanic (Mechanic B) is free for 13:00 - 14:00.
      // Two customer requests attempt to book 13:00 - 14:00 simultaneously:
      const req1 = appointmentsService.createPendingAppointment({
        customerId,
        branchId,
        serviceId: standardServiceId,
        startTime: new Date(`${testMonday}T13:00:00.000Z`),
        endTime: new Date(`${testMonday}T14:00:00.000Z`),
        timezone: 'Australia/Sydney',
      });

      const req2 = appointmentsService.createPendingAppointment({
        customerId,
        branchId,
        serviceId: standardServiceId,
        startTime: new Date(`${testMonday}T13:00:00.000Z`),
        endTime: new Date(`${testMonday}T14:00:00.000Z`),
        timezone: 'Australia/Sydney',
      });

      const results = await Promise.allSettled([req1, req2]);
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Exactly ONE request must succeed and ONE must fail
      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);
      expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    });
  });

  describe('Section 11: Business & Employee Working Hours Management', () => {
    it('should configure branch operating hours and reflect closed days immediately', async () => {
      // Configure operating hours: Monday open 09:00-17:00, Sunday CLOSED
      const branchHours = [
        { dayOfWeek: 0, isOpen: false }, // Sunday CLOSED
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { dayOfWeek: 6, isOpen: false }, // Saturday CLOSED
      ];

      const updated = await appointmentsService.updateBranchOperatingHours(
        orgId,
        branchId,
        branchHours,
      );
      expect(updated.operatingHours).toBeDefined();

      // Check Sunday availability: branch is marked closed
      const sundayRes = await availabilityService.getAvailability(
        standardServiceId,
        testSunday,
        'Australia/Sydney',
      );
      expect(sundayRes.isBranchOpen).toBe(false);
      expect(sundayRes.availableSlots.length).toBe(0);

      // Attempt to book on Sunday via API -> must be rejected
      await expect(
        appointmentsService.createPendingAppointment({
          customerId,
          branchId,
          serviceId: standardServiceId,
          startTime: new Date(`${testSunday}T10:00:00.000Z`),
          endTime: new Date(`${testSunday}T11:00:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject booking outside business operating hours (e.g. 07:00 AM)', async () => {
      // Branch opens at 09:00. Booking at 07:00 AM must be rejected
      await expect(
        appointmentsService.createPendingAppointment({
          customerId,
          branchId,
          serviceId: standardServiceId,
          startTime: new Date(`${testMonday}T07:00:00.000Z`),
          endTime: new Date(`${testMonday}T08:00:00.000Z`),
          timezone: 'Australia/Sydney',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support split shifts (e.g. 09:00-12:00 and 14:00-17:00) and disable the break period', async () => {
      // Configure Wednesday with split shift
      const branchHours = [
        {
          dayOfWeek: 3, // Wednesday
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00',
          periods: [
            { openTime: '09:00', closeTime: '12:00' },
            { openTime: '14:00', closeTime: '17:00' },
          ],
        },
      ];

      await appointmentsService.updateBranchOperatingHours(orgId, branchId, branchHours);

      // Give Mechanic A working hours on Wednesday 09:00-17:00
      await prisma.staffWorkingHours.create({
        data: {
          staffId: mechanicAStaffId,
          dayOfWeek: 3,
          startTime: '09:00',
          endTime: '17:00',
        },
      });

      const wednesdayRes = await availabilityService.getAvailability(
        standardServiceId,
        testWednesday,
        'Australia/Sydney',
      );

      // 09:00 (period 1) -> available
      expect(wednesdayRes.availableSlots.some((s) => s.startTime === '09:00')).toBe(true);

      // 12:00 (break period 12:00 - 14:00) -> outside open periods, must be disabled
      const slot12 = wednesdayRes.slots.find((s) => s.startTime === '12:00');
      expect(slot12?.isAvailable).toBe(false);
      expect(slot12?.reason).toBe('OUTSIDE_BRANCH_HOURS');

      // 14:00 (period 2) -> available
      expect(wednesdayRes.availableSlots.some((s) => s.startTime === '14:00')).toBe(true);
    });

    it('should update employee working hours and immediately affect availability', async () => {
      // Update Mechanic B working hours for Thursday (day 4): 10:00 - 14:00
      await appointmentsService.updateStaffWorkingHours(orgId, mechanicBStaffId, {
        workingHours: [
          { dayOfWeek: 4, startTime: '10:00', endTime: '14:00', isWorking: true },
        ],
        serviceIds: [standardServiceId],
      });

      const thursRes = await availabilityService.getAvailability(
        standardServiceId,
        testThursday,
        'Australia/Sydney',
      );

      // 10:00 and 11:00 should be available
      expect(thursRes.availableSlots.some((s) => s.startTime === '10:00')).toBe(true);

      // 14:00 should NOT be available (shift ends at 14:00)
      const slot14 = thursRes.slots.find((s) => s.startTime === '14:00');
      expect(slot14?.isAvailable).toBe(false);
    });
  });
});
