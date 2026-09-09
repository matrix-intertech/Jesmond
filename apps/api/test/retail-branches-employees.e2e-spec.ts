import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { RetailModule } from '../src/modules/retail/retail.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('Retail Branch & Employee Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let orgA: any;
  let orgB: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = "postgresql://postgres:Jesmond@localhost:5432/jesmond_test?schema=public";
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, RetailModule],
      providers: [JwtService],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Organization" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Organization" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    
    orgA = await prisma.organization.create({ data: { name: 'Org A', type: 'RETAIL' } });
    orgB = await prisma.organization.create({ data: { name: 'Org B', type: 'RETAIL' } });
    const hash = await bcrypt.hash('password123', 10);
    
    userA = await prisma.user.create({ data: { email: 'usera@test.com', emailVerified: true, firstName: 'A', lastName: 'A', role: 'ORG_STAFF', accountStatus: 'ACTIVE', password: hash } });
    await prisma.orgStaff.create({ data: { userId: userA.id, organizationId: orgA.id, role: 'ADMIN' } });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const sessionA = await prisma.session.create({ data: { userId: userA.id, ipAddress: '127.0.0.1', deviceInfo: 'test', refreshToken: 'dummyTokenA', expiresAt: futureDate } });
    tokenA = jwtService.sign({ sub: userA.id, email: userA.email, role: userA.role, organizationId: orgA.id, sessionId: sessionA.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });

    userB = await prisma.user.create({ data: { email: 'userb@test.com', emailVerified: true, firstName: 'B', lastName: 'B', role: 'ORG_STAFF', accountStatus: 'ACTIVE', password: hash } });
    await prisma.orgStaff.create({ data: { userId: userB.id, organizationId: orgB.id, role: 'ADMIN' } });
    const sessionB = await prisma.session.create({ data: { userId: userB.id, ipAddress: '127.0.0.1', deviceInfo: 'test', refreshToken: 'dummyTokenB', expiresAt: futureDate } });
    tokenB = jwtService.sign({ sub: userB.id, email: userB.email, role: userB.role, organizationId: orgB.id, sessionId: sessionB.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });
  });

  let branchAId: string;

  it('1. should create a branch successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/retail/branches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Branch A', phone: '123456', address: '123 Test St', isActive: true });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Branch A');
    branchAId = res.body.id;

    const dbBranch = await prisma.retailBranch.findUnique({ where: { id: branchAId } });
    expect(dbBranch).toBeDefined();
    expect(dbBranch?.organizationId).toBe(orgA.id);
  });

  it('2. should enforce cross-organization branch isolation', async () => {
    const branchA = await prisma.retailBranch.create({ data: { name: 'Branch A', organizationId: orgA.id } });

    const resUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/retail/branches/${branchA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked Branch' });
    
    expect(resUpdate.status).toBe(403);

    const resDelete = await request(app.getHttpServer())
      .delete(`/api/v1/retail/branches/${branchA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(resDelete.status).toBe(403);
  });

  it('3. should list branches', async () => {
    await prisma.retailBranch.create({ data: { name: 'Branch 1', organizationId: orgA.id } });
    await prisma.retailBranch.create({ data: { name: 'Branch 2', organizationId: orgB.id } });

    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/branches')
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Branch 1');
  });

  it('4. should update and delete branch', async () => {
    const branch = await prisma.retailBranch.create({ data: { name: 'To Update', organizationId: orgA.id } });

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/retail/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Updated' });
    
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated');

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/retail/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(deleteRes.status).toBe(200);
    const dbBranch = await prisma.retailBranch.findUnique({ where: { id: branch.id } });
    expect(dbBranch?.isActive).toBe(false);
  });

  let employeeAId: string;

  it('5. should create employee and enforce cross-org branch isolation', async () => {
    const branchB = await prisma.retailBranch.create({ data: { name: 'Branch B', organizationId: orgB.id } });

    const resFail = await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'newemp@test.com', firstName: 'New', role: 'ORG_STAFF', branchId: branchB.id });
    
    expect(resFail.status).toBe(403);

    const branchA = await prisma.retailBranch.create({ data: { name: 'Branch A', organizationId: orgA.id } });

    const resSuccess = await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'newemp@test.com', firstName: 'New', role: 'ORG_STAFF', branchId: branchA.id });
    
    expect(resSuccess.status).toBe(201);
    employeeAId = resSuccess.body.orgStaff.id;

    const dbStaff = await prisma.orgStaff.findUnique({ where: { id: employeeAId }, include: { user: true } });
    expect(dbStaff?.organizationId).toBe(orgA.id);
    expect(dbStaff?.retailBranchId).toBe(branchA.id);
    expect(dbStaff?.user.email).toBe('newemp@test.com');
  });

  it('6. should enforce cross-organization employee isolation', async () => {
    const newEmp = await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'isolate@test.com', firstName: 'Isolate', role: 'ORG_STAFF' });
    
    const empId = newEmp.body.orgStaff.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/retail/employees/${empId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ role: 'ADMIN' });
    
    expect(updateRes.status).toBe(403);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/retail/employees/${empId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(deleteRes.status).toBe(403);
  });

  it('7. should list employees for the organization', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'empa@test.com', firstName: 'Emp A', role: 'ORG_STAFF' });

    await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ email: 'empb@test.com', firstName: 'Emp B', role: 'ORG_STAFF' });
    
    const res = await request(app.getHttpServer())
      .get('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    // UserA + new EmpA
    expect(res.body.length).toBe(2);
    expect(res.body.map((e: any) => e.user.email)).toContain('empa@test.com');
    expect(res.body.map((e: any) => e.user.email)).not.toContain('empb@test.com');
  });

  it('8. should update and delete employee', async () => {
    const newEmp = await request(app.getHttpServer())
      .post('/api/v1/retail/employees')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'update@test.com', firstName: 'Update', role: 'ORG_STAFF' });
    
    const empId = newEmp.body.orgStaff.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/retail/employees/${empId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ role: 'ADMIN', accountStatus: 'SUSPENDED' });
    
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.role).toBe('ADMIN');
    
    const dbStaff = await prisma.orgStaff.findUnique({ where: { id: empId }, include: { user: true } });
    expect(dbStaff?.user.accountStatus).toBe('SUSPENDED');

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/retail/employees/${empId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(deleteRes.status).toBe(200);
    const dbStaffDel = await prisma.orgStaff.findUnique({ where: { id: empId }, include: { user: true } });
    expect(dbStaffDel?.user.accountStatus).toBe('DEACTIVATED');
  });

});
