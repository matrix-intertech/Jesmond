import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppointmentsModule } from '../src/modules/appointments/appointments.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AppointmentsService } from '../src/modules/appointments/services/appointments.service';
import { AvailabilityService } from '../src/modules/appointments/services/availability.service';
import { BusinessCategory, OrgType, AppointmentStatus, UserRole } from '@prisma/client';

describe('Appointments & Availability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appointmentsService: AppointmentsService;
  let availabilityService: AvailabilityService;

  let testOrgId: string;
  let testBranchId: string;
  let testServiceId: string;
  let testStaffId: string;
  let staffUserId: string;
  let testCustomerId: string;
  let testManagerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AppointmentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    appointmentsService = app.get<AppointmentsService>(AppointmentsService);
    availabilityService = app.get<AvailabilityService>(AvailabilityService);

    // 1. Setup Test Data
    const uniqueSuffix = Date.now().toString();

    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${uniqueSuffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
      }
    });
    testOrgId = org.id;

    const branch = await prisma.retailBranch.create({
      data: {
        name: `Test Branch ${uniqueSuffix}`,
        organizationId: testOrgId,
      }
    });
    testBranchId = branch.id;

    const manager = await prisma.user.create({
      data: {
        email: `manager_${uniqueSuffix}@test.com`,
        firstName: 'Test',
        lastName: 'Manager',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: testOrgId, role: UserRole.ADMIN }
        }
      }
    });
    testManagerId = manager.id;

    const staffUser = await prisma.user.create({
      data: {
        email: `staff_${uniqueSuffix}@test.com`,
        firstName: 'Test',
        lastName: 'Staff',
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: { organizationId: testOrgId, role: UserRole.ORG_STAFF }
        }
      },
      include: { orgStaffRoles: true }
    });
    testStaffId = staffUser.orgStaffRoles[0].id; // OrgStaff ID instead of User ID
    staffUserId = staffUser.id;

    const customer = await prisma.user.create({
      data: {
        email: `customer_${uniqueSuffix}@test.com`,
        firstName: 'Test',
        lastName: 'Customer',
        role: UserRole.USER,
        password: 'hash',
      }
    });
    testCustomerId = customer.id;

    const service = await prisma.businessService.create({
      data: {
        name: 'Oil Change',
        organizationId: testOrgId,
        branchId: testBranchId,
        durationMins: 60,
        price: 50,
        currency: 'USD',
        bufferBeforeMins: 0,
        bufferAfterMins: 0,
      }
    });
    testServiceId = service.id;

    await prisma.staffServiceAssignment.create({
      data: {
        staffId: testStaffId,
        serviceId: testServiceId,
      }
    });

    await prisma.staffWorkingHours.create({
      data: {
        staffId: testStaffId,
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '17:00'
      }
    });

  });

  afterAll(async () => {
    // Cleanup
    await prisma.appointmentStatusHistory.deleteMany({ where: { appointment: { organizationId: testOrgId } } });
    await prisma.appointment.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.staffWorkingHours.deleteMany({ where: { staffId: testStaffId } });
    await prisma.staffServiceAssignment.deleteMany({ where: { serviceId: testServiceId } });
    await prisma.businessService.deleteMany({ where: { id: testServiceId } });
    await prisma.orgStaff.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.user.deleteMany({ where: { id: { in: [testManagerId, staffUserId, testCustomerId].filter(Boolean) as string[] } } });
    await prisma.retailBranch.deleteMany({ where: { id: testBranchId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
    
    await app.close();
  });

  describe('AvailabilityService', () => {
    it('should calculate available slots based on staff working hours', async () => {
      // Assuming 2026-10-12 is a Monday
      const res = await availabilityService.getAvailability(testServiceId, '2026-10-12', 'UTC');
      expect(res.availableSlots.length).toBe(8); // 9am to 5pm, 60 min slots = 8 slots
      expect(res.availableSlots[0].startTime).toBe('09:00');
      expect(res.availableSlots[7].endTime).toBe('17:00');
    });
  });

  describe('Concurrency & Locking Protocol', () => {
    it('should prevent double booking via concurrent submissions', async () => {
      const startTime = new Date('2026-10-12T09:00:00Z');
      const endTime = new Date('2026-10-12T10:00:00Z');

      // Attempt 3 concurrent bookings for a slot that only has 1 staff member
      const promises = [
        appointmentsService.createPendingAppointment({
          customerId: testCustomerId,
          branchId: testBranchId,
          serviceId: testServiceId,
          startTime,
          endTime,
          timezone: 'UTC'
        }),
        appointmentsService.createPendingAppointment({
          customerId: testCustomerId,
          branchId: testBranchId,
          serviceId: testServiceId,
          startTime,
          endTime,
          timezone: 'UTC'
        }),
        appointmentsService.createPendingAppointment({
          customerId: testCustomerId,
          branchId: testBranchId,
          serviceId: testServiceId,
          startTime,
          endTime,
          timezone: 'UTC'
        })
      ];

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Only 1 should succeed due to pg_advisory_xact_lock protecting capacity counts
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(2);

      const errorMsg = (failed[0] as PromiseRejectedResult).reason.message;
      expect(errorMsg).toContain('Time slot is no longer available (overbooked)');
    });

    it('should prevent concurrent approvals for overlapping slots for the same staff', async () => {
      // We need to create a second service and assign the same staff
      const service2 = await prisma.businessService.create({
        data: {
          name: 'Tire Rotation',
          organizationId: testOrgId,
          branchId: testBranchId,
          durationMins: 60,
          price: 40,
          currency: 'USD',
          bufferBeforeMins: 0,
          bufferAfterMins: 0,
        }
      });
      await prisma.staffServiceAssignment.create({
        data: { staffId: testStaffId, serviceId: service2.id }
      });

      const startTime = new Date('2026-10-12T10:00:00Z');
      const endTime = new Date('2026-10-12T11:00:00Z');

      // Create two pending requests for different services at the same time
      const appt1 = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId, startTime, endTime, timezone: 'UTC'
      });
      const appt2 = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: service2.id, startTime, endTime, timezone: 'UTC'
      });

      // Attempt concurrent approval
      const promises = [
        appointmentsService.approveAppointment(appt1.id, testOrgId, testStaffId, testManagerId),
        appointmentsService.approveAppointment(appt2.id, testOrgId, testStaffId, testManagerId)
      ];

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Only 1 approval should succeed
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);

      const errorMsg = (failed[0] as PromiseRejectedResult).reason.message;
      expect(errorMsg).toContain('Staff member is not available');

      // Cleanup service2
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointment: { serviceId: service2.id } } });
      await prisma.appointment.deleteMany({ where: { serviceId: service2.id } });
      await prisma.staffServiceAssignment.deleteMany({ where: { serviceId: service2.id } });
      await prisma.businessService.delete({ where: { id: service2.id } });
    });
  });

  describe('Business Logic & Validations', () => {
    let testApptId: string;

    beforeEach(async () => {
      const startTime = new Date('2026-10-14T10:00:00Z');
      const endTime = new Date('2026-10-14T11:00:00Z');
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId,
        branchId: testBranchId,
        serviceId: testServiceId,
        startTime,
        endTime,
        timezone: 'UTC'
      });
      testApptId = appt.id;
    });

    afterEach(async () => {
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: testApptId } });
      await prisma.appointment.delete({ where: { id: testApptId } });
    });

    it('should prevent assigning unqualified staff to an appointment', async () => {
      // Unqualified staff (random UUID)
      await expect(
        appointmentsService.approveAppointment(testApptId, testOrgId, '123e4567-e89b-12d3-a456-426614174000', testManagerId)
      ).rejects.toThrow('Staff member is not qualified');
    });

    it('should handle rejection and correctly free up the slot for others', async () => {
      await appointmentsService.rejectAppointment(testApptId, testOrgId, testManagerId, 'Too busy');
      
      const appt = await prisma.appointment.findUnique({ where: { id: testApptId } });
      expect(appt?.status).toBe(AppointmentStatus.REJECTED);
      expect(appt?.rejectionReason).toBe('Too busy');

      // The slot should now be available again for a new booking
      const startTime = new Date('2026-10-14T10:00:00Z');
      const endTime = new Date('2026-10-14T11:00:00Z');
      const newAppt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId,
        branchId: testBranchId,
        serviceId: testServiceId,
        startTime,
        endTime,
        timezone: 'UTC'
      });
      expect(newAppt).toBeDefined();

      // Clean up the newly created one
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: newAppt.id } });
      await prisma.appointment.delete({ where: { id: newAppt.id } });
    });

    it('should prevent invalid status transition (e.g. cancelling an already cancelled appt)', async () => {
      await appointmentsService.cancelCustomerAppointment(testApptId, testCustomerId, 'Changed mind');
      
      await expect(
        appointmentsService.cancelCustomerAppointment(testApptId, testCustomerId, 'Changed mind again')
      ).rejects.toThrow('Invalid status transition');
    });

    it('should prevent cross-tenant management', async () => {
      await expect(
        appointmentsService.rejectAppointment(testApptId, 'fake-org-id', testManagerId, 'Reason')
      ).rejects.toThrow('Cannot manage this appointment');
    });
  });
});
