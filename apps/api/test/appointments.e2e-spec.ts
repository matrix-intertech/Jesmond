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
          create: { organizationId: testOrgId, role: UserRole.ORG_STAFF, retailBranchId: testBranchId }
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

  describe('Hardening Validations', () => {
    let wrongOrgId: string;
    let wrongBranchId: string;
    let wrongStaffId: string;
    let wrongServiceId: string;
    let inactiveServiceId: string;
    let wrongCategoryBranchId: string;

    beforeAll(async () => {
      const org2 = await prisma.organization.create({
        data: { name: 'Wrong Org', type: OrgType.RETAIL, businessCategory: BusinessCategory.RETAIL }
      });
      wrongOrgId = org2.id;
      const branch2 = await prisma.retailBranch.create({
        data: { name: 'Wrong Branch', organizationId: wrongOrgId }
      });
      wrongBranchId = branch2.id;

      const branch3 = await prisma.retailBranch.create({
        data: { name: 'Another Branch', organizationId: testOrgId }
      });
      wrongCategoryBranchId = branch3.id;

      const user2 = await prisma.user.create({
        data: {
          email: 'wrongstaff@test.com', firstName: 'W', lastName: 'S', role: UserRole.ORG_STAFF, password: 'hash',
          orgStaffRoles: { create: { organizationId: wrongOrgId, retailBranchId: wrongBranchId, role: UserRole.ORG_STAFF } }
        },
        include: { orgStaffRoles: true }
      });
      wrongStaffId = user2.orgStaffRoles[0].id;

      const s2 = await prisma.businessService.create({
        data: { name: 'WService', organizationId: wrongOrgId, branchId: wrongBranchId, durationMins: 60, price: 50, currency: 'USD' }
      });
      wrongServiceId = s2.id;

      const s3 = await prisma.businessService.create({
        data: { name: 'Inactive', organizationId: testOrgId, branchId: testBranchId, durationMins: 60, price: 50, currency: 'USD', isActive: false }
      });
      inactiveServiceId = s3.id;
    });

    afterAll(async () => {
      await prisma.businessService.deleteMany({ where: { id: { in: [wrongServiceId, inactiveServiceId] } } });
      await prisma.orgStaff.deleteMany({ where: { id: wrongStaffId } });
      await prisma.user.deleteMany({ where: { email: 'wrongstaff@test.com' } });
      await prisma.retailBranch.deleteMany({ where: { id: { in: [wrongBranchId, wrongCategoryBranchId] } } });
      await prisma.organization.deleteMany({ where: { id: wrongOrgId } });
    });

    it('should reject booking if service is inactive', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const futureEnd = new Date(future.getTime() + 3600000);
      await expect(appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: inactiveServiceId,
        startTime: future, endTime: futureEnd, timezone: 'UTC'
      })).rejects.toThrow('Service is not active');
    });

    it('should reject booking if branch does not match service branch', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const futureEnd = new Date(future.getTime() + 3600000);
      await expect(appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: wrongCategoryBranchId, serviceId: testServiceId,
        startTime: future, endTime: futureEnd, timezone: 'UTC'
      })).rejects.toThrow('Service does not belong to this branch');
    });

    it('should reject booking if business category is not eligible', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const futureEnd = new Date(future.getTime() + 3600000);
      await expect(appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: wrongBranchId, serviceId: wrongServiceId,
        startTime: future, endTime: futureEnd, timezone: 'UTC'
      })).rejects.toThrow('Business is not eligible for appointments');
    });

    it('should reject booking if time is in the past', async () => {
      const past = new Date(Date.now() - 86400000);
      const pastEnd = new Date(past.getTime() + 3600000);
      await expect(appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId,
        startTime: past, endTime: pastEnd, timezone: 'UTC'
      })).rejects.toThrow('Appointment cannot be in the past');
    });

    it('should reject booking if duration does not match service duration', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const futureEnd = new Date(future.getTime() + 1800000);
      await expect(appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId,
        startTime: future, endTime: futureEnd, timezone: 'UTC'
      })).rejects.toThrow('Invalid appointment duration');
    });
  });

  describe('Hardening Approval Validations', () => {
    let testApptId: string;
    let crossOrgStaffId: string;
    let crossBranchStaffId: string;
    let tempOrgId: string;

    beforeAll(async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const futureEnd = new Date(future.getTime() + 3600000);
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId, startTime: future, endTime: futureEnd, timezone: 'UTC'
      });
      testApptId = appt.id;

      const tempOrg = await prisma.organization.create({ data: { name: 'Temp', type: OrgType.RETAIL } });
      tempOrgId = tempOrg.id;

      const userOrg = await prisma.user.create({
        data: {
          email: 'wrongorgstaff@test.com', firstName: 'W', lastName: 'O', role: UserRole.ORG_STAFF, password: 'hash',
          orgStaffRoles: { create: { organizationId: tempOrg.id, role: UserRole.ORG_STAFF } }
        },
        include: { orgStaffRoles: true }
      });
      crossOrgStaffId = userOrg.orgStaffRoles[0].id;

      const branchDiff = await prisma.retailBranch.create({ data: { name: 'Diff', organizationId: testOrgId } });
      const userBranch = await prisma.user.create({
        data: {
          email: 'wrongbranchstaff@test.com', firstName: 'W', lastName: 'B', role: UserRole.ORG_STAFF, password: 'hash',
          orgStaffRoles: { create: { organizationId: testOrgId, retailBranchId: branchDiff.id, role: UserRole.ORG_STAFF } }
        },
        include: { orgStaffRoles: true }
      });
      crossBranchStaffId = userBranch.orgStaffRoles[0].id;

      await prisma.staffServiceAssignment.createMany({
        data: [
          { staffId: crossOrgStaffId, serviceId: testServiceId },
          { staffId: crossBranchStaffId, serviceId: testServiceId }
        ]
      });
    });

    afterAll(async () => {
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: testApptId } });
      await prisma.appointment.delete({ where: { id: testApptId } });
      await prisma.staffServiceAssignment.deleteMany({ where: { staffId: { in: [crossOrgStaffId, crossBranchStaffId] } } });
      await prisma.orgStaff.deleteMany({ where: { id: { in: [crossOrgStaffId, crossBranchStaffId] } } });
      await prisma.user.deleteMany({ where: { email: { in: ['wrongorgstaff@test.com', 'wrongbranchstaff@test.com'] } } });
      await prisma.retailBranch.deleteMany({ where: { organizationId: testOrgId, name: 'Diff' } });
      await prisma.organization.delete({ where: { id: tempOrgId } });
    });

    it('should reject approval if staff is from a different organization', async () => {
      await expect(
        appointmentsService.approveAppointment(testApptId, testOrgId, crossOrgStaffId, testManagerId)
      ).rejects.toThrow('Staff member does not belong to this organization');
    });

    it('should reject approval if staff is assigned to a different branch', async () => {
      await expect(
        appointmentsService.approveAppointment(testApptId, testOrgId, crossBranchStaffId, testManagerId)
      ).rejects.toThrow('Staff member is not assigned to this branch');
    });
  });

  describe('Overlap Detection and Multi-Branch Tests', () => {
    let multiBranchStaffId: string;
    let baseTime: Date;

    beforeAll(async () => {
      baseTime = new Date();
      baseTime.setUTCHours(10, 0, 0, 0); // Start at 10:00 AM UTC
      // Move to a day in the future
      baseTime.setDate(baseTime.getDate() + 7);

      // Create a staff member assigned to the branch via OrgStaffBranch (multi-branch)
      const userMb = await prisma.user.create({
        data: {
          email: 'multibranchstaff@test.com', firstName: 'M', lastName: 'B', role: UserRole.ORG_STAFF, password: 'hash',
          orgStaffRoles: { create: { organizationId: testOrgId, role: UserRole.ORG_STAFF } }
        },
        include: { orgStaffRoles: true }
      });
      multiBranchStaffId = userMb.orgStaffRoles[0].id;

      await prisma.orgStaffBranch.create({
        data: { staffId: multiBranchStaffId, branchId: testBranchId }
      });
      await prisma.staffServiceAssignment.create({
        data: { staffId: multiBranchStaffId, serviceId: testServiceId }
      });
      await prisma.staffWorkingHours.create({
        data: { staffId: multiBranchStaffId, dayOfWeek: baseTime.getUTCDay(), startTime: '00:00', endTime: '23:59' }
      });
    });

    afterAll(async () => {
      await prisma.staffWorkingHours.deleteMany({ where: { staffId: multiBranchStaffId } });
      await prisma.staffServiceAssignment.deleteMany({ where: { staffId: multiBranchStaffId } });
      await prisma.orgStaffBranch.deleteMany({ where: { staffId: multiBranchStaffId } });
      await prisma.orgStaff.deleteMany({ where: { id: multiBranchStaffId } });
      await prisma.user.deleteMany({ where: { email: 'multibranchstaff@test.com' } });
    });

    it('should approve appointment for multi-branch staff', async () => {
      const startTime = new Date(baseTime.getTime());
      const endTime = new Date(baseTime.getTime() + 60 * 60000);

      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId, startTime, endTime, timezone: 'UTC'
      });

      const approved = await appointmentsService.approveAppointment(appt.id, testOrgId, multiBranchStaffId, testManagerId);
      expect(approved.status).toBe(AppointmentStatus.CONFIRMED);

      // We will use this CONFIRMED appointment (baseTime to baseTime + 1h) to test overlaps
    });

    it('should reject when requested fully contains existing', async () => {
      // Existing: 10:00 to 11:00
      // Requested: 09:30 to 11:30 (Duration must match service, so we'll adjust the service temporarily, or test approveAppointment where duration doesn't matter for the staff conflict query)
      // Actually, createPendingAppointment checks service.durationMins. Let's just create a new appointment that overlaps and attempt to approve it for the same staff.
      // Wait, approveAppointment checks staff overlaps regardless of service duration.
      // Let's create a temporary service with 120 mins duration.
      const s120 = await prisma.businessService.create({
        data: { name: 'S120', organizationId: testOrgId, branchId: testBranchId, durationMins: 120, price: 50, currency: 'USD' }
      });
      await prisma.staffServiceAssignment.create({ data: { staffId: multiBranchStaffId, serviceId: s120.id } });

      const startTime = new Date(baseTime.getTime() - 30 * 60000); // 09:30
      const endTime = new Date(baseTime.getTime() + 90 * 60000); // 11:30
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: s120.id, startTime, endTime, timezone: 'UTC'
      });

      await expect(
        appointmentsService.approveAppointment(appt.id, testOrgId, multiBranchStaffId, testManagerId)
      ).rejects.toThrow('Staff member is not available for this time');

      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: appt.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
      await prisma.staffServiceAssignment.deleteMany({ where: { staffId: multiBranchStaffId, serviceId: s120.id } });
      await prisma.businessService.delete({ where: { id: s120.id } });
    });

    it('should reject when existing fully contains requested', async () => {
      // Existing: 10:00 to 11:00
      // Requested: 10:15 to 10:45 (Service 30 mins)
      const s30 = await prisma.businessService.create({
        data: { name: 'S30', organizationId: testOrgId, branchId: testBranchId, durationMins: 30, price: 50, currency: 'USD' }
      });
      await prisma.staffServiceAssignment.create({ data: { staffId: multiBranchStaffId, serviceId: s30.id } });

      const startTime = new Date(baseTime.getTime() + 15 * 60000); // 10:15
      const endTime = new Date(baseTime.getTime() + 45 * 60000); // 10:45
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: s30.id, startTime, endTime, timezone: 'UTC'
      });

      await expect(
        appointmentsService.approveAppointment(appt.id, testOrgId, multiBranchStaffId, testManagerId)
      ).rejects.toThrow('Staff member is not available for this time');

      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: appt.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
      await prisma.staffServiceAssignment.deleteMany({ where: { staffId: multiBranchStaffId, serviceId: s30.id } });
      await prisma.businessService.delete({ where: { id: s30.id } });
    });

    it('should reject partial overlap at the end', async () => {
      // Existing: 10:00 to 11:00
      // Requested: 10:30 to 11:30
      const startTime = new Date(baseTime.getTime() + 30 * 60000);
      const endTime = new Date(baseTime.getTime() + 90 * 60000);
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId, startTime, endTime, timezone: 'UTC'
      });

      await expect(
        appointmentsService.approveAppointment(appt.id, testOrgId, multiBranchStaffId, testManagerId)
      ).rejects.toThrow('Staff member is not available for this time');

      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: appt.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
    });

    it('should allow adjacent appointments without overlap', async () => {
      // Existing: 10:00 to 11:00
      // Requested: 11:00 to 12:00
      const startTime = new Date(baseTime.getTime() + 60 * 60000); // 11:00
      const endTime = new Date(baseTime.getTime() + 120 * 60000); // 12:00
      const appt = await appointmentsService.createPendingAppointment({
        customerId: testCustomerId, branchId: testBranchId, serviceId: testServiceId, startTime, endTime, timezone: 'UTC'
      });

      const approved = await appointmentsService.approveAppointment(appt.id, testOrgId, multiBranchStaffId, testManagerId);
      expect(approved.status).toBe(AppointmentStatus.CONFIRMED);
    });
  });
});
