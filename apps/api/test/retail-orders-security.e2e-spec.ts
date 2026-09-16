import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Retail Orders Security & BOLA (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let orgA: any;
  let orgB: any;
  let orgCreatorToken: string;
  let legacyAdminToken: string;
  let empNoViewToken: string;
  let empViewToken: string;
  let customerA: any;
  let customerAToken: string;
  let customerBToken: string;
  let accomToken: string;

  let orderOrgA: any;
  let orderOrgB: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // 1. Setup Organizations
    orgA = await prisma.organization.create({ data: { name: 'Retail Org A', type: 'RETAIL' } });
    orgB = await prisma.organization.create({ data: { name: 'Retail Org B', type: 'RETAIL' } });
    const accomOrg = await prisma.organization.create({ data: { name: 'Accom Org', type: 'PROVIDER' } });

    // 2. Setup Retail Branches & Terminals
    const branchA = await prisma.retailBranch.create({ data: { organizationId: orgA.id, name: 'Branch A', address: '123' } });
    const branchB = await prisma.retailBranch.create({ data: { organizationId: orgB.id, name: 'Branch B', address: '456' } });

    // 3. Setup Users & Roles
    // Creator (treated as RETAIL BUSINESS ADMIN implicitly by role=ADMIN)
    const creatorUser = await prisma.user.create({ data: { email: 'creator_orders_test@test.com', password: 'hash', firstName: 'C', lastName: 'C' } });
    await prisma.orgStaff.create({ data: { userId: creatorUser.id, organizationId: orgA.id, role: 'ADMIN', permissions: ['*'] } });
    orgCreatorToken = jwtService.sign({ sub: creatorUser.id, email: creatorUser.email, role: 'ADMIN', organizationId: orgA.id });

    // Legacy wildcard admin (ORG_STAFF + ['*'])
    const legacyUser = await prisma.user.create({ data: { email: 'legacy_orders_test@test.com', password: 'hash', firstName: 'L', lastName: 'L' } });
    await prisma.orgStaff.create({ data: { userId: legacyUser.id, organizationId: orgA.id, role: 'ORG_STAFF', permissions: ['*'] } });
    legacyAdminToken = jwtService.sign({ sub: legacyUser.id, email: legacyUser.email, role: 'ORG_STAFF', organizationId: orgA.id });

    // Employee WITHOUT ORDERS_VIEW
    const empNoViewUser = await prisma.user.create({ data: { email: 'emp_noview@test.com', password: 'hash', firstName: 'E', lastName: 'N' } });
    await prisma.orgStaff.create({ data: { userId: empNoViewUser.id, organizationId: orgA.id, role: 'ORG_STAFF', permissions: ['POS_VIEW'] } });
    empNoViewToken = jwtService.sign({ sub: empNoViewUser.id, email: empNoViewUser.email, role: 'ORG_STAFF', organizationId: orgA.id });

    // Employee WITH ORDERS_VIEW
    const empViewUser = await prisma.user.create({ data: { email: 'emp_view@test.com', password: 'hash', firstName: 'E', lastName: 'V' } });
    await prisma.orgStaff.create({ data: { userId: empViewUser.id, organizationId: orgA.id, role: 'ORG_STAFF', permissions: ['ORDERS_VIEW'] } });
    empViewToken = jwtService.sign({ sub: empViewUser.id, email: empViewUser.email, role: 'ORG_STAFF', organizationId: orgA.id });

    // Accommodation provider
    const accomUser = await prisma.user.create({ data: { email: 'accom_user@test.com', password: 'hash', firstName: 'A', lastName: 'A' } });
    await prisma.orgStaff.create({ data: { userId: accomUser.id, organizationId: accomOrg.id, role: 'ORG_STAFF', permissions: ['*'] } });
    accomToken = jwtService.sign({ sub: accomUser.id, email: accomUser.email, role: 'ORG_STAFF', organizationId: accomOrg.id });

    // Customers
    const custUserA = await prisma.user.create({ data: { email: 'customer_a_orders@test.com', password: 'hash', firstName: 'Cust', lastName: 'A' } });
    customerAToken = jwtService.sign({ sub: custUserA.id, email: custUserA.email, role: 'STUDENT' });
    customerA = await prisma.retailCustomer.create({ data: { organizationId: orgA.id, email: custUserA.email, firstName: 'Cust A' } });

    const custUserB = await prisma.user.create({ data: { email: 'customer_b_orders@test.com', password: 'hash', firstName: 'Cust', lastName: 'B' } });
    customerBToken = jwtService.sign({ sub: custUserB.id, email: custUserB.email, role: 'STUDENT' });
    const customerB = await prisma.retailCustomer.create({ data: { organizationId: orgA.id, email: custUserB.email, firstName: 'Cust B' } });

    // Create Orders
    orderOrgA = await prisma.salesOrder.create({
      data: {
        organizationId: orgA.id,
        branchId: branchA.id,
        customerId: customerA.id,
        orderNumber: 'ORD-A1',
        subtotal: 100, tax: 10, total: 110,
        status: 'PENDING'
      }
    });

    orderOrgB = await prisma.salesOrder.create({
      data: {
        organizationId: orgB.id,
        branchId: branchB.id,
        orderNumber: 'ORD-B1',
        subtotal: 200, tax: 20, total: 220,
        status: 'PENDING'
      }
    });
  });

  afterAll(async () => {
    await prisma.salesOrder.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.retailCustomer.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.retailBranch.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.orgStaff.deleteMany({ where: { user: { email: { contains: 'orders_test' } } } });
    await prisma.orgStaff.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });
    // User deleted handled implicitly or skipped to avoid Session foreign key constraints
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
  });

  it('1. Retail Provider creator (ADMIN) has full admin access for their own organization', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/orders')
      .set('Authorization', `Bearer ${orgCreatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: orderOrgA.id })]));
  });

  it('2. Retail Provider creator cannot access another organization\'s orders (BOLA)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/retail/orders/${orderOrgB.id}`)
      .set('Authorization', `Bearer ${orgCreatorToken}`);
    expect(res.status).toBe(404);
  });

  it('3. Legacy wildcard admin retains full retail access', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/orders')
      .set('Authorization', `Bearer ${legacyAdminToken}`);
    expect(res.status).toBe(200);
  });

  it('4. Normal employee without ORDERS_VIEW receives 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/orders')
      .set('Authorization', `Bearer ${empNoViewToken}`);
    expect(res.status).toBe(403);
  });

  it('5. Employee with ORDERS_VIEW can view allowed orders only', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/orders')
      .set('Authorization', `Bearer ${empViewToken}`);
    expect(res.status).toBe(200);
    
    // Cannot view another org's order
    const res2 = await request(app.getHttpServer())
      .get(`/api/v1/retail/orders/${orderOrgB.id}`)
      .set('Authorization', `Bearer ${empViewToken}`);
    expect(res2.status).toBe(404);
  });

  it('6. Customer can view their own orders via /customer/orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(orderOrgA.id);
  });

  it('7. Customer cannot view another customer\'s order via /customer/orders/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/customer/orders/${orderOrgA.id}`)
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(res.status).toBe(404);
  });

  it('8. Retail Org A cannot retrieve Org B\'s orders via retail endpoints', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/retail/orders/${orderOrgB.id}`)
      .set('Authorization', `Bearer ${orgCreatorToken}`);
    expect(res.status).toBe(404);
  });

  it('9. Accommodation provider cannot access retail order endpoints', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/orders')
      .set('Authorization', `Bearer ${accomToken}`);
    expect(res.status).toBe(403); // Due to OrgTypesGuard
  });
});
