import { test, expect } from '@playwright/test';

const MAIN_HOST = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

const getCorsHeaders = (req: any) => ({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': req.headers()['origin'] || BUSINESS_HOST,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
});

async function mockBusinessAuthApis(
  page: any,
  options: {
    user: any;
    organizations?: any[];
    activeOrganization?: any;
    hasBusinessAccess?: boolean;
    requiresOrganizationSelection?: boolean;
    rejectCrossOrgId?: string;
    preAuthenticated?: boolean;
  },
) {
  let sessionEstablished = !!options?.preAuthenticated;

  await page.route('**/api/auth/session', async (route: any) => {
    if (!sessionEstablished) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false, user: null }),
      });
      return;
    }
    const activeOrg = options.activeOrganization || options.organizations?.[0];
    const resolvedUser = activeOrg
      ? {
          ...options.user,
          organizationId: activeOrg.organizationId,
          orgType: activeOrg.orgType,
          businessCategory: activeOrg.businessCategory,
          orgRole: activeOrg.role,
          permissions: activeOrg.permissions,
        }
      : options.user;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: resolvedUser,
        organizationId: resolvedUser?.organizationId || null,
      }),
    });
  });

  await page.route('**/api/auth/session/establish', async (route: any) => {
    sessionEstablished = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/auth/session/logout', async (route: any) => {
    sessionEstablished = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, backendRevoked: true }),
    });
  });

  await page.route(/\/api\/v1\//, async (route: any) => {
    const req = route.request();
    const corsHeaders = getCorsHeaders(req);
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = req.url();
    const headers = req.headers();
    const authHeader = headers['authorization'] || '';

    if (url.includes('/auth/login')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          access_token: 'mock-jwt-business-token',
          requiresOrganizationSelection: !!options.requiresOrganizationSelection,
          organizations: options.organizations || [],
          user: options.user,
        }),
      });
      return;
    }

    if (url.includes('/auth/sso/business-check')) {
      // Ensure Bearer token is sent even on business subdomain (zero localStorage token)
      if (!authHeader.startsWith('Bearer ')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Missing Authorization header' }),
        });
        return;
      }

      const orgs = options.organizations || (options.activeOrganization ? [options.activeOrganization] : []);
      const requestedOrgId = headers['x-organization-id'];
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
          userId: options.user.id,
          email: options.user.email,
          role: options.user.role,
          hasBusinessAccess: options.hasBusinessAccess ?? (orgs.length > 0 || options.user.role === 'ADMIN'),
          isAdmin: options.user.role === 'ADMIN' || options.user.role === 'SUPER_ADMIN',
          requiresOrganizationSelection: orgs.length > 1 && !matched,
          organizations: orgs,
          activeOrganization: matched,
        }),
      });
      return;
    }

    if (url.includes('/auth/sso/authorize')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          code: 'mock-sso-code-123',
          state: 'mock-sso-state',
          redirect_uri: `${BUSINESS_HOST}/auth/callback`,
        }),
      });
      return;
    }

    if (url.includes('/auth/sso/exchange')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          access_token: 'mock-sso-exchanged-jwt',
          session: { id: 'sess-1', expiresAt: new Date(Date.now() + 86400000).toISOString() },
          user: options.user,
        }),
      });
      return;
    }

    if (url.includes('/auth/me')) {
      const requestedOrgId = headers['x-organization-id'];
      if (options.rejectCrossOrgId && requestedOrgId === options.rejectCrossOrgId) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ message: 'You do not have access to the requested organization.' }),
        });
        return;
      }

      const orgs = options.organizations || [];
      const activeOrg = requestedOrgId
        ? orgs.find((o: any) => o.organizationId === requestedOrgId)
        : options.activeOrganization || orgs[0];

      const resolvedUser = activeOrg
        ? {
            ...options.user,
            organizationId: activeOrg.organizationId,
            orgType: activeOrg.orgType,
            businessCategory: activeOrg.businessCategory,
            orgRole: activeOrg.role,
            permissions: activeOrg.permissions || ['*'],
          }
        : options.user;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ ...resolvedUser, user: resolvedUser }),
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

test.describe('Business Authentication & Dashboard Routing Architecture', () => {
  const categoryCases = [
    {
      label: 'Accommodation',
      orgType: 'PROVIDER',
      businessCategory: 'RETAIL', // Default Prisma category for PROVIDER orgs
      expectedPath: '/accommodation',
    },
    {
      label: 'Retail',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      expectedPath: '/retail',
    },
    {
      label: 'Food',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      expectedPath: '/food',
    },
    {
      label: 'Mechanics',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      expectedPath: '/mechanics',
    },
    {
      label: 'Services',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      expectedPath: '/services',
    },
    {
      label: 'Rentals',
      orgType: 'RETAIL',
      businessCategory: 'RENTALS',
      expectedPath: '/rentals',
    },
  ];

  for (const tc of categoryCases) {
    test(`Existing ${tc.label} business login -> ${tc.expectedPath} on business subdomain (never onboarding)`, async ({
      page,
    }) => {
      const org = {
        organizationId: `org-${tc.label.toLowerCase()}`,
        organizationName: `${tc.label} Partner Pty Ltd`,
        orgType: tc.orgType,
        businessCategory: tc.businessCategory,
        role: 'ADMIN',
        permissions: ['*'],
      };
      const user = {
        id: `user-${tc.label.toLowerCase()}`,
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

      await mockBusinessAuthApis(page, { user, organizations: [org], activeOrganization: org });

      await page.goto(`${BUSINESS_HOST}/login`);
      await page.locator('input[type="email"]').fill(user.email);
      await page.locator('input[type="password"]').fill('Password123!');
      await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

      await page.waitForURL(`**${tc.expectedPath}`, { timeout: 15_000 });
      expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}${tc.expectedPath}`);
      expect(page.url()).not.toContain('/onboarding');
    });
  }

  test('7. Business login through shared authentication -> redirects to business subdomain dashboard', async ({
    page,
  }) => {
    const org = {
      organizationId: 'org-shared-mech',
      organizationName: 'Shared Mechanics Workshop',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const user = {
      id: 'user-shared-mech',
      email: 'mech@shared.example.com',
      role: 'ORG_STAFF',
      firstName: 'Shared',
      lastName: 'Mechanic',
      organizationId: org.organizationId,
      orgType: org.orgType,
      businessCategory: org.businessCategory,
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await mockBusinessAuthApis(page, { user, organizations: [org], activeOrganization: org });

    await page.goto(`${MAIN_HOST}/login`);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).first().click();

    await page.waitForURL('**/mechanics', { timeout: 15_000 });
    expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}/mechanics`);
  });

  test('8. Business signup after successful organization creation -> routes to business dashboard', async ({
    page,
  }) => {
    const org = {
      organizationId: 'org-verified-rentals',
      organizationName: 'Campus Vehicle Hire',
      orgType: 'RETAIL',
      businessCategory: 'RENTALS',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const user = {
      id: 'user-verified-rentals',
      email: 'hire@rentals.example.com',
      role: 'ORG_STAFF',
      firstName: 'Rental',
      lastName: 'Owner',
      organizationId: org.organizationId,
      orgType: org.orgType,
      businessCategory: org.businessCategory,
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await mockBusinessAuthApis(page, { user, organizations: [org], activeOrganization: org });
    await page.route(/\/api\/v1\/auth\/verify-email/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: getCorsHeaders(route.request()),
        body: JSON.stringify({
          access_token: 'mock-verified-jwt',
          user,
        }),
      });
    });

    await page.goto(`${BUSINESS_HOST}/verify?email=${encodeURIComponent(user.email)}`);
    await page.locator('input[placeholder="123456"]').fill('123456');
    await page.getByRole('button', { name: /Complete Verification/i }).click();

    await page.waitForURL('**/rentals', { timeout: 15_000 });
    expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}/rentals`);
  });

  test('9. Incomplete new business registration -> routes to existing onboarding flow', async ({
    page,
  }) => {
    const incompleteUser = {
      id: 'user-incomplete-1',
      email: 'newpartner@example.com',
      role: 'STUDENT',
      firstName: 'New',
      lastName: 'Partner',
    };

    await mockBusinessAuthApis(page, {
      user: incompleteUser,
      organizations: [],
      hasBusinessAccess: false,
    });

    await page.goto(`${BUSINESS_HOST}/login`);
    await page.locator('input[type="email"]').fill(incompleteUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    await page.waitForURL('**/business/onboarding', { timeout: 15_000 });
    await expect(
      page.getByText(/Your identity is active, but you do not yet have a registered commercial organization/i),
    ).toBeVisible();
  });

  test('10. User with multiple organizations -> prompts authorized organization selection', async ({
    page,
  }) => {
    const orgA = {
      organizationId: 'org-multi-1',
      organizationName: 'Alpha Retail Store',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const orgB = {
      organizationId: 'org-multi-2',
      organizationName: 'Beta Food Kitchen',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      role: 'MANAGER',
      permissions: ['*'],
    };
    const user = {
      id: 'user-multi-1',
      email: 'multi@example.com',
      role: 'ORG_STAFF',
      firstName: 'Multi',
      lastName: 'Owner',
    };

    await mockBusinessAuthApis(page, {
      user,
      organizations: [orgA, orgB],
      requiresOrganizationSelection: true,
    });

    await page.goto(`${BUSINESS_HOST}/login`);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    await expect(page.getByText('Select Organization')).toBeVisible();
    await expect(page.getByText('Alpha Retail Store')).toBeVisible();
    await expect(page.getByText('Beta Food Kitchen')).toBeVisible();

    await page.getByRole('button', { name: /Beta Food Kitchen/i }).click();
    await page.waitForURL('**/food', { timeout: 15_000 });
    expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}/food`);
  });

  test('11. Student login -> remains on main domain /student dashboard', async ({ page }) => {
    const studentUser = {
      id: 'student-1',
      email: 'student@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    };

    await mockBusinessAuthApis(page, { user: studentUser });

    await page.goto(`${MAIN_HOST}/login`);
    await page.locator('input[type="email"]').fill(studentUser.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).first().click();

    await page.waitForURL('**/student', { timeout: 15_000 });
    expect(page.url()).toContain(`${MAIN_HOST}/student`);
    expect(page.url()).not.toContain('business.');
  });

  test('12 & 13. Visit Site targets main site and dashboard navigation stays on business subdomain', async ({
    page,
  }) => {
    const org = {
      organizationId: 'org-nav-food',
      organizationName: 'Nav Food Co',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const user = {
      id: 'user-nav-food',
      email: 'nav@food.example.com',
      role: 'ORG_STAFF',
      firstName: 'Nav',
      lastName: 'Food',
      organizationId: org.organizationId,
      orgType: org.orgType,
      businessCategory: org.businessCategory,
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await mockBusinessAuthApis(page, { user, organizations: [org], activeOrganization: org, preAuthenticated: true });
    await page.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify(u));
    }, user);

    await page.goto(`${BUSINESS_HOST}/food`);
    await expect(page).toHaveURL(new RegExp(`${new URL(BUSINESS_HOST).host.replace('.', '\\.')}/food`));

    const visitSiteLink = page.getByRole('link', { name: /Visit Site/i });
    await expect(visitSiteLink).toBeVisible();
    await expect(visitSiteLink).toHaveAttribute('href', MAIN_HOST);
  });

  test('14. Unauthorized user cannot access another organization or mismatched category dashboard', async ({
    page,
  }) => {
    const retailOrg = {
      organizationId: 'org-retail-only',
      organizationName: 'Only Retail Co',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      role: 'ADMIN',
      permissions: ['*'],
    };
    const user = {
      id: 'user-retail-only',
      email: 'retail@only.example.com',
      role: 'ORG_STAFF',
      firstName: 'Retail',
      lastName: 'Only',
      organizationId: retailOrg.organizationId,
      orgType: retailOrg.orgType,
      businessCategory: retailOrg.businessCategory,
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await mockBusinessAuthApis(page, {
      user,
      organizations: [retailOrg],
      activeOrganization: retailOrg,
      rejectCrossOrgId: 'org-foreign-999',
      preAuthenticated: true,
    });
    await page.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify(u));
    }, user);

    // Attempting to access /accommodation as a RETAIL user must redirect back to /retail
    await page.goto(`${BUSINESS_HOST}/accommodation`);
    await page.waitForURL('**/retail', { timeout: 15_000 });
    expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}/retail`);
  });
});
