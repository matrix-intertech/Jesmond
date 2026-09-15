import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';

describe('Retail Marketplace Security & Concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let staffToken: string;
  let orgId: string;
  let branchId: string;
  let adminUserId: string;
  let staffUserId: string;
  let staffOrgStaffId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Setup base data
    const org = await prisma.organization.create({
      data: { name: 'E2E Secure Org', type: 'RETAIL', status: 'VERIFIED' }
    });
    orgId = org.id;

    const branch = await prisma.retailBranch.create({
      data: { name: 'E2E Branch', organizationId: orgId }
    });
    branchId = branch.id;

    // Setup ADMIN user
    const adminUser = await prisma.user.create({
      data: { email: `admin-${Date.now()}@test.com`, password: 'hashed', firstName: 'Admin', lastName: 'User', role: UserRole.ORG_STAFF }
    });
    adminUserId = adminUser.id;
    await prisma.orgStaff.create({
      data: { userId: adminUser.id, organizationId: orgId, role: UserRole.ADMIN, permissions: [] }
    });
    const sessionAdmin = await prisma.session.create({ data: { userId: adminUser.id, ipAddress: '127.0.0.1', deviceInfo: 'test', refreshToken: `dummy-${Date.now()}`, expiresAt: new Date(Date.now() + 100000000) } });
    adminToken = jwtService.sign({
      sub: adminUser.id, email: adminUser.email, role: adminUser.role,
      orgId: orgId, orgRoles: ['ADMIN'], sessionId: sessionAdmin.id
    }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });

    // Setup STAFF user (no special permissions)
    const staffUser = await prisma.user.create({
      data: { email: `staff-${Date.now()}@test.com`, password: 'hashed', firstName: 'Staff', lastName: 'User', role: UserRole.ORG_STAFF }
    });
    staffUserId = staffUser.id;
    const staffOrgStaff = await prisma.orgStaff.create({
      data: { userId: staffUser.id, organizationId: orgId, role: UserRole.ORG_STAFF, permissions: [] }
    });
    staffOrgStaffId = staffOrgStaff.id;
    const sessionStaff = await prisma.session.create({ data: { userId: staffUser.id, ipAddress: '127.0.0.1', deviceInfo: 'test', refreshToken: `dummy2-${Date.now()}`, expiresAt: new Date(Date.now() + 100000000) } });
    staffToken = jwtService.sign({
      sub: staffUser.id, email: staffUser.email, role: staffUser.role,
      orgId: orgId, orgRoles: ['ORG_STAFF'], sessionId: sessionStaff.id
    }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('P0 Privilege Escalation', () => {
    it('should deny basic staff from escalating their own role to ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/retail/employees/${staffOrgStaffId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ role: 'ADMIN' });
      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to update employee permissions', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/retail/employees/${staffOrgStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: ['ORDERS_VIEW'] });
      expect(res.status).toBe(200);
    });
  });

  describe('P1 Checkout Race Condition', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: { name: 'Race Product', sku: `RACE-${Date.now()}`, sellingPrice: 1000, organizationId: orgId, imageUrl: 'https://img.com' }
      });
      productId = product.id;

      await prisma.inventory.create({
        data: { branchId, productId, quantity: 1 } // Only 1 item in stock
      });
    });

    it('should safely handle simultaneous checkouts for 1 item when stock is 1', async () => {
      const payload = {
        branchId,
        fulfillmentType: 'IN_STORE',
        items: [{ productId, quantity: 1 }]
      };

      // Fire 5 requests simultaneously
      const requests = Array(5).fill(0).map(() =>
        request(app.getHttpServer())
          .post(`/retail/marketplace/checkout`)
          .set('Authorization', `Bearer ${staffToken}`) // Use staff token as a regular user for checkout
          .send(payload)
      );

      const responses = await Promise.all(requests);

      const successes = responses.filter(r => r.status === 201);
      const failures = responses.filter(r => r.status === 400);

      // Exactly ONE should succeed
      expect(successes.length).toBe(1);
      // The rest should fail with 400 Insufficient Inventory
      expect(failures.length).toBe(4);

      // Inventory should be 0, not negative
      const inv = await prisma.inventory.findUnique({
        where: { branchId_productId: { branchId, productId } }
      });
      expect(inv.quantity).toBe(0);
    });
  });
});
