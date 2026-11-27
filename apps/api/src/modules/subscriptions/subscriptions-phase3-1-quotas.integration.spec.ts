import { ForbiddenException } from '@nestjs/common';
import {
  BusinessCategory,
  BusinessVerificationStatus,
  OrgType,
  PrismaClient,
  PropertyOfferingType,
  PropertyType,
  FurnishingType,
  SubscriptionProfileType,
} from '@prisma/client';
import { FeatureFlagService } from '../admin/feature-flag.service';
import { AppointmentsService } from '../appointments/services/appointments.service';
import { AgencyService } from '../organizations/services/agency.service';
import { PropertiesService } from '../properties/core/properties.service';
import { BranchesService } from '../retail/branches/branches.service';
import { CatalogService } from '../retail/catalog/catalog.service';
import { EmployeesService } from '../retail/employees/employees.service';
import { TerminalsService } from '../retail/terminals/terminals.service';
import { EnterpriseOverrideService } from './services/enterprise-override.service';
import { EntitlementResolverService } from './services/entitlement-resolver.service';
import { EntitlementSnapshotService } from './services/entitlement-snapshot.service';
import { ProfileTypeResolverService } from './services/profile-type-resolver.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionStatusService } from './services/subscription-status.service';
import { UsageCounterService } from './services/usage-counter.service';

describe('Subscriptions Phase 3.1 — Feature-by-Feature Transactional Quota Tests', () => {
  let prisma: PrismaClient;
  let usageService: UsageCounterService;
  let provisioning: SubscriptionProvisioningService;
  let overrideService: EnterpriseOverrideService;

  let branchesService: BranchesService;
  let catalogService: CatalogService;
  let terminalsService: TerminalsService;
  let employeesService: EmployeesService;
  let propertiesService: PropertiesService;
  let agencyService: AgencyService;
  let appointmentsService: AppointmentsService;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const profileResolver = new ProfileTypeResolverService();
    const statusService = new SubscriptionStatusService();
    const snapshotService = new EntitlementSnapshotService(prisma as any);
    const entitlementResolver = new EntitlementResolverService(
      prisma as any,
      profileResolver,
      statusService,
      snapshotService,
    );
    const featureFlagService = new FeatureFlagService(prisma as any);
    usageService = new UsageCounterService(
      prisma as any,
      featureFlagService,
      entitlementResolver,
    );
    provisioning = new SubscriptionProvisioningService(
      prisma as any,
      profileResolver,
    );
    overrideService = new EnterpriseOverrideService(
      prisma as any,
      snapshotService,
    );

    const noopRedis: any = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    const noopAuth: any = { forgotPassword: jest.fn().mockResolvedValue(undefined) };
    const noopStorage: any = {};
    const noopNotifications: any = {};

    branchesService = new BranchesService(prisma as any, noopRedis, usageService);
    catalogService = new CatalogService(prisma as any, usageService);
    terminalsService = new TerminalsService(prisma as any, usageService);
    employeesService = new EmployeesService(
      prisma as any,
      noopAuth,
      usageService,
    );
    propertiesService = new PropertiesService(
      prisma as any,
      noopStorage,
      noopNotifications,
      noopNotifications,
      usageService,
    );
    agencyService = new AgencyService(prisma as any, usageService);
    appointmentsService = new AppointmentsService(
      prisma as any,
      noopNotifications,
      noopNotifications,
      noopNotifications,
      noopNotifications,
      usageService,
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (createdOrgIds.length > 0) {
      await prisma.posTerminal.deleteMany({
        where: { branch: { organizationId: { in: createdOrgIds } } },
      });
      await prisma.businessService.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prisma.product.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prisma.orgStaff.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prisma.retailBranch.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prisma.media.deleteMany({
        where: { property: { organizationId: { in: createdOrgIds } } },
      });
      await prisma.room.deleteMany({
        where: { roomType: { property: { organizationId: { in: createdOrgIds } } } },
      });
      await prisma.roomType.deleteMany({
        where: { property: { organizationId: { in: createdOrgIds } } },
      });
      await prisma.propertyVersion.deleteMany({
        where: { property: { organizationId: { in: createdOrgIds } } },
      });
      await prisma.property.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  const createVerifiedOrg = async (
    name: string,
    type: OrgType,
    category: BusinessCategory,
  ) => {
    const org = await prisma.organization.create({
      data: {
        name,
        type,
        businessCategory: category,
        profileCompletion: {
          create: {
            overallStatus: BusinessVerificationStatus.VERIFIED,
            isCompleted: true,
          },
        },
      },
    });
    createdOrgIds.push(org.id);
    const prov = await provisioning.provisionFreePlanForOrganization(org.id);
    return { org, subscriptionId: prov.subscriptionId! };
  };

  const getCounter = async (organizationId: string, featureKey: string) => {
    const row = await prisma.subscriptionUsageCounter.findUnique({
      where: {
        organizationId_featureKey: { organizationId, featureKey },
      },
    });
    return row?.currentCount ?? 0;
  };

  it('enforces RETAIL_BRANCHES, RETAIL_PRODUCTS, RETAIL_POS_TERMINALS, and RETAIL_EMPLOYEES end-to-end', async () => {
    jest.spyOn(usageService, 'isEnforcementActive').mockResolvedValue(true);

    const { org, subscriptionId } = await createVerifiedOrg(
      'Retail Quota E2E Org',
      OrgType.RETAIL,
      BusinessCategory.RETAIL,
    );

    // 1. RETAIL_BRANCHES (Free limit = 1): concurrent creates allow only 1
    const branchRaces = await Promise.allSettled([
      branchesService.createBranch(org.id, { name: 'Branch A', address: '1 A St' }),
      branchesService.createBranch(org.id, { name: 'Branch B', address: '2 B St' }),
    ]);
    expect(branchRaces.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(branchRaces.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await getCounter(org.id, 'RETAIL_BRANCHES')).toBe(1);

    const createdBranch = (branchRaces.find((r) => r.status === 'fulfilled') as any)
      .value;

    // Deactivate once -> 0; repeated deactivate -> stays 0
    await branchesService.deleteBranch(org.id, createdBranch.id);
    expect(await getCounter(org.id, 'RETAIL_BRANCHES')).toBe(0);
    await branchesService.deleteBranch(org.id, createdBranch.id);
    expect(await getCounter(org.id, 'RETAIL_BRANCHES')).toBe(0);

    // Recreate branch for terminal test
    const activeBranch = await branchesService.createBranch(org.id, {
      name: 'Branch C',
      address: '3 C St',
    });

    // 2. RETAIL_POS_TERMINALS (Free limit = 1)
    await terminalsService.createTerminal(org.id, 'usr-1', {
      branchId: activeBranch.id,
      name: 'POS-1',
    });
    expect(await getCounter(org.id, 'RETAIL_POS_TERMINALS')).toBe(1);
    await expect(
      terminalsService.createTerminal(org.id, 'usr-1', {
        branchId: activeBranch.id,
        name: 'POS-2',
      }),
    ).rejects.toThrow(ForbiddenException);

    // 3. RETAIL_PRODUCTS: create, archive, restore, edit over-limit, failed create
    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'RETAIL_PRODUCTS',
      enabled: true,
      limitValue: 1,
      reason: 'Test limit 1',
      actorId: 'admin-1',
    });

    const prod1 = await catalogService.createProduct(org.id, 'usr-1', {
      sku: `SKU-1-${Date.now()}`,
      name: 'Product 1',
      sellingPrice: 10,
      imageUrl: 'https://example.com/1.png',
    });
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(1);

    // Editing existing over/at-limit product succeeds
    const edited = await catalogService.updateProduct(org.id, 'usr-1', prod1.id, {
      name: 'Product 1 Edited',
    });
    expect(edited.name).toBe('Product 1 Edited');
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(1);

    // Second create blocked
    await expect(
      catalogService.createProduct(org.id, 'usr-1', {
        sku: `SKU-2-${Date.now()}`,
        name: 'Product 2',
        sellingPrice: 20,
        imageUrl: 'https://example.com/2.png',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(1);

    // Archive decrements; repeated archive stays 0; restore increments back to 1
    await catalogService.updateProduct(org.id, 'usr-1', prod1.id, {
      isActive: false,
    });
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(0);
    await catalogService.updateProduct(org.id, 'usr-1', prod1.id, {
      isActive: false,
    });
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(0);
    await catalogService.updateProduct(org.id, 'usr-1', prod1.id, {
      isActive: true,
    });
    expect(await getCounter(org.id, 'RETAIL_PRODUCTS')).toBe(1);

    // 4. RETAIL_EMPLOYEES: create, deactivate once, repeated deactivate
    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'RETAIL_EMPLOYEES',
      enabled: true,
      limitValue: 1,
      reason: 'Test emp limit 1',
      actorId: 'admin-1',
    });

    const emp = await employeesService.createEmployee(org.id, 'req-1', {
      email: `emp-${Date.now()}@example.com`,
      firstName: 'Emp',
      lastName: 'One',
    });
    createdUserIds.push(emp.id);
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(1);

    await expect(
      employeesService.createEmployee(org.id, 'req-1', {
        email: `emp2-${Date.now()}@example.com`,
        firstName: 'Emp',
        lastName: 'Two',
      }),
    ).rejects.toThrow(ForbiddenException);

    await employeesService.deactivateEmployee(org.id, emp.orgStaff.id);
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(0);
    await employeesService.deactivateEmployee(org.id, emp.orgStaff.id);
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(0);

    // updateEmployee restoring from DEACTIVATED -> ACTIVE increments once (and respects quota)
    await employeesService.updateEmployee(org.id, 'req-1', emp.orgStaff.id, {
      accountStatus: 'ACTIVE',
    });
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(1);

    // updateEmployee transitioning ACTIVE -> DEACTIVATED decrements once; subsequent deactivateEmployee does NOT double-decrement
    await employeesService.updateEmployee(org.id, 'req-1', emp.orgStaff.id, {
      accountStatus: 'DEACTIVATED',
    });
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(0);
    await employeesService.deactivateEmployee(org.id, emp.orgStaff.id);
    expect(await getCounter(org.id, 'RETAIL_EMPLOYEES')).toBe(0);

    const reconciled = await usageService.reconcileOrganizationCounters(org.id);
    expect(reconciled.RETAIL_BRANCHES).toBe(1);
    expect(reconciled.RETAIL_POS_TERMINALS).toBe(1);
    expect(reconciled.RETAIL_PRODUCTS).toBe(1);
    expect(reconciled.RETAIL_EMPLOYEES).toBe(0);
  });

  it('enforces ACCOMMODATION_LISTINGS, ACCOMMODATION_ROOMS, and AGENCY_TEAM_MEMBERS without double-counting draft submit', async () => {
    jest.spyOn(usageService, 'isEnforcementActive').mockResolvedValue(true);

    const { org, subscriptionId } = await createVerifiedOrg(
      'Accommodation Quota E2E Org',
      OrgType.PROVIDER,
      BusinessCategory.RETAIL,
    );

    const suburb = await prisma.suburb.findFirst();
    if (!suburb) return;

    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'ACCOMMODATION_LISTINGS',
      enabled: true,
      limitValue: 1,
      reason: 'Test listing limit 1',
      actorId: 'admin-1',
    });
    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'ACCOMMODATION_ROOMS',
      enabled: true,
      limitValue: 1,
      reason: 'Test room limit 1',
      actorId: 'admin-1',
    });

    const userCtx = { id: 'prov-1', organizationId: org.id, orgRole: 'ADMIN' };
    const prop = await propertiesService.createProperty(
      {
        name: 'Test House',
        address: '10 Test Rd',
        postcode: '2299',
        lat: -32.9,
        lng: 151.69,
        description: 'Test house description',
        suburbId: suburb.id,
        propertyType: Object.values(PropertyType)[0],
        offeringType: Object.values(PropertyOfferingType)[0],
        furnishingType: Object.values(FurnishingType)[0],
        availableFrom: new Date().toISOString(),
        minimumStay: 4,
      } as any,
      userCtx,
    );
    expect(await getCounter(org.id, 'ACCOMMODATION_LISTINGS')).toBe(1);

    // Second property creation blocked
    await expect(
      propertiesService.createProperty(
        {
          name: 'Test House 2',
          address: '11 Test Rd',
          postcode: '2299',
          suburbId: suburb.id,
          propertyType: PropertyType.HOUSE,
          offeringType: PropertyOfferingType.SHARED_HOUSE,
          furnishingType: FurnishingType.FURNISHED,
        } as any,
        userCtx,
      ),
    ).rejects.toThrow(ForbiddenException);

    // Preparing draft for submission does not double-count
    const rt = await prisma.roomType.create({
      data: {
        propertyId: prop.id,
        name: 'Single Room',
        pricePerWeek: 250,
        inventory: 1,
      },
    });
    await prisma.media.create({
      data: {
        propertyId: prop.id,
        url: 'https://example.com/p.jpg',
        type: 'IMAGE',
        displayOrder: 0,
      },
    });

    // ACCOMMODATION_ROOMS (add/delete while DRAFT before submit)
    const room = await propertiesService.addRoom(prop.id, userCtx, rt.id, {
      identifier: 'R101',
    });
    expect(await getCounter(org.id, 'ACCOMMODATION_ROOMS')).toBe(1);
    await expect(
      propertiesService.addRoom(prop.id, userCtx, rt.id, {
        identifier: 'R102',
      }),
    ).rejects.toThrow(ForbiddenException);
    await propertiesService.deleteRoom(prop.id, userCtx, rt.id, room.id);
    expect(await getCounter(org.id, 'ACCOMMODATION_ROOMS')).toBe(0);

    await propertiesService.submitProperty(prop.id, userCtx, 'prov-1');
    expect(await getCounter(org.id, 'ACCOMMODATION_LISTINGS')).toBe(1);

    // AGENCY_TEAM_MEMBERS
    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'AGENCY_TEAM_MEMBERS',
      enabled: true,
      limitValue: 1,
      reason: 'Test agency member limit 1',
      actorId: 'admin-1',
    });

    const invited = await agencyService.inviteTeamMember(userCtx, {
      email: `agent-${Date.now()}@example.com`,
      firstName: 'Agent',
      lastName: 'Smith',
    });
    createdUserIds.push(invited.user.id);
    expect(await getCounter(org.id, 'AGENCY_TEAM_MEMBERS')).toBe(1);

    await expect(
      agencyService.inviteTeamMember(userCtx, {
        email: `agent2-${Date.now()}@example.com`,
        firstName: 'Agent',
        lastName: 'Two',
      }),
    ).rejects.toThrow(ForbiddenException);

    await agencyService.removeTeamMember(userCtx, invited.orgStaff.id);
    expect(await getCounter(org.id, 'AGENCY_TEAM_MEMBERS')).toBe(0);
  });

  it('enforces APPOINTMENT_SERVICES and APPOINTMENT_STAFF including soft-delete and restore', async () => {
    jest.spyOn(usageService, 'isEnforcementActive').mockResolvedValue(true);

    const { org, subscriptionId } = await createVerifiedOrg(
      'Mechanics Quota E2E Org',
      OrgType.RETAIL,
      BusinessCategory.MECHANICS,
    );

    await branchesService.createBranch(org.id, {
      name: 'Workshop Main',
      address: '50 Garage St',
    });

    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'APPOINTMENT_SERVICES',
      enabled: true,
      limitValue: 1,
      reason: 'Test service limit 1',
      actorId: 'admin-1',
    });
    await overrideService.upsertOverride({
      organizationId: org.id,
      subscriptionId,
      featureKey: 'APPOINTMENT_STAFF',
      enabled: true,
      limitValue: 1,
      reason: 'Test staff limit 1',
      actorId: 'admin-1',
    });

    const svc = await appointmentsService.createBusinessService(org.id, {
      name: 'Logbook Service',
      durationMins: 60,
      price: 199,
    });
    expect(await getCounter(org.id, 'APPOINTMENT_SERVICES')).toBe(1);

    await expect(
      appointmentsService.createBusinessService(org.id, {
        name: 'Brake Check',
        durationMins: 30,
        price: 99,
      }),
    ).rejects.toThrow(ForbiddenException);

    await appointmentsService.deleteBusinessService(org.id, svc.id);
    expect(await getCounter(org.id, 'APPOINTMENT_SERVICES')).toBe(0);
    // Repeated deletion must not decrement twice
    await appointmentsService.deleteBusinessService(org.id, svc.id);
    expect(await getCounter(org.id, 'APPOINTMENT_SERVICES')).toBe(0);

    const staffEmail = `mech-${Date.now()}@example.com`;
    const staff = await appointmentsService.addBusinessStaff(org.id, {
      email: staffEmail,
      firstName: 'Sam',
      lastName: 'Mechanic',
    });
    createdUserIds.push(staff.user.id);
    expect(await getCounter(org.id, 'APPOINTMENT_STAFF')).toBe(1);

    await expect(
      appointmentsService.addBusinessStaff(org.id, {
        email: `mech2-${Date.now()}@example.com`,
        firstName: 'Alex',
        lastName: 'Mechanic',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Soft-delete staff & restore increments properly
    await prisma.$transaction(async (tx) => {
      await tx.orgStaff.update({
        where: { id: staff.id },
        data: { deletedAt: new Date() },
      });
      await usageService.decrementCounterInTransaction(
        tx,
        org.id,
        'APPOINTMENT_STAFF',
        1,
      );
    });
    expect(await getCounter(org.id, 'APPOINTMENT_STAFF')).toBe(0);

    await appointmentsService.addBusinessStaff(org.id, {
      email: staffEmail,
      firstName: 'Sam',
      lastName: 'Mechanic',
    });
    expect(await getCounter(org.id, 'APPOINTMENT_STAFF')).toBe(1);

    const reconciled = await usageService.reconcileOrganizationCounters(org.id);
    expect(reconciled.APPOINTMENT_SERVICES).toBe(0);
    expect(reconciled.APPOINTMENT_STAFF).toBe(1);
  });
});
