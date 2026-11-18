import * as dotenv from 'dotenv';
dotenv.config();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PaymentMethod, OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';

describe('Demo Businesses End-to-End Feature Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let retailUser: any;
  let retailOrg: any;
  let retailBranch: any;
  let retailTerminal: any;
  let retailStaff: any;
  let retailToken: string;
  let retailSession: any;

  let servicesUser: any;
  let servicesOrg: any;
  let servicesBranch: any;
  let servicesStaff: any;
  let servicesToken: string;
  let servicesSession: any;

  let mechanicsUser: any;
  let mechanicsOrg: any;
  let mechanicsBranch: any;
  let mechanicsStaff: any;
  let mechanicsToken: string;
  let mechanicsSession: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // 1. Retail Store Setup
    retailUser = await prisma.user.findUnique({
      where: { email: 'shikharshaurya.01@gmail.com' },
    });
    retailOrg = await prisma.organization.findFirst({
      where: { name: 'Jesmond Demo Retail Store' },
    });
    retailBranch = await prisma.retailBranch.findFirst({
      where: { organizationId: retailOrg.id },
    });
    retailTerminal = await prisma.posTerminal.findFirst({
      where: { branchId: retailBranch.id },
    });
    retailStaff = await prisma.orgStaff.findUnique({
      where: {
        userId_organizationId: {
          userId: retailUser.id,
          organizationId: retailOrg.id,
        },
      },
    });

    retailSession = await prisma.session.create({
      data: {
        userId: retailUser.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    retailToken = jwtService.sign({
      sub: retailUser.id,
      email: retailUser.email,
      role: retailUser.role,
      orgType: retailOrg.type,
      sessionId: retailSession.id,
    });

    // 2. Services Setup
    servicesUser = await prisma.user.findUnique({
      where: { email: 'demo.services@jesmond.com.au' },
    });
    servicesOrg = await prisma.organization.findFirst({
      where: { name: 'Jesmond Demo Services' },
    });
    servicesBranch = await prisma.retailBranch.findFirst({
      where: { organizationId: servicesOrg.id },
    });
    servicesStaff = await prisma.orgStaff.findUnique({
      where: {
        userId_organizationId: {
          userId: servicesUser.id,
          organizationId: servicesOrg.id,
        },
      },
    });

    servicesSession = await prisma.session.create({
      data: {
        userId: servicesUser.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    servicesToken = jwtService.sign({
      sub: servicesUser.id,
      email: servicesUser.email,
      role: servicesUser.role,
      orgType: servicesOrg.type,
      sessionId: servicesSession.id,
    });

    // 3. Mechanics Setup
    mechanicsUser = await prisma.user.findUnique({
      where: { email: 'demo.mechanics@jesmond.com.au' },
    });
    mechanicsOrg = await prisma.organization.findFirst({
      where: { name: 'Jesmond Demo Mechanics' },
    });
    mechanicsBranch = await prisma.retailBranch.findFirst({
      where: { organizationId: mechanicsOrg.id },
    });
    mechanicsStaff = await prisma.orgStaff.findUnique({
      where: {
        userId_organizationId: {
          userId: mechanicsUser.id,
          organizationId: mechanicsOrg.id,
        },
      },
    });

    mechanicsSession = await prisma.session.create({
      data: {
        userId: mechanicsUser.id,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    mechanicsToken = jwtService.sign({
      sub: mechanicsUser.id,
      email: mechanicsUser.email,
      role: mechanicsUser.role,
      orgType: mechanicsOrg.type,
      sessionId: mechanicsSession.id,
    });
  });

  afterAll(async () => {
    // Reset public visibility to true if modified during tests
    if (servicesOrg) {
      await prisma.organization.update({
        where: { id: servicesOrg.id },
        data: { isPubliclyVisible: true },
      });
    }
    // Clean up test sessions
    await prisma.session.deleteMany({
      where: {
        id: {
          in: [retailSession?.id, servicesSession?.id, mechanicsSession?.id].filter(Boolean),
        },
      },
    });
    await app.close();
  });

  // =========================================================================
  // PART 1: RETAIL DEMO STORE (shikharshaurya.01@gmail.com)
  // =========================================================================
  describe('Retail Demo Store — Catalog, Inventory & POS Workflows', () => {
    it('1. Fetches full retail catalog with 18 seeded products and branch inventory', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/retail/catalog?branchId=${retailBranch.id}`)
        .set('Authorization', `Bearer ${retailToken}`)
        .set('x-organization-id', retailOrg.id)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(18);

      const cable = res.body.find((p: any) => p.sku === 'ELEC-CBL-001');
      expect(cable).toBeDefined();
      expect(cable.name).toBe('USB-C to Lightning Braided Cable 1.5m');
      expect(cable.sellingPrice).toBe(1999); // $19.99 in cents
      expect(cable.quantity).toBeGreaterThanOrEqual(10);
      expect(cable.category?.name).toBe('Electronics & Accessories');
    });

    it('2. Filters catalog by category (Electronics & Accessories)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/retail/catalog?branchId=${retailBranch.id}&category=Electronics %26 Accessories`)
        .set('Authorization', `Bearer ${retailToken}`)
        .set('x-organization-id', retailOrg.id)
        .expect(200);

      expect(res.body.length).toBe(4);
      const skus = res.body.map((p: any) => p.sku);
      expect(skus).toEqual(
        expect.arrayContaining(['ELEC-CBL-001', 'ELEC-CHG-002', 'ELEC-EAR-003', 'ELEC-MNT-004']),
      );
    });

    it('3. Searches catalog by keyword (Fast Charger)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/retail/catalog?branchId=${retailBranch.id}&search=Fast Charger`)
        .set('Authorization', `Bearer ${retailToken}`)
        .set('x-organization-id', retailOrg.id)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].sku).toBe('ELEC-CHG-002');
      expect(res.body[0].name).toContain('65W GaN Dual USB-C Fast Charger');
    });

    it('4. Returns branch inventory with stock mix including normal, low-stock, and out-of-stock items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/retail/inventory/${retailBranch.id}`)
        .set('Authorization', `Bearer ${retailToken}`)
        .set('x-organization-id', retailOrg.id)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(18);

      // Verify out-of-stock item
      const outOfStock = res.body.find((i: any) => i.product.sku === 'HOME-GLS-004');
      expect(outOfStock).toBeDefined();
      expect(outOfStock.quantity).toBe(0);

      // Verify low-stock item
      const lowStock = res.body.find((i: any) => i.product.sku === 'ELEC-MNT-004');
      expect(lowStock).toBeDefined();
      expect(lowStock.quantity).toBe(3);
      expect(lowStock.reorderThreshold).toBe(5);
      expect(lowStock.quantity).toBeLessThan(lowStock.reorderThreshold);
    });

    it('5. Executes cash POS sale: creates order, completes payment and deducts inventory', async () => {
      // Find cable product and get pre-sale quantity
      const cable = await prisma.product.findUnique({
        where: {
          organizationId_sku: {
            organizationId: retailOrg.id,
            sku: 'ELEC-CBL-001',
          },
        },
        include: {
          inventory: { where: { branchId: retailBranch.id } },
        },
      });
      const initialQty = cable!.inventory[0].quantity;
      expect(initialQty).toBeGreaterThanOrEqual(2);

      const orderPayload = {
        branchId: retailBranch.id,
        items: [
          {
            productId: cable!.id,
            quantity: 2,
          },
        ],
        paymentMethod: PaymentMethod.CASH,
        amountReceived: 5000, // $50.00 tendered for order ($39.98 subtotal + $4.00 GST = $43.98 total)
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/retail/orders')
        .set('Authorization', `Bearer ${retailToken}`)
        .set('x-organization-id', retailOrg.id)
        .send(orderPayload)
        .expect(201);

      expect(res.body.status).toBe(OrderStatus.COMPLETED);
      expect(res.body.subtotal).toBe(3998); // 2 * 1999
      expect(res.body.tax).toBe(400); // 10% GST
      expect(res.body.total).toBe(4398); // subtotal + tax
      expect(res.body.payments).toBeDefined();
      expect(res.body.payments.length).toBe(1);
      expect(res.body.payments[0].status).toBe('PAID');
      expect(res.body.payments[0].method).toBe(PaymentMethod.CASH);

      // Verify inventory was deducted atomically
      const updatedInventory = await prisma.inventory.findUnique({
        where: {
          branchId_productId: {
            branchId: retailBranch.id,
            productId: cable!.id,
          },
        },
      });
      expect(updatedInventory!.quantity).toBe(initialQty - 2);
    });
  });

  // =========================================================================
  // PART 2: SERVICES DEMO BUSINESS (demo.services@jesmond.com.au)
  // =========================================================================
  describe('Services Demo Business — Catalogue & Live Availability', () => {
    it('1. Publicly lists service catalogue entries with categories', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/services?branchId=${servicesBranch.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(9);

      const homeCleaning = res.body.find(
        (s: any) => s.name === 'Residential Home Cleaning (Standard)',
      );
      expect(homeCleaning).toBeDefined();
      expect(homeCleaning.durationMins).toBe(60);
      expect(homeCleaning.price).toBe(8000); // $80.00 in cents
      expect(homeCleaning.category?.name).toBe('Cleaning & Domestic Services');

      const deepCleaning = res.body.find(
        (s: any) => s.name === 'End of Lease & Deep Cleaning',
      );
      expect(deepCleaning).toBeDefined();
      expect(deepCleaning.durationMins).toBe(120);
      expect(deepCleaning.price).toBe(18000); // $180.00
    });

    it('2. Computes valid availability slots for a service based on staff working hours', async () => {
      const cleaningService = await prisma.businessService.findFirst({
        where: {
          organizationId: servicesOrg.id,
          name: 'Residential Home Cleaning (Standard)',
        },
      });

      // Target next upcoming Wednesday (dayOfWeek = 3, within Mon-Sat working hours)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + ((3 - targetDate.getDay() + 7) % 7 || 7));
      const dateStr = targetDate.toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/availability?serviceId=${cleaningService!.id}&date=${dateStr}&timezone=Australia/Sydney`)
        .expect(200);

      expect(res.body.serviceId).toBe(cleaningService!.id);
      expect(res.body.date).toBe(dateStr);
      expect(Array.isArray(res.body.availableSlots)).toBe(true);
      expect(res.body.availableSlots.length).toBeGreaterThan(0);
      expect(res.body.availableSlots[0]).toHaveProperty('startTime');
      expect(res.body.availableSlots[0]).toHaveProperty('endTime');
    });
  });

  // =========================================================================
  // PART 3: MECHANICS DEMO BUSINESS (demo.mechanics@jesmond.com.au)
  // =========================================================================
  describe('Mechanics Demo Business — Workshop Services & Diagnostics', () => {
    it('1. Publicly lists workshop services with realistic pricing and details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/services?branchId=${mechanicsBranch.id}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(11);

      const inspection = res.body.find(
        (s: any) => s.name === 'Comprehensive Vehicle Safety Inspection',
      );
      expect(inspection).toBeDefined();
      expect(inspection.price).toBe(8900); // $89.00
      expect(inspection.durationMins).toBe(45);
      expect(inspection.category?.name).toBe('Diagnostics & Roadworthy Inspections');

      const logbook = res.body.find(
        (s: any) => s.name === 'Major Scheduled Logbook Service',
      );
      expect(logbook).toBeDefined();
      expect(logbook.price).toBe(29900); // $299.00
      expect(logbook.durationMins).toBe(90);
      expect(logbook.description).toContain('logbook');
    });

    it('2. Computes live workshop booking slots for vehicle diagnostics', async () => {
      const diagService = await prisma.businessService.findFirst({
        where: {
          organizationId: mechanicsOrg.id,
          name: 'Engine Diagnostic & Fault Code Scan',
        },
      });

      // Target next upcoming Thursday (dayOfWeek = 4, working hours 08:00 - 17:00)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + ((4 - targetDate.getDay() + 7) % 7 || 7));
      const dateStr = targetDate.toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/availability?serviceId=${diagService!.id}&date=${dateStr}&timezone=Australia/Sydney`)
        .expect(200);

      expect(res.body.serviceId).toBe(diagService!.id);
      expect(Array.isArray(res.body.availableSlots)).toBe(true);
      expect(res.body.availableSlots.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // PART 4: UNIVERSAL PUBLIC VISIBILITY TOGGLE & ACCESS INTEGRATION
  // =========================================================================
  describe('Universal Public Visibility Toggle Integration', () => {
    it('1. Hiding organization suppresses services from public discovery', async () => {
      // Toggle visibility OFF
      await prisma.organization.update({
        where: { id: servicesOrg.id },
        data: { isPubliclyVisible: false },
      });

      // Public endpoint must now return empty list
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/services?branchId=${servicesBranch.id}`)
        .expect(200);

      expect(res.body).toEqual([]);

      // Public availability check must be rejected
      const service = await prisma.businessService.findFirst({
        where: { organizationId: servicesOrg.id },
      });
      await request(app.getHttpServer())
        .get(`/api/v1/appointments/availability?serviceId=${service!.id}&date=2026-11-20&timezone=Australia/Sydney`)
        .expect(400);
    });

    it('2. Private authenticated dashboard access functions normally even when publicly hidden', async () => {
      // Authenticated staff can still access branch information
      const res = await request(app.getHttpServer())
        .get('/api/v1/retail/branches')
        .set('Authorization', `Bearer ${servicesToken}`)
        .set('x-organization-id', servicesOrg.id)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((b: any) => b.id === servicesBranch.id)).toBe(true);
    });

    it('3. Re-enabling public visibility immediately restores public discovery and availability', async () => {
      // Toggle visibility back ON
      await prisma.organization.update({
        where: { id: servicesOrg.id },
        data: { isPubliclyVisible: true },
      });

      // Public services list is restored
      const res = await request(app.getHttpServer())
        .get(`/api/v1/appointments/services?branchId=${servicesBranch.id}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(9);

      // Availability slots calculation is restored
      const service = await prisma.businessService.findFirst({
        where: { organizationId: servicesOrg.id },
      });
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + ((3 - targetDate.getDay() + 7) % 7 || 7));
      const dateStr = targetDate.toISOString().split('T')[0];

      const availRes = await request(app.getHttpServer())
        .get(`/api/v1/appointments/availability?serviceId=${service!.id}&date=${dateStr}&timezone=Australia/Sydney`)
        .expect(200);

      expect(availRes.body.availableSlots.length).toBeGreaterThan(0);
    });
  });
});
