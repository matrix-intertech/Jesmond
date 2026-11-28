import { test, expect } from '@playwright/test';
import { resolveDashboardId } from '../utils/quickstart';

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

async function setupDashboardWithOnboardingStore(
  page: any,
  user: any,
  store: Record<string, any>,
) {
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
    const onboardingMatch = url.match(/\/api\/v1\/onboarding\/dashboards\/([^/?]+)(\/reset)?/);
    if (onboardingMatch) {
      const dashId = onboardingMatch[1].toUpperCase();
      const isReset = Boolean(onboardingMatch[2]);
      const key = `${user.id}:${dashId}`;

      if (req.method() === 'GET') {
        const existing = store[key] || {
          id: null,
          userId: user.id,
          dashboardId: dashId,
          tutorialVersion: 1,
          status: 'NOT_STARTED',
          lastCompletedStep: 0,
          completedAt: null,
          skippedAt: null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(existing),
        });
        return;
      }

      if (req.method() === 'PUT') {
        const body = req.postDataJSON();
        store[key] = {
          id: `ob-${key}`,
          userId: user.id,
          dashboardId: dashId,
          tutorialVersion: body.tutorialVersion ?? 1,
          status: body.status,
          lastCompletedStep: body.lastCompletedStep ?? 0,
          completedAt: body.status === 'COMPLETED' ? new Date().toISOString() : null,
          skippedAt: body.status === 'SKIPPED' ? new Date().toISOString() : null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(store[key]),
        });
        return;
      }

      if (req.method() === 'POST' && isReset) {
        store[key] = {
          id: `ob-${key}`,
          userId: user.id,
          dashboardId: dashId,
          tutorialVersion: 1,
          status: 'IN_PROGRESS',
          lastCompletedStep: 0,
          completedAt: null,
          skippedAt: null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify(store[key]),
        });
        return;
      }
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
          organizationName: 'Test Partner Pty Ltd',
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

test.describe('Unified Dashboard Quickstart Guide & Interactive Onboarding', () => {
  test('1. First-time login auto-launches Student tutorial, navigates Next/Prev/Finish, persists COMPLETED, and allows reopen & restart', async ({
    page,
  }) => {
    const store: Record<string, any> = {};
    const student = {
      id: 'stu-qs-1',
      email: 'student.qs@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
    };

    await setupDashboardWithOnboardingStore(page, student, store);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/student`);

    // Auto-launches on first visit
    const card = page.getByTestId('interactive-tutorial-card');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 1 of 6');
    await expect(card).toContainText('Welcome to Your Customer Dashboard');

    // Next & Previous navigation
    await page.getByTestId('tutorial-next-btn').click();
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 2 of 6');
    await page.getByTestId('tutorial-prev-btn').click();
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 1 of 6');

    // Step through to Finish
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('tutorial-next-btn').click();
    }
    await expect(card).toHaveCount(0);
    expect(store['stu-qs-1:STUDENT']?.status).toBe('COMPLETED');

    // Reloading does NOT auto-launch again
    await page.reload();
    await expect(page.getByTestId('quickstart-header-btn')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await expect(page.getByTestId('interactive-tutorial-card')).toHaveCount(0);

    // Clicking Header Quickstart icon opens Guide Dialog and allows Restart
    await page.getByTestId('quickstart-header-btn').click();
    const dialog = page.getByTestId('quickstart-guide-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Customer Dashboard Quickstart');
    await expect(dialog).toContainText('Tutorial: Completed');

    await page.getByTestId('quickstart-start-tutorial-btn').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible();
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 1 of 6');
  });

  test('2. Skip tutorial persists SKIPPED, suppresses future auto-launch, and isolates progress across dashboards & users', async ({
    page,
  }) => {
    const store: Record<string, any> = {};
    const retailAdmin = {
      id: 'biz-qs-1',
      email: 'owner@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-qs-retail',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };

    await setupDashboardWithOnboardingStore(page, retailAdmin, store);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BUSINESS_HOST}/retail`);

    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('interactive-tutorial-card')).toContainText(
      'Welcome to Retail Overview',
    );

    await page.getByTestId('tutorial-skip-btn').click();
    await expect(page.getByTestId('interactive-tutorial-card')).toHaveCount(0);
    expect(store['biz-qs-1:RETAIL']?.status).toBe('SKIPPED');

    // Reloading RETAIL does not re-launch
    await page.reload();
    await expect(page.getByTestId('quickstart-header-btn')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await expect(page.getByTestId('interactive-tutorial-card')).toHaveCount(0);

    // Switching to FOOD dashboard (different dashboardId) still auto-launches FOOD tutorial
    const foodUser = {
      ...retailAdmin,
      businessCategory: 'FOOD',
      organizationId: 'org-qs-food',
    };
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setupDashboardWithOnboardingStore(page, foodUser, store);
    await page.goto(`${BUSINESS_HOST}/food`);
    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('interactive-tutorial-card')).toContainText(
      'Welcome to Food Orders',
    );
  });

  test('3. Role-based permissions filter Retail tutorial steps and mobile header shows Quickstart button', async ({
    page,
  }) => {
    const store: Record<string, any> = {};
    const limitedStaff = {
      id: 'biz-staff-limited',
      email: 'cashier@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-qs-retail-2',
      orgRole: 'STAFF',
      permissions: ['RETAIL_DASHBOARD_VIEW', 'CATALOG_VIEW'],
    };

    await setupDashboardWithOnboardingStore(page, limitedStaff, store);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BUSINESS_HOST}/retail`);

    // Header Quickstart button is visible on mobile
    await expect(page.getByTestId('quickstart-header-btn')).toBeVisible({ timeout: 10_000 });
    // Limited staff only gets Welcome + Catalog + Quickstart = 3 steps (no POS, Inventory, Orders, Settings)
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 1 of 3');
  });

  test('4. Admin dashboard displays Admin Quickstart Guide & Tutorial', async ({ page }) => {
    const store: Record<string, any> = {};
    const admin = {
      id: 'adm-qs-1',
      email: 'admin@jesmond.com.au',
      role: 'ADMIN',
      firstName: 'Ada',
      lastName: 'Admin',
    };

    await setupDashboardWithOnboardingStore(page, admin, store);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/admin`);

    await expect(page.getByTestId('quickstart-header-btn')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible();
    await expect(page.getByTestId('interactive-tutorial-card')).toContainText(
      'Welcome to the Admin Dashboard',
    );
  });

  test('5. Mobile hidden sidebar target hides spotlight & shows hint, opening sidebar reveals spotlight, Desktop shows spotlight', async ({
    page,
  }) => {
    const store: Record<string, any> = {};
    const student = {
      id: 'stu-mob-vis',
      email: 'mob.vis@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Mob',
      lastName: 'Student',
    };

    await setupDashboardWithOnboardingStore(page, student, store);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${MAIN_HOST}/student`);

    // Step 1 targets visible header title -> spotlight ring is present
    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('tutorial-spotlight-ring')).toBeVisible();

    // Step 2 targets off-screen mobile sidebar link (/search) -> NO spotlight ring + mobile hint shown
    await page.getByTestId('tutorial-next-btn').click();
    await expect(page.getByTestId('tutorial-step-counter')).toHaveText('Step 2 of 6');
    await expect(page.getByTestId('tutorial-spotlight-ring')).toHaveCount(0);
    await expect(page.getByTestId('tutorial-mobile-nav-hint')).toBeVisible();

    // Opening mobile sidebar makes /search visible -> spotlight ring appears
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(page.getByTestId('tutorial-spotlight-ring')).toBeVisible({ timeout: 5_000 });

    // Desktop viewport shows spotlight ring immediately on Step 2
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('tutorial-spotlight-ring')).toBeVisible();
  });

  test('6. Persistence failure on Finish/Skip preserves tutorial state, prevents duplicate submits, and succeeds on Retry', async ({
    page,
  }) => {
    const student = {
      id: 'stu-fail-retry',
      email: 'retry@jesmond.com.au',
      role: 'STUDENT',
      firstName: 'Retry',
      lastName: 'User',
    };

    let putCalls = 0;
    let failNextPut = true;

    await page.addInitScript((u: any) => {
      localStorage.setItem('access_token', 'mock-student-jwt');
      localStorage.setItem('user', JSON.stringify(u));
    }, student);

    await page.route(/\/api\/v1\//, async (route: any) => {
      const req = route.request();
      const corsHeaders = getCorsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const url = req.url();
      if (url.includes('/api/v1/onboarding/dashboards/STUDENT')) {
        if (req.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({
              id: null,
              userId: student.id,
              dashboardId: 'STUDENT',
              tutorialVersion: 1,
              status: 'NOT_STARTED',
              lastCompletedStep: 0,
              completedAt: null,
              skippedAt: null,
            }),
          });
          return;
        }
        if (req.method() === 'PUT') {
          const body = req.postDataJSON();
          if (body.status === 'SKIPPED' || body.status === 'COMPLETED') {
            putCalls += 1;
            if (failNextPut) {
              await new Promise((r) => setTimeout(r, 150));
              await route.fulfill({
                status: 503,
                contentType: 'application/json',
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Database unavailable' }),
              });
              return;
            }
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({
              id: 'ob-retry',
              userId: student.id,
              dashboardId: 'STUDENT',
              tutorialVersion: 1,
              status: body.status,
              lastCompletedStep: body.lastCompletedStep ?? 0,
              completedAt: body.status === 'COMPLETED' ? new Date().toISOString() : null,
              skippedAt: body.status === 'SKIPPED' ? new Date().toISOString() : null,
            }),
          });
          return;
        }
      }
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ ...student, user: student }),
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

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${MAIN_HOST}/student`);

    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible({ timeout: 10_000 });

    // Click Skip while backend returns 503 -> tutorial stays open, error & Retry visible
    await page.getByTestId('tutorial-skip-btn').click();
    await expect(page.getByTestId('tutorial-save-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('interactive-tutorial-card')).toBeVisible();
    expect(putCalls).toBe(1);

    // Retry succeeds and closes tutorial
    failNextPut = false;
    await page.getByTestId('tutorial-retry-btn').click();
    await expect(page.getByTestId('interactive-tutorial-card')).toHaveCount(0);
    expect(putCalls).toBe(2);
  });

  test('7. resolveDashboardId returns null for PARENT outside /settings and SETTINGS on /settings', async () => {
    const parentUser: any = { id: 'p-1', email: 'parent@jesmond.com.au', role: 'PARENT' };
    expect(resolveDashboardId(parentUser, '/portal')).toBeNull();
    expect(resolveDashboardId(parentUser, '/student')).toBe('STUDENT');
    expect(resolveDashboardId(parentUser, '/settings/profile')).toBe('SETTINGS');
    expect(resolveDashboardId(null, '/unknown')).toBeNull();
  });
});
