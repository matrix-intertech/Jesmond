import { test, expect } from '@playwright/test';

const MAIN_HOST =
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

async function mockCommonApi(page: any, user: any | null) {
  await page.route('**/api/auth/session**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: !!user,
        user,
        organizationId: user?.organizationId ?? null,
      }),
    });
  });

  await page.route('**/api/v1/**', async (route: any) => {
    const url = route.request().url();
    const json = (d: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });

    if (url.includes('/credentials/requirements')) {
      return json({ overallStatus: 'VERIFIED', isCompleted: true, requirements: [] });
    }
    if (url.includes('/settings/profile')) {
      return json({ user, profileCompletion: { isComplete: true, missingFields: [] } });
    }
    if (url.includes('/notifications')) return json({ items: [], unreadCount: 0 });
    if (url.includes('/subscriptions/public/config')) {
      return json({ subscriptionsEnabled: true, checkoutEnabled: true });
    }
    if (url.includes('/retail/marketplace/stores')) {
      return json({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    }
    return json([]);
  });

  if (user) {
    await page.addInitScript((u: any) => {
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('access_token', 'mock-token');
      if (u.organizationId) {
        localStorage.setItem('selectedOrganizationId', u.organizationId);
      }
    }, user);
  }
}

test.describe('Floating Mobile Bottom Navigation Regression', () => {
  test('Public customer nav: light theme, active state, reload, and browser back/forward', async ({
    page,
    isMobile,
  }) => {
    await mockCommonApi(page, null);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${MAIN_HOST}/support`);
    const nav = page.getByRole('navigation', { name: 'Primary mobile navigation' });
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute('data-theme-variant', 'customer-light');

    const labels = await nav.locator('a').allInnerTexts();
    expect(labels.map((s) => s.trim())).toEqual(['Home', 'Search', 'Businesses', 'Guide']);

    // Navigate to Businesses
    await nav.getByRole('link', { name: 'Businesses' }).click();
    await expect(page).toHaveURL(/\/businesses$/);
    await expect(nav.getByRole('link', { name: 'Businesses' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Reload preserves active state
    await page.reload();
    await expect(nav.getByRole('link', { name: 'Businesses' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Navigate to Guide then test Back/Forward
    await nav.getByRole('link', { name: 'Guide' }).click();
    await expect(page).toHaveURL(/\/guide/);
    await expect(nav.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page).toHaveURL(/\/businesses/);
    await expect(nav.getByRole('link', { name: 'Businesses' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goForward();
    await expect(page).toHaveURL(/\/guide/);
    await expect(nav.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');

    // Desktop 1440px hides mobile bottom nav
    if (!isMobile) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(nav).toBeHidden();
    }
  });

  test('Hidden on auth routes and logged-out protected routes', async ({ page }) => {
    await mockCommonApi(page, null);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const url of [
      `${MAIN_HOST}/login`,
      `${MAIN_HOST}/register`,
      `${MAIN_HOST}/forgot-password`,
      `${BUSINESS_HOST}/business/login`,
      `${BUSINESS_HOST}/business/register`,
      `${BUSINESS_HOST}/business/onboarding`,
    ]) {
      await page.goto(url);
      await expect(page.getByRole('navigation', { name: 'Primary mobile navigation' })).toHaveCount(
        0,
      );
    }
  });

  test('Role-based nav: Student, Retail Limited Staff, and Services Business Portal', async ({
    page,
  }) => {
    const stuUser = {
      id: 'stu-1',
      role: 'STUDENT',
      firstName: 'Sam',
      lastName: 'Student',
      email: 'sam@uon.edu.au',
    };
    await mockCommonApi(page, stuUser);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${MAIN_HOST}/support`);
    const nav = page.getByRole('navigation', { name: 'Primary mobile navigation' });
    await expect(nav).toHaveAttribute('data-theme-variant', 'customer-light');
    await expect(nav.locator('a')).toHaveText([
      'Home',
      'Search',
      'Chat',
      'Activity',
      'Settings',
    ]);

    // 2. Retail Limited Staff (without RETAIL_SETTINGS_VIEW)
    const retStaffUser = {
      id: 'ret-staff-1',
      role: 'ORG_STAFF',
      orgRole: 'STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-ret-1',
      permissions: ['ORDERS_VIEW'],
    };
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockCommonApi(page, retStaffUser);
    await page.goto(`${BUSINESS_HOST}/portal/retail/orders`);
    await page.evaluate((u) => {
      localStorage.setItem('user', JSON.stringify(u));
      window.dispatchEvent(new Event('storage'));
    }, retStaffUser);
    await expect(nav).toHaveAttribute('data-theme-variant', 'business-dark');
    await expect(nav.locator('a')).toHaveText(['Home', 'Catalog', 'Inventory', 'Orders']);

    // 3. Services / Mechanics Business Portal + drawer open/close + navigation
    const srvUser = {
      id: 'srv-1',
      role: 'ORG_STAFF',
      orgRole: 'ADMIN',
      orgType: 'RETAIL',
      businessCategory: 'SERVICES',
      organizationId: 'org-srv-1',
      permissions: ['*'],
    };
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockCommonApi(page, srvUser);
    await page.goto(`${BUSINESS_HOST}/services`);
    await page.evaluate((u) => {
      localStorage.setItem('user', JSON.stringify(u));
      window.dispatchEvent(new Event('storage'));
    }, srvUser);
    await expect(nav).toHaveAttribute('data-theme-variant', 'business-dark');
    await expect(nav.locator('a')).toHaveText([
      'Bookings',
      'Services',
      'Schedule',
      'Clients',
      'Settings',
    ]);
    await expect(nav.getByRole('link', { name: 'Bookings' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Open and close mobile sidebar drawer, verify bottom nav remains visible
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0);
    await expect(nav).toBeVisible();

    // Navigate via bottom nav to Services (hide Next.js dev overlay badge in dev mode)
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await nav.getByRole('link', { name: 'Services' }).click();
    await expect(page).toHaveURL(/\/portal\/business\/services/);
    await expect(nav.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('Scroll into footer, resize, and multi-viewport checks (320px-430px + 844x390)', async ({
    page,
  }) => {
    await mockCommonApi(page, null);
    await page.goto(`${MAIN_HOST}/support`);

    const viewports = [
      { width: 320, height: 800 },
      { width: 360, height: 800 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 414, height: 896 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);

      const metrics = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const docOverflow = document.documentElement.scrollWidth - vw;
        const nav = document.querySelector('nav[aria-label="Primary mobile navigation"]');
        if (!nav) return { docOverflow, visible: false, minTargets: false, inVp: false, overlap: true };
        const rect = nav.getBoundingClientRect();
        const links = Array.from(nav.querySelectorAll('a'));
        const rects = links.map((a) => a.getBoundingClientRect());
        const minTargets = rects.every((r) => r.width >= 44 && r.height >= 44);
        let overlap = false;
        for (let i = 1; i < rects.length; i++) {
          if (rects[i].left < rects[i - 1].right - 1) overlap = true;
        }
        return {
          docOverflow,
          visible: getComputedStyle(nav).display !== 'none',
          inVp: rect.top >= 0 && rect.bottom <= vh + 2,
          minTargets,
          overlap,
        };
      });

      expect(metrics.docOverflow).toBeLessThanOrEqual(0);
      expect(metrics.visible).toBe(true);
      expect(metrics.inVp).toBe(true);
      expect(metrics.minTargets).toBe(true);
      expect(metrics.overlap).toBe(false);
    }
  });
});
