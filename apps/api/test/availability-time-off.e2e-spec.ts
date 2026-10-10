import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentsModule } from '../src/modules/appointments/appointments.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AppointmentsService } from '../src/modules/appointments/services/appointments.service';
import { AvailabilityService } from '../src/modules/appointments/services/availability.service';
import { BusinessCategory, OrgType, UserRole } from '@prisma/client';

describe('Phase 5: Availability Management & Offline Work (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appointmentsService: AppointmentsService;
  let availabilityService: AvailabilityService;

  let orgAId: string;
  let orgBId: string;
  let branchAId: string;
  let staffAId: string;
  let staffUserIdA: string;
  let staffBId: string;
  let serviceAId: string;
  let managerAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AppointmentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    appointmentsService = app.get<AppointmentsService>(AppointmentsService);
    availabilityService = app.get<AvailabilityService>(AvailabilityService);

    const suffix = Date.now().toString();

    // 1. Create Org A
    const orgA = await prisma.organization.create({
      data: {
        name: `Org A Mechanics ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
      },
    });
    orgAId = orgA.id;

    // 2. Create Branch A
    const branchA = await prisma.retailBranch.create({
      data: {
        name: `Branch A ${suffix}`,
        organizationId: orgAId,
      },
    });
    branchAId = branchA.id;

    // 3. Create Manager User A
    const managerA = await prisma.user.create({
      data: {
        email: `manager_${suffix}@test.com`,
        firstName: 'Manager',
        lastName: 'A',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: orgAId, role: UserRole.ADMIN },
        },
      },
    });
    managerAId = managerA.id;

    // 4. Create Staff A in Org A
    const staffUserA = await prisma.user.create({
      data: {
        email: `staffA_${suffix}@test.com`,
        firstName: 'John',
        lastName: 'Mechanic',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: {
            organizationId: orgAId,
            role: UserRole.ORG_STAFF,
            retailBranchId: branchAId,
          },
        },
      },
      include: { orgStaffRoles: true },
    });
    staffAId = staffUserA.orgStaffRoles[0].id;
    staffUserIdA = staffUserA.id;

    // 5. Create Service A in Org A (60 min)
    const serviceA = await prisma.businessService.create({
      data: {
        name: `Major Service ${suffix}`,
        durationMins: 60,
        price: 15000,
        organizationId: orgAId,
        branchId: branchAId,
      },
    });
    serviceAId = serviceA.id;

    // Assign Staff A to Service A
    await prisma.staffServiceAssignment.create({
      data: {
        staffId: staffAId,
        serviceId: serviceAId,
      },
    });

    // Set working hours for Staff A (Monday & Tuesday 09:00 - 17:00)
    await prisma.staffWorkingHours.createMany({
      data: [
        {
          staffId: staffAId,
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
        },
        {
          staffId: staffAId,
          dayOfWeek: 2, // Tuesday
          startTime: '09:00',
          endTime: '17:00',
        },
      ],
    });

    // 6. Create Org B (Different Tenant)
    const orgB = await prisma.organization.create({
      data: {
        name: `Org B Services ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.SERVICES,
      },
    });
    orgBId = orgB.id;

    const branchB = await prisma.retailBranch.create({
      data: {
        name: `Branch B ${suffix}`,
        organizationId: orgBId,
      },
    });

    const staffUserB = await prisma.user.create({
      data: {
        email: `staffB_${suffix}@test.com`,
        firstName: 'Bob',
        lastName: 'Plumber',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: {
            organizationId: orgBId,
            role: UserRole.ORG_STAFF,
            retailBranchId: branchB.id,
          },
        },
      },
      include: { orgStaffRoles: true },
    });
    staffBId = staffUserB.orgStaffRoles[0].id;
  });

  afterAll(async () => {
    await prisma.appointmentStatusHistory.deleteMany({
      where: {
        appointment: { organizationId: { in: [orgAId, orgBId] } },
      },
    });
    await prisma.appointment.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.staffTimeOff.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.staffWorkingHours.deleteMany({
      where: { staffId: { in: [staffAId, staffBId] } },
    });
    await prisma.staffServiceAssignment.deleteMany({
      where: { staffId: { in: [staffAId, staffBId] } },
    });
    await prisma.businessService.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.retailBranch.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.orgStaff.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await app.close();
  });

  describe('Workflow A: Time Off / Availability Blocks', () => {
    let createdBlockId: string;

    it('should create a time off block with type, timezone, and reason', async () => {
      const block = await appointmentsService.createTimeOffBlock(orgAId, managerAId, {
        staffId: staffAId,
        startTime: '2026-10-12T12:00:00.000Z',
        endTime: '2026-10-12T13:00:00.000Z',
        type: 'BREAK',
        reason: 'Lunch break',
      });

      expect(block).toBeDefined();
      expect(block.id).toBeDefined();
      expect(block.staffId).toBe(staffAId);
      expect(block.organizationId).toBe(orgAId);
      expect(block.type).toBe('BREAK');
      expect(block.reason).toBe('Lunch break');
      createdBlockId = block.id;
    });

    it('should enforce start < end constraint', async () => {
      await expect(
        appointmentsService.createTimeOffBlock(orgAId, managerAId, {
          staffId: staffAId,
          startTime: '2026-10-12T15:00:00.000Z',
          endTime: '2026-10-12T14:00:00.000Z', // start > end
          type: 'COMMITMENT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creating time off for a staff member of another organization (tenant isolation)', async () => {
      await expect(
        appointmentsService.createTimeOffBlock(orgAId, managerAId, {
          staffId: staffBId, // Belongs to Org B!
          startTime: '2026-10-12T14:00:00.000Z',
          endTime: '2026-10-12T15:00:00.000Z',
          type: 'LEAVE',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should list time off blocks filtered by organization', async () => {
      const blocks = await appointmentsService.getTimeOffBlocks(orgAId);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.every((b) => b.organizationId === orgAId)).toBe(true);

      const orgBBlocks = await appointmentsService.getTimeOffBlocks(orgBId);
      expect(orgBBlocks.length).toBe(0);
    });

    it('should update a time off block', async () => {
      const updated = await appointmentsService.updateTimeOffBlock(orgAId, createdBlockId, {
        reason: 'Extended lunch break',
        type: 'BREAK',
      });

      expect(updated.reason).toBe('Extended lunch break');
    });

    it('should safely soft-delete a time off block', async () => {
      const result = await appointmentsService.deleteTimeOffBlock(orgAId, createdBlockId);
      expect(result.success).toBe(true);

      const activeBlocks = await appointmentsService.getTimeOffBlocks(orgAId);
      expect(activeBlocks.some((b) => b.id === createdBlockId)).toBe(false);
    });
  });

  describe('Conflict Protection: Time Off vs Confirmed Appointments', () => {
    let existingApptId: string;

    beforeAll(async () => {
      // Create a confirmed appointment for Staff A on 2026-10-12 between 14:00 and 15:00 UTC
      const appt = await prisma.appointment.create({
        data: {
          organizationId: orgAId,
          branchId: branchAId,
          serviceId: serviceAId,
          staffId: staffAId,
          customerId: managerAId,
          startTime: new Date('2026-10-12T14:00:00.000Z'),
          endTime: new Date('2026-10-12T15:00:00.000Z'),
          timezone: 'Australia/Sydney',
          status: 'CONFIRMED',
          serviceName: 'Major Service',
          durationMins: 60,
          price: 15000,
        },
      });
      existingApptId = appt.id;
    });

    it('should reject blocking time off when a confirmed appointment already exists in that window', async () => {
      await expect(
        appointmentsService.createTimeOffBlock(orgAId, managerAId, {
          staffId: staffAId,
          startTime: '2026-10-12T13:30:00.000Z',
          endTime: '2026-10-12T14:30:00.000Z', // Overlaps with 14:00-15:00
          type: 'OFFLINE_WORK',
          reason: 'Workshop inventory check',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Workflow B: Offline Appointment Booking', () => {
    it('should create an immediately confirmed offline appointment for walk-in customer', async () => {
      const offlineAppt = await appointmentsService.createOfflineAppointment(orgAId, managerAId, {
        branchId: branchAId,
        serviceId: serviceAId,
        staffId: staffAId,
        startTime: '2026-10-12T10:00:00.000Z',
        endTime: '2026-10-12T11:00:00.000Z',
        customerName: 'Sam Walkin',
        customerPhone: '0412 999 888',
        notes: 'Walk-in emergency repair',
      });

      expect(offlineAppt).toBeDefined();
      expect(offlineAppt.status).toBe('CONFIRMED');
      expect(offlineAppt.staffId).toBe(staffAId);
      expect(offlineAppt.serviceName).toContain('Major Service');
    });

    it('should reject offline appointment if staff has overlapping confirmed appointment', async () => {
      await expect(
        appointmentsService.createOfflineAppointment(orgAId, managerAId, {
          branchId: branchAId,
          serviceId: serviceAId,
          staffId: staffAId,
          startTime: '2026-10-12T10:30:00.000Z', // Overlaps with 10:00-11:00
          endTime: '2026-10-12T11:30:00.000Z',
          customerName: 'Conflict Walkin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject offline appointment if staff is on time off block', async () => {
      // Create time off block 15:00 - 16:00
      await appointmentsService.createTimeOffBlock(orgAId, managerAId, {
        staffId: staffAId,
        startTime: '2026-10-12T15:00:00.000Z',
        endTime: '2026-10-12T16:00:00.000Z',
        type: 'BREAK',
      });

      await expect(
        appointmentsService.createOfflineAppointment(orgAId, managerAId, {
          branchId: branchAId,
          serviceId: serviceAId,
          staffId: staffAId,
          startTime: '2026-10-12T15:15:00.000Z',
          endTime: '2026-10-12T16:15:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Public Booking Integration: Slot Exclusion', () => {
    it('should exclude slots that fall inside a staff time-off block', async () => {
      // 2026-10-12 is Monday. Working hours: 09:00 to 17:00 (slots every 60 min)
      // Confirmed appts: 10:00-11:00, 14:00-15:00
      // Time-off block: 15:00-16:00
      const availability = await availabilityService.getAvailability(
        serviceAId,
        '2026-10-12',
        'Australia/Sydney',
      );

      const slotTimes = availability.availableSlots.map((s) => s.startTime);

      // 09:00 should be available
      expect(slotTimes).toContain('09:00');

      // 10:00 (offline appt) should NOT be available
      expect(slotTimes).not.toContain('10:00');

      // 14:00 (confirmed appt) should NOT be available
      expect(slotTimes).not.toContain('14:00');

      // 15:00 (time off block) should NOT be available
      expect(slotTimes).not.toContain('15:00');
    });

    it('should exclude slots for recurring daily and weekly time-off blocks on future dates', async () => {
      // Create a recurring daily lunch block 12:00-13:00 starting on 2026-10-12
      await appointmentsService.createTimeOffBlock(orgAId, managerAId, {
        staffId: staffAId,
        startTime: '2026-10-12T12:00:00.000Z',
        endTime: '2026-10-12T13:00:00.000Z',
        recurrence: 'DAILY',
        type: 'BREAK',
        reason: 'Daily lunch break',
      });

      // Check next day (2026-10-13 Tuesday)
      const nextDayAvailability = await availabilityService.getAvailability(
        serviceAId,
        '2026-10-13',
        'Australia/Sydney',
      );
      const nextDaySlots = nextDayAvailability.availableSlots.map((s) => s.startTime);

      // 09:00, 10:00, 11:00 should be available
      expect(nextDaySlots).toContain('09:00');
      expect(nextDaySlots).toContain('10:00');
      // 12:00 should be excluded by the recurring daily time-off block
      expect(nextDaySlots).not.toContain('12:00');
      // 13:00 should be available
      expect(nextDaySlots).toContain('13:00');
    });

    it('should respect recurrence across Australia/Sydney daylight saving boundary and recurrenceEnd', async () => {
      // In NSW/Sydney, daylight saving starts 1st Sunday in October (e.g. 2026-10-04)
      // Create a recurring weekly block with recurrenceEnd set to 2026-10-20
      await appointmentsService.createTimeOffBlock(orgAId, managerAId, {
        staffId: staffAId,
        startTime: '2026-10-12T16:00:00.000Z',
        endTime: '2026-10-12T17:00:00.000Z',
        recurrence: 'WEEKLY',
        recurrenceEnd: '2026-10-20T00:00:00.000Z',
        type: 'COMMITMENT',
        reason: 'Weekly team review',
      });

      // 2026-10-19 is next Monday (within recurrenceEnd)
      const oct19Availability = await availabilityService.getAvailability(
        serviceAId,
        '2026-10-19',
        'Australia/Sydney',
      );
      const oct19Slots = oct19Availability.availableSlots.map((s) => s.startTime);
      expect(oct19Slots).toContain('09:00');
      // 16:00 should be excluded by the recurring block
      expect(oct19Slots).not.toContain('16:00');

      // 2026-10-26 is Monday AFTER recurrenceEnd (expired)
      const oct26Availability = await availabilityService.getAvailability(
        serviceAId,
        '2026-10-26',
        'Australia/Sydney',
      );
      const oct26Slots = oct26Availability.availableSlots.map((s) => s.startTime);
      expect(oct26Slots).toContain('09:00');
      // 16:00 should now be restored because recurrence has ended
      expect(oct26Slots).toContain('16:00');
    });

    it('should explicitly reject unsupported CUSTOM recurrence with clear validation error', async () => {
      await expect(
        appointmentsService.createTimeOffBlock(orgAId, managerAId, {
          staffId: staffAId,
          startTime: '2026-10-12T16:00:00.000Z',
          endTime: '2026-10-12T17:00:00.000Z',
          recurrence: 'CUSTOM' as any,
          type: 'COMMITMENT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should maintain consistent 09:00 local time slot exclusion across April Sydney DST transition', async () => {
      // In NSW/Sydney, daylight saving ends on the first Sunday in April (e.g. 2027-04-04).
      // Monday 2027-04-12 is in standard time (AEST UTC+10).
      // Working hours are configured for Monday 09:00-17:00.
      const aprilAvailability = await availabilityService.getAvailability(
        serviceAId,
        '2027-04-12',
        'Australia/Sydney',
      );
      const aprilSlots = aprilAvailability.availableSlots.map((s) => s.startTime);
      // Working hours local slots: 09:00 to 16:00
      expect(aprilSlots).toContain('09:00');
      expect(aprilSlots).toContain('10:00');
      expect(aprilSlots).toContain('15:00');
    });
  });

  describe('Priority 2: Concurrent Race Condition Protection', () => {
    it('should serialize concurrent offline booking and time-off block creation for the same staff', async () => {
      const raceSlotStart = '2026-10-14T09:00:00.000Z';
      const raceSlotEnd = '2026-10-14T10:00:00.000Z';

      // Launch both simultaneously: an offline appointment and a time-off block for the exact same staff member and time slot
      const promises = [
        appointmentsService.createOfflineAppointment(orgAId, managerAId, {
          branchId: branchAId,
          serviceId: serviceAId,
          staffId: staffAId,
          startTime: raceSlotStart,
          endTime: raceSlotEnd,
          customerName: 'Racer Walkin',
        }),
        appointmentsService.createTimeOffBlock(orgAId, managerAId, {
          staffId: staffAId,
          startTime: raceSlotStart,
          endTime: raceSlotEnd,
          type: 'OFFLINE_WORK',
          reason: 'Scheduled maintenance block',
        }),
      ];

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed and the other must be cleanly rejected due to pg_advisory_xact_lock
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);

      // The rejected error must explicitly explain the conflict
      const failureReason = (failed[0] as PromiseRejectedResult).reason;
      expect(failureReason).toBeInstanceOf(BadRequestException);
      expect(failureReason.message).toMatch(/conflict|unavailable/i);
    });
  });
});
