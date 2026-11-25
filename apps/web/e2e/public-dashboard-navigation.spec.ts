import { test, expect } from '@playwright/test';

const MAIN_HOST = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

const getCorsHeaders = (req: any) => ({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': req.headers()['origin'] || MAIN_HOST,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
});

async function seedPublicSession(
  page: any,
  user: any,
  options?: {
    organizations?: any[];
    activeOrganization?: any;
    hasBusinessAccess?: boolean;
    requiresOrganizationSelection?: boolean;
  },
) {
  await page.route(/\/api\/v1\//, async (route: any) => {
    const req = route.request();
    const corsHeaders = getCorsHeaders(req);
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = req.url();
    const orgs = options?.organizations || (options?.activeOrganization ? [options.activeOrganization] : []);

    if (url.includes('/auth/sso/business-check')) {
      const requestedOrgId = req.headers()['x-organization-id'];
      const matched = requestedOrgId
        ? orgs.find((o: any) => o.organizationId === requestedOrgId) || null
        : orgs.length === 1
          ? orgs[0]
          : null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          hasBusinessAccess: options?.hasBusinessAccess ?? (orgs.length > 0 || user.role === 'ADMIN'),
          isAdmin: user.role === 'ADMIN' || user.role === 'SUPER_ADMIN',
          requiresOrganizationSelection:
            options?.requiresOrganizationSelection ?? (orgs.length > 1 && !matched),
          organizations: orgs,
          activeOrganization: matched,
        }),
      });
      return;
    }

    if (url.includes('/auth/me')) {
      const activeOrg = options?.activeOrganization || (orgs.length === 1 ? orgs[0] : null);
      const resolved = activeOrg
        ? {
            ...user,
            organizationId: activeOrg.organizationId,
            orgType: activeOrg.orgType,
            businessCategory: activeOrg.businessCategory,
            orgRole: activeOrg.role,
            permissions: activeOrg.permissions || ['*'],
          }
        : user;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ ...resolved, user: resolved }),
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

  await page.addInitScript((u: any) => {
    localStorage.setItem('access_token', 'mock-public-jwt');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
}

test.describe('Public Website Dynamic Dashboard Navigation', () => {
  test('1. Student clicks Dashboard on desktop -> routes to /student on main domain', async ({ page }) => {
    const student = {
      id: 'stu-nav-1',
      email: 'student@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    };
    await seedPublicSession(page, student);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/`);

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('href', '/student');
    await dashboardLink.click();

    await page.waitForURL('**/student', { timeout: 15_000 });
    expect(page.url()).toContain(`${MAIN_HOST}/student`);
  });

  const businessCases = [
    { label: 'Accommodation', orgType: 'PROVIDER', businessCategory: 'RETAIL', path: '/accommodation' },
    { label: 'Retail', orgType: 'RETAIL', businessCategory: 'RETAIL', path: '/retail' },
    { label: 'Food', orgType: 'RETAIL', businessCategory: 'FOOD', path: '/food' },
    { label: 'Mechanics', orgType: 'RETAIL', businessCategory: 'MECHANICS', path: '/mechanics' },
    { label: 'Services', orgType: 'RETAIL', businessCategory: 'SERVICES', path: '/services' },
    { label: 'Rentals', orgType: 'RETAIL', businessCategory: 'RENTALS', path: '/rentals' },
  ];

  for (const tc of businessCases) {
    test(`${tc.label} business clicks Dashboard (Desktop & Mobile) -> ${BUSINESS_HOST}${tc.path} (no public 404)`, async ({
      page,
    }) => {
      const org = {
        organizationId: `org-pub-${tc.label.toLowerCase()}`,
        organizationName: `${tc.label} Partner`,
        orgType: tc.orgType,
        businessCategory: tc.businessCategory,
        role: 'ADMIN',
        permissions: ['*'],
      };
      const user = {
        id: `usr-pub-${tc.label.toLowerCase()}`,
        email: `owner@${tc.label.toLowerCase()}.example.com`,
        role: 'ORG_STAFF',
        firstName: tc.label,
        lastName: 'Owner',
        organizationId: org.organizationId,
        orgType: org.orgType,
        businessCategory: org.businessCategory,
        orgRole: 'ADMIN',
        permissions: ['*'],
      };

      await seedPublicSession(page, user, { organizations: [org], activeOrganization: org });

      // Desktop header Dashboard
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${MAIN_HOST}/`);

      const desktopDashboard = page.getByRole('link', { name: 'Dashboard' }).first();
      await expect(desktopDashboard).toBeVisible();
      await expect(desktopDashboard).toHaveAttribute('href', `${BUSINESS_HOST}${tc.path}`);
      await desktopDashboard.click();

      await page.waitForURL(`**${tc.path}`, { timeout: 15_000 });
      expect(page.url()).toBe(`${BUSINESS_HOST}${tc.path}`);

      // Mobile menu Dashboard produces identical routing
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${MAIN_HOST}/`);
      await page.getByRole('button', { name: /Open Navigation Menu/i }).click();

      const mobileDialog = page.getByRole('dialog', { name: /Mobile Navigation/i });
      const mobileDashboard = mobileDialog.getByRole('link', { name: 'Dashboard' });
      await expect(mobileDashboard).toBeVisible();
      await expect(mobileDashboard).toHaveAttribute('href', `${BUSINESS_HOST}${tc.path}`);
      await mobileDashboard.click();

      await page.waitForURL(`**${tc.path}`, { timeout: 15_000 });
      expect(page.url()).toBe(`${BUSINESS_HOST}${tc.path}`);
    });
  }

  test('8. Multi-organisation user clicks Dashboard -> routes to organisation selection on business subdomain', async ({
    page,
  }) => {
    const orgA = {
      organizationId: 'org-multi-a',
      organizationName: 'Alpha Retail',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const orgB = {
      organizationId: 'org-multi-b',
      organizationName: 'Beta Services',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const user = {
      id: 'usr-multi-pub',
      email: 'multi@example.com',
      role: 'ORG_STAFF',
      firstName: 'Multi',
      lastName: 'Org',
    };

    await seedPublicSession(page, user, {
      organizations: [orgA, orgB],
      requiresOrganizationSelection: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/`);

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();

    await page.waitForURL('**/login', { timeout: 15_000 });
    expect(page.url()).toBe(`${BUSINESS_HOST}/login`);
  });

  test('9. Incomplete business account clicks Dashboard -> routes to onboarding flow on business subdomain', async ({
    page,
  }) => {
    const incompleteUser = {
      id: 'usr-incomplete-pub',
      email: 'incomplete@example.com',
      role: 'ORG_STAFF',
      firstName: 'Incomplete',
      lastName: 'Partner',
    };

    await seedPublicSession(page, incompleteUser, {
      organizations: [],
      hasBusinessAccess: false,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/`);

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('href', `${BUSINESS_HOST}/onboarding`);
    await dashboardLink.click();

    await page.waitForURL('**/onboarding', { timeout: 15_000 });
    expect(page.url()).toBe(`${BUSINESS_HOST}/onboarding`);
  });

  test('10. Unauthenticated user sees Log in -> /login and no Dashboard CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/`);

    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    const loginLink = page.getByRole('link', { name: 'Log in' }).first();
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});
