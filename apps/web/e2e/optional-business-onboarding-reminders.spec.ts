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

async function setupBusinessSession(
  page: any,
  user: any,
  requirementsByOrg: Record<string, any>,
  options?: { hasBusinessAccess?: boolean },
) {
  let dismissCalls = 0;

  await page.route(/\/api\/v1\//, async (route: any) => {
    const req = route.request();
    const corsHeaders = getCorsHeaders(req);
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = req.url();
    const orgId = req.headers()['x-organization-id'] || user.organizationId || 'org-default';

    if (url.includes('/auth/login')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          access_token: 'mock-biz-jwt',
          user,
        }),
      });
      return;
    }

    if (url.includes('/auth/sso/business-check')) {
      const orgSummary = {
        organizationId: user.organizationId || 'org-default',
        organizationName: 'Incomplete Partner Pty Ltd',
        orgType: user.orgType || 'RETAIL',
        businessCategory: user.businessCategory || 'SERVICES',
        role: 'ADMIN',
        permissions: ['*'],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          hasBusinessAccess: options?.hasBusinessAccess ?? true,
          isAdmin: false,
          requiresOrganizationSelection: false,
          organizations: options?.hasBusinessAccess === false ? [] : [orgSummary],
          activeOrganization: options?.hasBusinessAccess === false ? null : orgSummary,
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
      const payload = requirementsByOrg[orgId] || Object.values(requirementsByOrg)[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(payload),
      });
      return;
    }

    if (url.includes('/business/credentials/completion/dismiss')) {
      dismissCalls += 1;
      const target = requirementsByOrg[orgId] || Object.values(requirementsByOrg)[0];
      if (target) {
        target.dismissedUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ dismissedUntil: target?.dismissedUntil }),
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
    localStorage.setItem('access_token', 'mock-biz-jwt');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);

  return { getDismissCalls: () => dismissCalls };
}

test.describe('Optional Business Onboarding & Profile Completion Reminders', () => {
  const basePendingReqs = (orgId: string, name: string, category: string) => ({
    organizationId: orgId,
    organizationName: name,
    businessCategory: category,
    state: 'NSW',
    branchAddress: null,
    selectedServices: [],
    abn: null,
    abnStatus: 'REQUIRED',
    abnExemptionReason: null,
    overallStatus: 'PENDING',
    isCompleted: false,
    dismissedUntil: null,
    requirements: [
      {
        credentialCode: 'ABN',
        name: 'Australian Business Number',
        verificationAuthority: 'ABR',
        isSatisfied: false,
      },
    ],
  });

  test('1 & 2. Incomplete business user accesses dashboard without forced onboarding and sees popup', async ({
    page,
  }) => {
    const user = {
      id: 'usr-inc-1',
      email: 'incomplete@services.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      organizationId: 'org-inc-1',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupBusinessSession(
      page,
      user,
      { 'org-inc-1': basePendingReqs('org-inc-1', 'Incomplete Services Co', 'SERVICES') },
      { hasBusinessAccess: false }, // Even when backend reports incomplete org setup
    );

    await page.goto(`${BUSINESS_HOST}/login`);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    await page.waitForURL('**/services', { timeout: 15_000 });
    expect(page.url()).toContain(`${new URL(BUSINESS_HOST).host}/services`);
    expect(page.url()).not.toContain('/onboarding');

    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Complete Your Business Profile');
    await expect(modal).toContainText(
      'Your business profile is not fully completed yet. Complete the remaining details to improve your business presence and help customers learn more about your business.',
    );
  });

  test('3. Close (X) button dismisses popup and keeps dashboard accessible', async ({ page }) => {
    const user = {
      id: 'usr-inc-close',
      email: 'close@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-inc-close',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupBusinessSession(page, user, {
      'org-inc-close': basePendingReqs('org-inc-close', 'Close Test Retail', 'RETAIL'),
    });

    await page.goto(`${BUSINESS_HOST}/retail`);
    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();

    await page.locator('[data-testid="business-verification-close-btn"]').click();
    await expect(modal).not.toBeVisible();
    expect(page.url()).toContain('/retail');
  });

  test('4 & 5. Remind Me Later closes popup, persists dismissal, and keeps persistent pending banner', async ({
    page,
  }) => {
    const user = {
      id: 'usr-inc-later',
      email: 'later@food.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'FOOD',
      organizationId: 'org-inc-later',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    const { getDismissCalls } = await setupBusinessSession(page, user, {
      'org-inc-later': basePendingReqs('org-inc-later', 'Later Food Kitchen', 'FOOD'),
    });

    await page.goto(`${BUSINESS_HOST}/food`);
    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();

    await page.getByRole('button', { name: 'Remind Me Later' }).click();
    await expect(modal).not.toBeVisible();
    expect(getDismissCalls()).toBe(1);

    // Persistent dashboard reminder remains visible
    const banner = page.locator('[data-testid="profile-completion-pending-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Profile Completion: Pending');
    await expect(banner).toContainText('Your business profile still needs some information.');

    // Reload: modal stays dismissed, persistent banner remains visible
    await page.reload();
    await expect(modal).not.toBeVisible();
    await expect(banner).toBeVisible();
  });

  test('6. Reminder appears again when reminder cycle expires', async ({ page }) => {
    const user = {
      id: 'usr-inc-cycle',
      email: 'cycle@mechanics.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'MECHANICS',
      organizationId: 'org-inc-cycle',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    const expiredCycleReqs = {
      ...basePendingReqs('org-inc-cycle', 'Cycle Mechanics', 'MECHANICS'),
      dismissedUntil: new Date(Date.now() - 60_000).toISOString(), // Past reminder window
    };

    await setupBusinessSession(page, user, { 'org-inc-cycle': expiredCycleReqs });

    await page.goto(`${BUSINESS_HOST}/mechanics`);
    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();
  });

  test('7. Complete Profile navigates to existing profile completion flow', async ({ page }) => {
    const user = {
      id: 'usr-inc-nav',
      email: 'complete@rentals.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RENTALS',
      organizationId: 'org-inc-nav',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupBusinessSession(page, user, {
      'org-inc-nav': basePendingReqs('org-inc-nav', 'Nav Vehicle Rentals', 'RENTALS'),
    });

    await page.goto(`${BUSINESS_HOST}/rentals`);
    await page.locator('[data-testid="business-verification-start-btn"]').click();
    await page.waitForURL('**/portal/business/verification', { timeout: 15_000 });
  });

  test('8. Completed profile permanently hides popup and persistent reminder', async ({ page }) => {
    const user = {
      id: 'usr-complete-1',
      email: 'done@accommodation.example.com',
      role: 'ORG_STAFF',
      orgType: 'PROVIDER',
      businessCategory: 'RETAIL',
      organizationId: 'org-complete-1',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupBusinessSession(page, user, {
      'org-complete-1': {
        ...basePendingReqs('org-complete-1', 'Completed Lodge', 'ACCOMMODATION'),
        abnStatus: 'VERIFIED',
        overallStatus: 'VERIFIED',
        isCompleted: true,
        requirements: [],
      },
    });

    await page.goto(`${BUSINESS_HOST}/accommodation`);
    await expect(page.locator('[data-testid="business-verification-modal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="profile-completion-pending-banner"]')).toHaveCount(0);
  });

  test('9. Multiple organisations maintain independent completion and dismissal status', async ({
    page,
  }) => {
    const user = {
      id: 'usr-multi-org',
      email: 'multi@example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-a',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupBusinessSession(page, user, {
      'org-a': {
        ...basePendingReqs('org-a', 'Org A Complete', 'RETAIL'),
        isCompleted: true,
        overallStatus: 'VERIFIED',
      },
      'org-b': basePendingReqs('org-b', 'Org B Incomplete', 'FOOD'),
    });

    // Org A is complete: no popup or banner
    await page.goto(`${BUSINESS_HOST}/retail`);
    await expect(page.locator('[data-testid="business-verification-modal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="profile-completion-pending-banner"]')).toHaveCount(0);

    // Switch active organisation to Org B (incomplete)
    await page.evaluate(() => {
      sessionStorage.setItem('jesmond_selected_organization_id', 'org-b');
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      u.organizationId = 'org-b';
      u.businessCategory = 'FOOD';
      localStorage.setItem('user', JSON.stringify(u));
    });

    await page.goto(`${BUSINESS_HOST}/food`);
    const modal = page.locator('[data-testid="business-verification-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Org B Incomplete');
  });

  test('10. Student accounts are unaffected by business profile completion reminders', async ({
    page,
  }) => {
    const student = {
      id: 'stu-unaffected',
      email: 'student@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    };

    await setupBusinessSession(page, student, {});
    await page.goto(`${MAIN_HOST}/student`);
    await expect(page.locator('[data-testid="business-verification-modal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="profile-completion-pending-banner"]')).toHaveCount(0);
  });
});
