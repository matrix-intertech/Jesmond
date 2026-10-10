import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AppointmentsModule } from '../src/modules/appointments/appointments.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AppointmentsService } from '../src/modules/appointments/services/appointments.service';
import { BusinessCategory, OrgType, UserRole } from '@prisma/client';

describe('Service Categories & Appointments (Phase 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appointmentsService: AppointmentsService;

  let orgAId: string;
  let orgBId: string;
  let branchAId: string;
  let branchBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AppointmentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    appointmentsService = app.get<AppointmentsService>(AppointmentsService);

    const suffix = Date.now().toString();

    // Create Org A (SERVICES business)
    const orgA = await prisma.organization.create({
      data: {
        name: `Org A Services ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.SERVICES,
      },
    });
    orgAId = orgA.id;

    const branchA = await prisma.retailBranch.create({
      data: {
        name: `Branch A ${suffix}`,
        organizationId: orgAId,
      },
    });
    branchAId = branchA.id;

    // Create Org B (MECHANICS business)
    const orgB = await prisma.organization.create({
      data: {
        name: `Org B Mechanics ${suffix}`,
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
      },
    });
    orgBId = orgB.id;

    const branchB = await prisma.retailBranch.create({
      data: {
        name: `Branch B ${suffix}`,
        organizationId: orgBId,
      },
    });
    branchBId = branchB.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.businessService.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.retailBranch.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await app.close();
  });

  describe('Category Creation & Duplicate Prevention', () => {
    it('should create a persistent service category with description and active status', async () => {
      const category = await appointmentsService.createServiceCategory(orgAId, {
        name: 'Electrical',
        description: 'Electrical wiring and repairs',
        isActive: true,
      });

      expect(category).toBeDefined();
      expect(category.id).toBeDefined();
      expect(category.name).toBe('Electrical');
      expect(category.description).toBe('Electrical wiring and repairs');
      expect(category.isActive).toBe(true);
      expect(category.organizationId).toBe(orgAId);
    });

    it('should reject creating a duplicate category name in the same organization (case-insensitive)', async () => {
      await expect(
        appointmentsService.createServiceCategory(orgAId, {
          name: 'electrical', // same name, different casing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow another organization to create a category with the same name', async () => {
      const categoryOrgB = await appointmentsService.createServiceCategory(orgBId, {
        name: 'Electrical',
        description: 'Auto Electrical',
        isActive: true,
      });

      expect(categoryOrgB).toBeDefined();
      expect(categoryOrgB.organizationId).toBe(orgBId);
      expect(categoryOrgB.name).toBe('Electrical');
    });
  });

  describe('Category Listing & Editing', () => {
    it('should list categories belonging exclusively to the authenticated organization', async () => {
      await appointmentsService.createServiceCategory(orgAId, {
        name: 'Plumbing',
        description: 'Plumbing maintenance',
      });

      const orgACategories = await appointmentsService.getServiceCategories(orgAId, true);
      const names = orgACategories.map((c) => c.name);

      expect(names).toContain('Electrical');
      expect(names).toContain('Plumbing');
      expect(orgACategories.every((c) => c.organizationId === orgAId)).toBe(true);
    });

    it('should update category name, description, and active status', async () => {
      const cats = await appointmentsService.getServiceCategories(orgAId, true);
      const plumbing = cats.find((c) => c.name === 'Plumbing')!;

      const updated = await appointmentsService.updateServiceCategory(orgAId, plumbing.id, {
        name: 'Plumbing & Gas',
        description: 'Licensed gas & plumbing',
        isActive: false,
      });

      expect(updated.name).toBe('Plumbing & Gas');
      expect(updated.description).toBe('Licensed gas & plumbing');
      expect(updated.isActive).toBe(false);

      // Verify inactive category is filtered out by default when includeInactive=false
      const activeCats = await appointmentsService.getServiceCategories(orgAId, false);
      expect(activeCats.some((c) => c.id === plumbing.id)).toBe(false);
    });
  });

  describe('Service Creation, Category Assignment, and Cross-Tenant Isolation', () => {
    let catElectricalA: any;
    let catElectricalB: any;
    let serviceA: any;

    beforeAll(async () => {
      const catsA = await appointmentsService.getServiceCategories(orgAId, true);
      catElectricalA = catsA.find((c) => c.name === 'Electrical')!;

      const catsB = await appointmentsService.getServiceCategories(orgBId, true);
      catElectricalB = catsB.find((c) => c.name === 'Electrical')!;
    });

    it('should create a service optionally assigned to a category', async () => {
      serviceA = await appointmentsService.createBusinessService(orgAId, {
        name: 'Rewiring Service',
        description: 'Complete home rewiring',
        durationMins: 120,
        price: 25000,
        branchId: branchAId,
        categoryId: catElectricalA.id,
      });

      expect(serviceA).toBeDefined();
      expect(serviceA.categoryId).toBe(catElectricalA.id);
      expect(serviceA.category.name).toBe('Electrical');
    });

    it('should reject assigning a category owned by another organization', async () => {
      await expect(
        appointmentsService.createBusinessService(orgAId, {
          name: 'Invalid Cross Tenant Service',
          durationMins: 30,
          price: 5000,
          branchId: branchAId,
          categoryId: catElectricalB.id, // belongs to orgB!
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unassigning or assigning a service belonging to another organization', async () => {
      await expect(
        appointmentsService.assignServiceCategory(orgBId, serviceA.id, catElectricalB.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow creating existing/unassigned services without a category', async () => {
      const unassignedSvc = await appointmentsService.createBusinessService(orgAId, {
        name: 'General Consultation',
        durationMins: 30,
        price: 6000,
        branchId: branchAId,
      });

      expect(unassignedSvc).toBeDefined();
      expect(unassignedSvc.categoryId).toBeNull();
    });

    it('should assign and unassign a category for a service without deleting the service', async () => {
      // Assign
      const updated = await appointmentsService.assignServiceCategory(orgAId, serviceA.id, null);
      expect(updated.categoryId).toBeNull();

      // Re-assign
      const reassigned = await appointmentsService.assignServiceCategory(
        orgAId,
        serviceA.id,
        catElectricalA.id,
      );
      expect(reassigned.categoryId).toBe(catElectricalA.id);
    });
  });

  describe('Safe Category Deletion & Cascade Rules', () => {
    it('should reject deleting a category when dependent services exist', async () => {
      const catsA = await appointmentsService.getServiceCategories(orgAId, true);
      const catElectricalA = catsA.find((c) => c.name === 'Electrical')!;

      await expect(
        appointmentsService.deleteServiceCategory(orgAId, catElectricalA.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow deleting a category once all dependent services are safely reassigned or removed', async () => {
      // Create a temporary category with 0 services
      const tempCat = await appointmentsService.createServiceCategory(orgAId, {
        name: 'Temporary Category',
      });

      const result = await appointmentsService.deleteServiceCategory(orgAId, tempCat.id);
      expect(result.success).toBe(true);

      // Verify category is no longer in active listing
      const cats = await appointmentsService.getServiceCategories(orgAId, false);
      expect(cats.some((c) => c.id === tempCat.id)).toBe(false);
    });

    it('should allow recreating a category with the same name after it was deleted', async () => {
      const recreated = await appointmentsService.createServiceCategory(orgAId, {
        name: 'Temporary Category',
        description: 'Recreated category with same name',
      });

      expect(recreated).toBeDefined();
      expect(recreated.name).toBe('Temporary Category');
      expect(recreated.description).toBe('Recreated category with same name');
      expect(recreated.isActive).toBe(true);
      expect(recreated.deletedAt).toBeNull();
    });
  });

  describe('Public Branch Services & Category Inclusion', () => {
    it('should return active services with category metadata in public branch lookup', async () => {
      const branchServices = await appointmentsService.getServicesForBranch(branchAId);
      expect(branchServices.length).toBeGreaterThan(0);

      const electricalSvc = branchServices.find((s) => s.name === 'Rewiring Service');
      expect(electricalSvc).toBeDefined();
      expect((electricalSvc as any).category).toBeDefined();
      expect((electricalSvc as any).category.name).toBe('Electrical');
    });
  });
});
