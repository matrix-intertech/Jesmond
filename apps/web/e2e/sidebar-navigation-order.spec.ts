import { test, expect } from '@playwright/test';

const MAIN_HOST =
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

const getCorsHeaders = (req: any) => ({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': req.headers()['origin'] || MAIN_HOST,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
});

async function seedDashboard(page: any, user: any) {
  if (user.role !== 'STUDENT') {
    await page.route('**/api/auth/session', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user,
          organizationId: user.organizationId || null,
        }),
      });
    });
  } else {
    await page.addInitScript((u: any) => {
      localStorage.setItem('access_token', 'mock-student-jwt');
      localStorage.setItem('user', JSON.stringify(u));
    }, user);
  }

  await page.route(/\/api\/v1\//, async (route: any) => {
    const req = route.request();
    const corsHeaders = getCorsHeaders(req);
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = req.url();
    if (url.includes('/api/v1/onboarding/dashboards/')) {
      const dashId = url.split('/dashboards/')[1]?.split('?')[0] || 'STUDENT';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          id: `ob-${dashId}`,
          userId: user.id,
          dashboardId: dashId,
          tutorialVersion: 1,
          status: 'COMPLETED',
          lastCompletedStep: 1,
          completedAt: new Date().toISOString(),
          skippedAt: null,
        }),
      });
      return;
    }
    if (url.includes('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ ...user, user }),
      });
      return;
    }
    if (url.includes('/business/credentials/requirements')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          organizationId: user.organizationId || 'org-1',
          organizationName: 'Test Co',
          businessCategory: user.businessCategory || 'RETAIL',
          overallStatus: 'VERIFIED',
          isCompleted: true,
          requirements: [],
        }),
      });
      return;
    }
    if (url.includes('/food/business/orders')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ data: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify([]),
    });
  });
}

async function getSidebarLabels(page: any): Promise<string[]> {
  const list = page.getByTestId('sidebar-nav-list');
  await expect(list).toBeVisible({ timeout: 10_000 });
  return list.locator('li a span').allTextContents();
}

test.describe('Standardized Common Sidebar Navigation Order', () => {
  test('Student: Dashboard 1st -> Operations -> Settings last', async ({ page }) => {
    await seedDashboard(page, {
      id: 'stu-nav-order',
      email: 'stu@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/student`);
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Dashboard',
      'Search Accommodation',
      'Saved',
      'Messages',
      'My Applications',
      'Settings',
    ]);
  });

  test('Admin & Super Admin: Dashboard 1st -> Operations -> Compliance -> Settings last', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'adm-nav-order',
      email: 'admin@jesmond.com.au',
      role: 'SUPER_ADMIN',
      firstName: 'Ada',
      lastName: 'Admin',
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/admin`);
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Dashboard',
      'Properties',
      'Users',
      'Applications',
      'Business Credentials',
      'ABN Exemptions',
      'Name Change Requests',
      'Settings',
    ]);
  });

  test('Accommodation: Dashboard 1st -> Operations -> Verification & Licences -> Settings last', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'acc-nav-order',
      email: 'acc@provider.example.com',
      role: 'ORG_STAFF',
      orgType: 'PROVIDER',
      organizationId: 'org-acc',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/accommodation`);
    const labels = await getSidebarLabels(page);
    expect(labels[0]).toBe('Dashboard');
    expect(labels[labels.length - 2]).toBe('Verification & Licences');
    expect(labels[labels.length - 1]).toBe('Settings');
  });

  test('Retail Admin: Business Overview 1st -> Operations -> Verification & Licences -> Settings last', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'ret-nav-order',
      email: 'ret@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-ret',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/retail`);
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Business Overview',
      'Business Profile',
      'Business Branches',
      'Employees',
      'Business Terminals',
      'Business Customers',
      'Business Catalog',
      'Inventory',
      'Orders',
      'Sales History',
      'POS',
      'Verification & Licences',
      'Settings',
    ]);
  });

  test('Retail Limited Staff without RETAIL_SETTINGS_VIEW hides Settings with no empty placeholder', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'ret-staff-order',
      email: 'staff@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-ret-2',
      orgRole: 'STAFF',
      permissions: ['RETAIL_DASHBOARD_VIEW', 'ORDERS_VIEW'],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/retail`);
    const labels = await getSidebarLabels(page);
    expect(labels[0]).toBe('Business Overview');
    expect(labels).not.toContain('Settings');
    expect(labels[labels.length - 1]).toBe('Verification & Licences');
  });

  test('Mechanics & Services: Dashboard 1st -> Appointments Operations -> Verification & Licences -> Settings last', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'mech-nav-order',
      email: 'mech@workshop.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      organizationId: 'org-mech',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/mechanics`);
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Dashboard',
      'Appointments',
      'Services',
      'Staff & Professionals',
      'Availability & Time Off',
      'Customers',
      'Business Profile',
      'Business Branches',
      'Verification & Licences',
      'Settings',
    ]);
  });

  test('Rentals preserves existing items in standardized order', async ({ page }) => {
    await seedDashboard(page, {
      id: 'rent-nav-order',
      email: 'rent@rentals.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RENTALS',
      organizationId: 'org-rent',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/rentals`);
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Business Profile',
      'Business Branches',
      'Verification & Licences',
      'Settings',
    ]);
  });

  test('Food & Rentals preserve existing items in standardized order and work on mobile drawer', async ({
    page,
  }) => {
    await seedDashboard(page, {
      id: 'food-nav-order',
      email: 'food@cafe.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      organizationId: 'org-food',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BUSINESS_HOST}/food`);
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    const labels = await getSidebarLabels(page);
    expect(labels).toEqual([
      'Business Profile',
      'Business Branches',
      'Verification & Licences',
      'Settings',
    ]);
  });
});
