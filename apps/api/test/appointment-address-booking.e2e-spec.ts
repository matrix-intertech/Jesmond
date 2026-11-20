import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AppointmentsService } from '../src/modules/appointments/services/appointments.service';
import { AvailabilityService } from '../src/modules/appointments/services/availability.service';
import { CustomerAddressesService } from '../src/modules/customer-addresses/services/customer-addresses.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AppointmentWhatsAppService } from '../src/modules/appointments/services/appointment-whatsapp.service';
import { AppointmentEmailService } from '../src/modules/appointments/services/appointment-email.service';
import { BusinessCategory, OrgType, UserRole, ServiceLocationType } from '@prisma/client';

describe('Customer Address Selection & Booking Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appointmentsService: AppointmentsService;
  let availabilityService: AvailabilityService;
  let customerAddressesService: CustomerAddressesService;

  let orgId: string;
  let branchId: string;
  let staffId: string;
  let staffUserId: string;

  let customerAId: string;
  let customerBId: string;

  let workshopServiceId: string;
  let mobileServiceId: string;
  let flexibleServiceId: string;

  const testBookingDate = '2026-12-01'; // Tuesday (dayOfWeek = 2 in the future)

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        AppointmentsService,
        AvailabilityService,
        CustomerAddressesService,
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

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    appointmentsService = moduleFixture.get<AppointmentsService>(AppointmentsService);
    availabilityService = moduleFixture.get<AvailabilityService>(AvailabilityService);
    customerAddressesService = moduleFixture.get<CustomerAddressesService>(CustomerAddressesService);

    // 1. Create Organization & Branch
    const suffix = Date.now().toString().slice(-6);
    const org = await prisma.organization.create({
      data: {
        name: `Address Test Auto Org ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.SERVICES,
        isPubliclyVisible: true,
      },
    });
    orgId = org.id;

    const branch = await prisma.retailBranch.create({
      data: {
        name: `Jesmond Central Service Hub ${suffix}`,
        organizationId: orgId,
        address: '100 Blue Gum Road, Jesmond NSW 2299',
        phone: '0249001122',
        isActive: true,
        operatingHours: [
          { dayOfWeek: 2, isOpen: true, openTime: '08:00', closeTime: '18:00' },
        ],
      },
    });
    branchId = branch.id;

    // 2. Create Staff member with Tuesday shift
    const staffUser = await prisma.user.create({
      data: {
        email: `tech_staff_${suffix}@jesmond.test`,
        firstName: 'Tech',
        lastName: `Staff ${suffix}`,
        role: UserRole.ORG_STAFF,
        password: 'hash',
        orgStaffRoles: {
          create: {
            organizationId: orgId,
            role: UserRole.ORG_STAFF,
            retailBranchId: branchId,
          },
        },
      },
      include: { orgStaffRoles: true },
    });
    staffUserId = staffUser.id;
    staffId = staffUser.orgStaffRoles[0].id;

    // 3. Configure Staff working hours for Tuesday (dayOfWeek = 2)
    await prisma.staffWorkingHours.create({
      data: {
        staffId,
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '18:00',
      },
    });

    // 4. Create Customers A and B
    const userA = await prisma.user.create({
      data: {
        email: `cust_a_${suffix}@jesmond.test`,
        firstName: 'Alice',
        lastName: 'Customer',
        role: UserRole.RESIDENT,
        password: 'hash',
      },
    });
    customerAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `cust_b_${suffix}@jesmond.test`,
        firstName: 'Bob',
        lastName: 'Customer',
        role: UserRole.RESIDENT,
        password: 'hash',
      },
    });
    customerBId = userB.id;

    // 5. Create Services: AT_BRANCH, CUSTOMER_LOCATION, and FLEXIBLE
    const s1 = await prisma.businessService.create({
      data: {
        organizationId: orgId,
        branchId,
        name: `Workshop Logbook Service ${suffix}`,
        price: 22000,
        durationMins: 60,
        isActive: true,
        locationType: ServiceLocationType.AT_BRANCH,
      },
    });
    workshopServiceId = s1.id;

    const s2 = await prisma.businessService.create({
      data: {
        organizationId: orgId,
        branchId,
        name: `Mobile Callout Battery Replacement ${suffix}`,
        price: 18000,
        durationMins: 60,
        isActive: true,
        locationType: ServiceLocationType.CUSTOMER_LOCATION,
      },
    });
    mobileServiceId = s2.id;

    const s3 = await prisma.businessService.create({
      data: {
        organizationId: orgId,
        branchId,
        name: `Comprehensive Vehicle Diagnostic ${suffix}`,
        price: 15000,
        durationMins: 60,
        isActive: true,
        locationType: ServiceLocationType.FLEXIBLE,
      },
    });
    flexibleServiceId = s3.id;

    // Assign qualifications for staff member to all 3 services
    await prisma.staffServiceAssignment.createMany({
      data: [
        { staffId, serviceId: workshopServiceId },
        { staffId, serviceId: mobileServiceId },
        { staffId, serviceId: flexibleServiceId },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup in correct foreign key constraint order
    if (orgId) {
      await prisma.appointmentStatusHistory.deleteMany({
        where: { appointment: { organizationId: orgId } },
      });
      await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
      await prisma.staffWorkingHours.deleteMany({
        where: { staffId },
      });
      await prisma.staffServiceAssignment.deleteMany({
        where: { staffId },
      });
      await prisma.businessService.deleteMany({ where: { organizationId: orgId } });
      await prisma.retailBranch.deleteMany({ where: { organizationId: orgId } });
      await prisma.orgStaff.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    const userIds = [staffUserId, customerAId, customerBId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.customerAddress.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await app.close();
  });

  // =========================================================================
  // SCENARIO 1 & 2: Customer can create and list saved addresses
  // =========================================================================
  let customerAHomeAddressId: string;
  let customerAWorkAddressId: string;
  let customerBAddressId: string;

  it('Scenario 1 & 2: Customer A can create new addresses and list them', async () => {
    // Create Address 1 (Home)
    const home = await customerAddressesService.createAddress(customerAId, {
      label: 'Home',
      recipientName: 'Alice Customer',
      phone: '0412 111 222',
      streetAddress: '15 Janet Street',
      unitNumber: 'Unit 3',
      suburb: 'Jesmond',
      city: 'Newcastle',
      state: 'NSW',
      postcode: '2299',
      country: 'Australia',
      instructions: 'Gate code 1234',
      isDefault: true,
    });
    expect(home.id).toBeDefined();
    expect(home.userId).toBe(customerAId);
    expect(home.isDefault).toBe(true);
    customerAHomeAddressId = home.id;

    // Create Address 2 (Work)
    const work = await customerAddressesService.createAddress(customerAId, {
      label: 'Work',
      recipientName: 'Alice at Newcastle Uni',
      phone: '0412 111 222',
      streetAddress: 'University Drive',
      suburb: 'Callaghan',
      city: 'Newcastle',
      state: 'NSW',
      postcode: '2308',
      country: 'Australia',
      isDefault: false,
    });
    expect(work.id).toBeDefined();
    customerAWorkAddressId = work.id;

    // List customer addresses
    const list = await customerAddressesService.getCustomerAddresses(customerAId);
    expect(list.length).toBe(2);
    expect(list.some((a) => a.id === home.id)).toBe(true);
    expect(list.some((a) => a.id === work.id)).toBe(true);
  });

  // =========================================================================
  // SCENARIO 3: Booking mobile service using saved address
  // =========================================================================
  it('Scenario 3: Mobile CUSTOMER_LOCATION service successfully books with valid customerAddressId', async () => {
    const startTime = new Date(`${testBookingDate}T09:00:00Z`);
    const endTime = new Date(`${testBookingDate}T10:00:00Z`);

    const appt = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: mobileServiceId,
      startTime,
      endTime,
      timezone: 'Australia/Sydney',
      customerAddressId: customerAHomeAddressId,
    });

    expect(appt.id).toBeDefined();
    expect(appt.locationType).toBe(ServiceLocationType.CUSTOMER_LOCATION);
    expect(appt.customerAddressId).toBe(customerAHomeAddressId);

    // Verify snapshot was created correctly
    expect(appt.addressSnapshot).toBeDefined();
    const snap = appt.addressSnapshot as any;
    expect(snap.streetAddress).toBe('15 Janet Street');
    expect(snap.unitNumber).toBe('Unit 3');
    expect(snap.city).toBe('Newcastle');
    expect(snap.state).toBe('NSW');
    expect(snap.postcode).toBe('2299');
    expect(snap.instructions).toBe('Gate code 1234');
  });

  // =========================================================================
  // SCENARIO 4: Customer can choose a different address for subsequent booking
  // =========================================================================
  it('Scenario 4: Customer can select a different saved address for another booking', async () => {
    const startTime = new Date(`${testBookingDate}T10:00:00Z`);
    const endTime = new Date(`${testBookingDate}T11:00:00Z`);

    const appt = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: mobileServiceId,
      startTime,
      endTime,
      timezone: 'Australia/Sydney',
      customerAddressId: customerAWorkAddressId,
    });

    expect(appt.id).toBeDefined();
    expect(appt.customerAddressId).toBe(customerAWorkAddressId);
    const snap = appt.addressSnapshot as any;
    expect(snap.streetAddress).toBe('University Drive');
    expect(snap.postcode).toBe('2308');
  });

  // =========================================================================
  // SCENARIO 5: Cross-tenant isolation
  // =========================================================================
  it('Scenario 5: Cross-tenant isolation - Customer A cannot book using Customer B address', async () => {
    // Create an address for Customer B
    const bAddr = await customerAddressesService.createAddress(customerBId, {
      label: 'Home',
      recipientName: 'Bob Customer',
      phone: '0499 888 777',
      streetAddress: '99 Heaton Street',
      city: 'Jesmond',
      state: 'NSW',
      postcode: '2299',
    });
    customerBAddressId = bAddr.id;

    // Customer A attempts to book using Customer B's address
    const startTime = new Date(`${testBookingDate}T11:00:00Z`);
    const endTime = new Date(`${testBookingDate}T12:00:00Z`);

    await expect(
      appointmentsService.createPendingAppointment({
        customerId: customerAId,
        branchId,
        serviceId: mobileServiceId,
        startTime,
        endTime,
        timezone: 'Australia/Sydney',
        customerAddressId: customerBAddressId, // Belongs to customer B!
      }),
    ).rejects.toThrow(ForbiddenException);

    // Also verify Customer A cannot fetch Customer B's address directly
    await expect(
      customerAddressesService.getAddressById(customerAId, customerBAddressId),
    ).rejects.toThrow(ForbiddenException);
  });

  // =========================================================================
  // SCENARIO 6: CUSTOMER_LOCATION service rejects booking without address
  // =========================================================================
  it('Scenario 6: Mobile CUSTOMER_LOCATION service rejects booking without customer address', async () => {
    const startTime = new Date(`${testBookingDate}T12:00:00Z`);
    const endTime = new Date(`${testBookingDate}T13:00:00Z`);

    await expect(
      appointmentsService.createPendingAppointment({
        customerId: customerAId,
        branchId,
        serviceId: mobileServiceId,
        startTime,
        endTime,
        timezone: 'Australia/Sydney',
        // customerAddressId is omitted
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // SCENARIO 7: Workshop AT_BRANCH service books without customer address & snapshots branch
  // =========================================================================
  it('Scenario 7: Workshop AT_BRANCH service books without customer address and snapshots branch address', async () => {
    const startTime = new Date(`${testBookingDate}T13:00:00Z`);
    const endTime = new Date(`${testBookingDate}T14:00:00Z`);

    const appt = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: workshopServiceId,
      startTime,
      endTime,
      timezone: 'Australia/Sydney',
    });

    expect(appt.id).toBeDefined();
    expect(appt.locationType).toBe(ServiceLocationType.AT_BRANCH);
    expect(appt.customerAddressId).toBeNull();

    // Verify snapshot captured workshop/branch address
    expect(appt.addressSnapshot).toBeDefined();
    const snap = appt.addressSnapshot as any;
    expect(snap.type).toBe('BRANCH');
    expect(snap.branchName).toContain('Jesmond Central Service Hub');
    expect(snap.address).toBe('100 Blue Gum Road, Jesmond NSW 2299');
    expect(snap.phone).toBe('0249001122');
  });

  // =========================================================================
  // SCENARIO 8: FLEXIBLE service allows customer to choose branch or customer location
  // =========================================================================
  it('Scenario 8: FLEXIBLE service supports both AT_BRANCH and CUSTOMER_LOCATION choices', async () => {
    // 8a. Book as AT_BRANCH
    const startTime1 = new Date(`${testBookingDate}T14:00:00Z`);
    const endTime1 = new Date(`${testBookingDate}T15:00:00Z`);

    const apptBranch = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: flexibleServiceId,
      locationType: ServiceLocationType.AT_BRANCH,
      startTime: startTime1,
      endTime: endTime1,
      timezone: 'Australia/Sydney',
    });

    expect(apptBranch.locationType).toBe(ServiceLocationType.AT_BRANCH);
    expect(apptBranch.customerAddressId).toBeNull();
    expect((apptBranch.addressSnapshot as any).type).toBe('BRANCH');

    // 8b. Book as CUSTOMER_LOCATION
    const startTime2 = new Date(`${testBookingDate}T15:00:00Z`);
    const endTime2 = new Date(`${testBookingDate}T16:00:00Z`);

    const apptCustomer = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: flexibleServiceId,
      locationType: ServiceLocationType.CUSTOMER_LOCATION,
      customerAddressId: customerAHomeAddressId,
      startTime: startTime2,
      endTime: endTime2,
      timezone: 'Australia/Sydney',
    });

    expect(apptCustomer.locationType).toBe(ServiceLocationType.CUSTOMER_LOCATION);
    expect(apptCustomer.customerAddressId).toBe(customerAHomeAddressId);
    expect((apptCustomer.addressSnapshot as any).streetAddress).toBe('15 Janet Street');
  });

  // =========================================================================
  // SCENARIO 9: Immutable Address Snapshot preservation
  // =========================================================================
  it('Scenario 9: Appointment retains immutable address snapshot even if original address is modified or deleted', async () => {
    // Create a temporary address
    const tempAddr = await customerAddressesService.createAddress(customerAId, {
      label: 'Temporary Flat',
      recipientName: 'Alice Temp',
      streetAddress: '77 Old Pioneer Street',
      city: 'Jesmond',
      state: 'NSW',
      postcode: '2299',
    });

    const startTime = new Date(`${testBookingDate}T16:00:00Z`);
    const endTime = new Date(`${testBookingDate}T17:00:00Z`);

    const appt = await appointmentsService.createPendingAppointment({
      customerId: customerAId,
      branchId,
      serviceId: mobileServiceId,
      customerAddressId: tempAddr.id,
      startTime,
      endTime,
      timezone: 'Australia/Sydney',
    });

    expect((appt.addressSnapshot as any).streetAddress).toBe('77 Old Pioneer Street');

    // Now update the address record
    await customerAddressesService.updateAddress(customerAId, tempAddr.id, {
      streetAddress: '88 Completely Changed Boulevard',
    });

    // Also soft-delete the address
    await customerAddressesService.deleteAddress(customerAId, tempAddr.id);

    // Verify appointment snapshot remains intact with original address
    const refetchedAppt = await appointmentsService.getAppointment(appt.id);
    expect(refetchedAppt).toBeDefined();
    expect((refetchedAppt?.addressSnapshot as any).streetAddress).toBe('77 Old Pioneer Street');
  });

  // =========================================================================
  // SCENARIO 10: Availability engine and concurrency serialization
  // =========================================================================
  it('Scenario 10: Unified availability engine validates slots and rejects conflicting bookings', async () => {
    // 09:00 - 10:00 is already booked on testBookingDate
    const conflictingStart = new Date(`${testBookingDate}T09:00:00Z`);
    const conflictingEnd = new Date(`${testBookingDate}T10:00:00Z`);

    await expect(
      appointmentsService.createPendingAppointment({
        customerId: customerBId,
        branchId,
        serviceId: mobileServiceId,
        customerAddressId: customerBAddressId,
        startTime: conflictingStart,
        endTime: conflictingEnd,
        timezone: 'Australia/Sydney',
      }),
    ).rejects.toThrow(BadRequestException);

    // Check availability slot list for this date
    const avail = await availabilityService.getAvailability(
      mobileServiceId,
      testBookingDate,
      'Australia/Sydney',
    );
    expect(avail.date).toBe(testBookingDate);
    expect(avail.slots).toBeDefined();

    // The slot at 09:00 should NOT be in availableSlots
    const is0900Available = avail.availableSlots.some(
      (s: any) => s.startTime === '09:00',
    );
    expect(is0900Available).toBe(false);
  });
});
