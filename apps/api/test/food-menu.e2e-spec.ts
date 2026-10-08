import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

describe('Food Menu Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  
  let foodToken: string;
  let retailToken: string;
  let mechanicsToken: string;

  let foodOrgId: string;
  let foodBranchId: string;

  let retailOrgId: string;
  let retailBranchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Setup FOOD
    const foodOrg = await prisma.organization.create({
      data: { name: 'Food Org', type: 'PROVIDER', status: 'VERIFIED', businessCategory: 'FOOD' },
    });
    foodOrgId = foodOrg.id;
    const foodBranch = await prisma.retailBranch.create({
      data: { name: 'Food Branch', organizationId: foodOrgId },
    });
    foodBranchId = foodBranch.id;

    const foodUser = await prisma.user.create({
      data: { email: `food-${Date.now()}@test.com`, password: 'pwd', firstName: 'F', lastName: 'U' },
    });
    await prisma.orgStaff.create({ data: { userId: foodUser.id, organizationId: foodOrgId, role: UserRole.ADMIN } });
    const s1 = await prisma.session.create({ data: { userId: foodUser.id, refreshToken: `f-${Date.now()}`, expiresAt: new Date(Date.now() + 100000) } });
    foodToken = jwtService.sign({ sub: foodUser.id, email: foodUser.email, role: foodUser.role, orgId: foodOrgId, orgRoles: ['ADMIN'], sessionId: s1.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });

    // Setup RETAIL
    const retailOrg = await prisma.organization.create({
      data: { name: 'Retail Org', type: 'RETAIL', status: 'VERIFIED', businessCategory: 'RETAIL' },
    });
    retailOrgId = retailOrg.id;
    const retailBranch = await prisma.retailBranch.create({
      data: { name: 'Retail Branch', organizationId: retailOrgId },
    });
    retailBranchId = retailBranch.id;

    const retailUser = await prisma.user.create({
      data: { email: `retail-${Date.now()}@test.com`, password: 'pwd', firstName: 'R', lastName: 'U' },
    });
    await prisma.orgStaff.create({ data: { userId: retailUser.id, organizationId: retailOrgId, role: UserRole.ADMIN } });
    const s2 = await prisma.session.create({ data: { userId: retailUser.id, refreshToken: `r-${Date.now()}`, expiresAt: new Date(Date.now() + 100000) } });
    retailToken = jwtService.sign({ sub: retailUser.id, email: retailUser.email, role: retailUser.role, orgId: retailOrgId, orgRoles: ['ADMIN'], sessionId: s2.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });

    // Setup MECHANICS
    const mechOrg = await prisma.organization.create({
      data: { name: 'Mech Org', type: 'PROVIDER', status: 'VERIFIED', businessCategory: 'MECHANICS' },
    });
    const mechUser = await prisma.user.create({
      data: { email: `mech-${Date.now()}@test.com`, password: 'pwd', firstName: 'M', lastName: 'U' },
    });
    await prisma.orgStaff.create({ data: { userId: mechUser.id, organizationId: mechOrg.id, role: UserRole.ADMIN } });
    const s3 = await prisma.session.create({ data: { userId: mechUser.id, refreshToken: `m-${Date.now()}`, expiresAt: new Date(Date.now() + 100000) } });
    mechanicsToken = jwtService.sign({ sub: mechUser.id, email: mechUser.email, role: mechUser.role, orgId: mechOrg.id, orgRoles: ['ADMIN'], sessionId: s3.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdMenuId: string;
  let createdCategoryId: string;
  let createdItemId: string;

  it('7. RETAIL cannot manage Food menu', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu')
      .set('Authorization', `Bearer ${retailToken}`)
      .send({ branchId: retailBranchId, name: 'Retail Food Menu' });
    expect(res.status).toBe(403);
  });

  it('8. MECHANICS cannot manage Food menu', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu')
      .set('Authorization', `Bearer ${mechanicsToken}`)
      .send({ branchId: foodBranchId, name: 'Mech Food Menu' });
    expect(res.status).toBe(403);
  });

  it('1. FOOD can create menu', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ branchId: foodBranchId, name: 'Main Menu', description: 'Our main offerings' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Main Menu');
    createdMenuId = res.body.id;
  });

  it('2. FOOD can update menu', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/food/menu/${createdMenuId}`)
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ name: 'Updated Main Menu' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Main Menu');
  });

  it('3. FOOD can create category', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu/categories')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ menuId: createdMenuId, name: 'Starters', displayOrder: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Starters');
    createdCategoryId = res.body.id;
  });

  it('4. FOOD can update category', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/food/menu/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ name: 'Appetizers' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Appetizers');
  });

  it('13. Negative price is rejected for menu item', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu/items')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ categoryId: createdCategoryId, name: 'Invalid Item', price: -500 });
    expect(res.status).toBe(400); // Bad Request from class-validator
  });

  it('5. FOOD can create menu item', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/food/menu/items')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ categoryId: createdCategoryId, name: 'Garlic Bread', price: 650, displayOrder: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Garlic Bread');
    expect(res.body.price).toBe(650);
    createdItemId = res.body.id;
  });

  it('6. FOOD can update menu item', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/food/menu/items/${createdItemId}`)
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ price: 700 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(700);
  });

  it('11. Unauthorized organization cannot manipulate another Food organization\'s menu', async () => {
    // Setup second FOOD org
    const foodOrg2 = await prisma.organization.create({
      data: { name: 'Food Org 2', type: 'PROVIDER', status: 'VERIFIED', businessCategory: 'FOOD' },
    });
    const foodUser2 = await prisma.user.create({
      data: { email: `food2-${Date.now()}@test.com`, password: 'pwd', firstName: 'F', lastName: 'U' },
    });
    await prisma.orgStaff.create({ data: { userId: foodUser2.id, organizationId: foodOrg2.id, role: UserRole.ADMIN } });
    const s4 = await prisma.session.create({ data: { userId: foodUser2.id, refreshToken: `f2-${Date.now()}`, expiresAt: new Date(Date.now() + 100000) } });
    const foodToken2 = jwtService.sign({ sub: foodUser2.id, email: foodUser2.email, role: foodUser2.role, orgId: foodOrg2.id, orgRoles: ['ADMIN'], sessionId: s4.id }, { secret: process.env.JWT_SECRET || 'fallback-secret-for-dev' });

    // Try to update Org 1's menu with Org 2's token
    const res = await request(app.getHttpServer())
      .patch(`/v1/food/menu/${createdMenuId}`)
      .set('Authorization', `Bearer ${foodToken2}`)
      .send({ name: 'Hacked Menu' });
    expect(res.status).toBe(404); // Menu not found for Org 2
  });

  it('15. Inactive menu/category/items are excluded from public read API', async () => {
    // Create inactive category and item
    const resCat = await request(app.getHttpServer())
      .post('/v1/food/menu/categories')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ menuId: createdMenuId, name: 'Secret Category', isActive: false });
    
    await request(app.getHttpServer())
      .post('/v1/food/menu/items')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({ categoryId: resCat.body.id, name: 'Secret Item', price: 1000 });

    const resPublic = await request(app.getHttpServer())
      .get(`/v1/food/menu/public/${foodBranchId}`);
    
    expect(resPublic.status).toBe(200);
    expect(resPublic.body.name).toBe('Updated Main Menu');
    // The inactive category should NOT be returned
    const cat = resPublic.body.categories.find(c => c.name === 'Secret Category');
    expect(cat).toBeUndefined();
  });
});
