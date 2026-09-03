import { test, expect } from '@playwright/test';
import { PrismaClient, OrgType, UserRole, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

test.describe('Provider Type Isolation', () => {
  let accUser: any;
  let retUser: any;

  test.beforeAll(async () => {
    // Cleanup any leftovers from previous failed runs
    await prisma.orgStaff.deleteMany({
      where: { user: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } } }
    });
    await prisma.session.deleteMany({
      where: { user: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } }
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ['QA Acc Org', 'QA Ret Org'] } }
    });

    const password = await bcrypt.hash('Password123!', 10);
    
    // Create Accommodation Provider via RAW SQL to bypass Prisma Client Enum cache issues
    const accOrgResult: any[] = await prisma.$queryRaw`
      INSERT INTO "Organization" (id, name, type, status, "updatedAt") 
      VALUES (gen_random_uuid(), 'QA Acc Org', 'PROVIDER'::"OrgType", 'VERIFIED', now()) 
      RETURNING id
    `;
    const accOrgId = accOrgResult[0].id;

    accUser = await prisma.user.create({
      data: {
        email: 'qa_acc_prov@jesmond.com',
        firstName: 'Acc',
        lastName: 'Prov',
        password,
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
      }
    });
    await prisma.orgStaff.create({
      data: { userId: accUser.id, organizationId: accOrgId, role: UserRole.ORG_STAFF, permissions: ['*'] }
    });

    // Create Retail Provider via RAW SQL
    const retOrgResult: any[] = await prisma.$queryRaw`
      INSERT INTO "Organization" (id, name, type, status, "updatedAt") 
      VALUES (gen_random_uuid(), 'QA Ret Org', 'RETAIL'::"OrgType", 'VERIFIED', now()) 
      RETURNING id
    `;
    const retOrgId = retOrgResult[0].id;
    retUser = await prisma.user.create({
      data: {
        email: 'qa_ret_prov@jesmond.com',
        firstName: 'Ret',
        lastName: 'Prov',
        password,
        role: UserRole.ORG_STAFF,
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: true,
      }
    });
    await prisma.orgStaff.create({
      data: { userId: retUser.id, organizationId: retOrgId, role: UserRole.ORG_STAFF, permissions: ['*'] }
    });
  });

  test.beforeEach(async ({ page }) => {
    // Mock Turnstile using init script before hydration
    await page.addInitScript(() => {
      // @ts-ignore
      window.turnstile = {
        // @ts-ignore
        render: function(container, options) {
          // @ts-ignore
          setTimeout(() => { if (options.callback) options.callback('dummy-test-token') }, 100);
          return 'widget-id';
        },
        remove: function() {},
        reset: function() {}
      };
    });
  });

  test.afterAll(async () => {
    // Cleanup logic
    await prisma.orgStaff.deleteMany({
      where: { user: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } } }
    });
    await prisma.session.deleteMany({
      where: { user: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['qa_acc_prov@jesmond.com', 'qa_ret_prov@jesmond.com'] } }
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ['QA Acc Org', 'QA Ret Org'] } }
    });
    await prisma.$disconnect();
  });

  test('Accommodation Provider sees only accommodation links', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'qa_acc_prov@jesmond.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('http://localhost:3000/portal');
    
    // Should see My Properties, Applications, Settings
    await expect(page.locator('nav').locator('text=My Properties')).toBeVisible();
    await expect(page.locator('nav').locator('text=Applications')).toBeVisible();
    
    // Should NOT see Retail links
    await expect(page.locator('nav').locator('text=Retail Overview')).toBeHidden();
    await expect(page.locator('nav').locator('text=Inventory')).toBeHidden();
    await expect(page.locator('nav').locator('text=POS')).toBeHidden();

    // 1. Direct URL Protection (Frontend)
    await page.goto('http://localhost:3000/portal/retail/inventory');
    await expect(page).toHaveURL('http://localhost:3000/portal');

    // 2. API Route Protection (Backend)
    const apiCheck = await page.evaluate(async () => {
      const token = window.localStorage.getItem('access_token');
      const authHeader = token ? `Bearer ${token}` : '';
      const res = await fetch('http://localhost:3001/api/v1/retail/businesses/profile', { 
        headers: { Authorization: authHeader } 
      });
      return res.status;
    });
    expect(apiCheck).toBe(403);
  });

  test('Retail Provider sees only retail links and is redirected to retail dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'qa_ret_prov@jesmond.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Should be redirected to /portal/retail
    await expect(page).toHaveURL('http://localhost:3000/portal/retail');
    
    // Should see Retail links
    await expect(page.locator('nav').locator('text=Retail Overview')).toBeVisible();
    await expect(page.locator('nav').locator('text=Inventory')).toBeVisible();
    await expect(page.locator('nav').locator('text=POS')).toBeVisible();
    
    // Should NOT see My Properties or Accommodation Applications
    await expect(page.locator('nav').locator('text=My Properties')).toBeHidden();
    await expect(page.locator('nav').locator('text=Applications')).toBeHidden();

    // 1. Direct URL Protection (Frontend)
    await page.goto('http://localhost:3000/portal/properties');
    await expect(page).toHaveURL('http://localhost:3000/portal/retail');

    // 2. API Route Protection (Backend)
    const apiCheck = await page.evaluate(async () => {
      const token = window.localStorage.getItem('access_token');
      const authHeader = token ? `Bearer ${token}` : '';
      const res = await fetch('http://localhost:3001/api/v1/properties/my', { 
        headers: { Authorization: authHeader } 
      });
      return res.status;
    });
    expect(apiCheck).toBe(403);
  });

  test('Public endpoint rejects RETAIL organization registration', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    const apiCheck = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3001/api/v1/auth/register', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Bad',
          lastName: 'Actor',
          email: 'hacker@retail.com',
          password: 'Password123!',
          organizationName: 'Hacker Retail',
          organizationType: 'RETAIL',
        })
      });
      return res.status;
    });
    // Should fail class-validator validation
    expect(apiCheck).toBe(400);
  });
});
