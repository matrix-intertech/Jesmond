import { test, expect } from '@playwright/test';

const MAIN_HOST =
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
const BUSINESS_HOST = (() => {
  const url = new URL(MAIN_HOST);
  return `${url.protocol}//business.${url.host}`;
})();

const corsHeaders = (req: any) => ({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': req.headers()['origin'] || MAIN_HOST,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Organization-Id, Cache-Control, Pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
});

async function seedBusinessSession(page: any, user: any) {
  await page.route('**/api/auth/session', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user,
        organizationId: user.organizationId,
      }),
    });
  });
}

test.describe('Phase 4 — Public Pricing, Subscription Modal & Business Subscription Dashboard', () => {
  test('Pricing OFF hides footer link and shows pricing-unavailable notice without plan cards', async ({
    page,
  }) => {
    await page.route('**/api/v1/subscriptions/public/**', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route.request()),
        body: JSON.stringify({
          subscriptionsEnabled: false,
          checkoutEnabled: false,
          plans: [],
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${MAIN_HOST}/pricing`);
    await expect(page.getByTestId('pricing-unavailable-notice')).toBeVisible();
    await expect(page.locator('[data-testid^="pricing-plan-"]')).toHaveCount(0);
    await expect(page.locator('nav a[href="/pricing"]')).toHaveCount(0);
    await expect(
      page.locator('footer a[href="/pricing"]'),
    ).toHaveCount(0);
  });

  test('Pricing ON displays all 6 profile tabs, dynamic plans, and hides checkout when checkoutEnabled is false', async ({
    page,
  }) => {
    await page.route('**/api/v1/subscriptions/public/config', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route.request()),
        body: JSON.stringify({
          subscriptionsEnabled: true,
          checkoutEnabled: false,
        }),
      });
    });

    await page.route('**/api/v1/subscriptions/public/pricing*', async (route: any) => {
      const url = new URL(route.request().url());
      const profile = url.searchParams.get('profile') || 'ACCOMMODATION';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route.request()),
        body: JSON.stringify({
          subscriptionsEnabled: true,
          checkoutEnabled: false,
          plans: [
            {
              id: `free-${profile}`,
              profileType: profile,
              code: `${profile}_FREE`,
              name: `${profile} Free`,
              description: 'Free tier',
              tier: 'FREE',
              isFree: true,
              isEnterprise: false,
              prices: [],
              features: [
                {
                  key: 'RETAIL_BRANCHES',
                  name: 'Business Branches',
                  description: null,
                  valueType: 'NUMERIC_LIMIT',
                  enabled: true,
                  limitValue: 1,
                  unlimited: false,
                },
              ],
            },
            {
              id: `pro-${profile}`,
              profileType: profile,
              code: `${profile}_PRO`,
              name: `${profile} Pro`,
              description: 'Paid tier',
              tier: 'PRO',
              isFree: false,
              isEnterprise: false,
              prices: [
                {
                  id: 'p1',
                  interval: 'MONTHLY',
                  unitAmountMinor: 9900,
                  currency: 'AUD',
                  currencyDecimals: 2,
                  taxBehavior: 'EXCLUSIVE',
                },
              ],
              features: [
                {
                  key: 'RETAIL_BRANCHES',
                  name: 'Business Branches',
                  description: null,
                  valueType: 'NUMERIC_LIMIT',
                  enabled: true,
                  limitValue: null,
                  unlimited: true,
                },
              ],
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${MAIN_HOST}/pricing`);
    for (const label of [
      'Accommodation',
      'Retail',
      'Food',
      'Mechanics',
      'Services',
      'Rentals',
    ]) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible();
    }

    await expect(page.getByTestId('pricing-plan-ACCOMMODATION_FREE')).toBeVisible();
    await expect(page.getByTestId('pricing-plan-ACCOMMODATION_PRO')).toBeVisible();
    await expect(page.getByText('$99')).toBeVisible();
    await expect(page.getByText('(Unlimited)')).toBeVisible();

    await page.getByRole('tab', { name: 'Retail' }).click();
    await expect(page.getByTestId('pricing-plan-RETAIL_FREE')).toBeVisible();
    await expect(page.locator('footer a[href="/pricing"]')).toBeVisible();
  });

  test('Business Subscription Dashboard handles disabled state and displays usage, unlimited & Enterprise overrides', async ({
    page,
  }) => {
    const user = {
      id: 'ret-user-1',
      email: 'owner@retail.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-ret-sub',
      orgRole: 'ADMIN',
      permissions: ['*'],
    };
    await seedBusinessSession(page, user);

    let subEnabled = false;
    await page.route(/\/api\/v1\//, async (route: any) => {
      const req = route.request();
      const headers = corsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const url = req.url();
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({ ...user, user }),
        });
        return;
      }
      if (url.includes('/onboarding/dashboards/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({ status: 'COMPLETED', tutorialVersion: 1 }),
        });
        return;
      }
      if (url.includes('/subscriptions/current/entitlements')) {
        if (!subEnabled) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({ code: 'SUBSCRIPTIONS_DISABLED' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({
            organizationId: 'org-ret-sub',
            subscriptionId: 'sub-1',
            profileType: 'RETAIL',
            planId: 'plan-1',
            planCode: 'RETAIL_ENT',
            planVersion: 1,
            subscriptionStatus: 'ACTIVE',
            effectiveAccessActive: true,
            effectiveAt: new Date().toISOString(),
            graceEndsAt: null,
            snapshotId: 'snap-2',
            snapshotVersion: 2,
            entitlements: {
              RETAIL_BRANCHES: {
                featureKey: 'RETAIL_BRANCHES',
                enabled: true,
                limitValue: 5,
                currentUsage: 2,
                unlimited: false,
                source: 'PLAN',
                overrideExpiresAt: null,
              },
              RETAIL_PRODUCTS: {
                featureKey: 'RETAIL_PRODUCTS',
                enabled: true,
                limitValue: null,
                currentUsage: 140,
                unlimited: true,
                source: 'ORGANIZATION_OVERRIDE',
                overrideExpiresAt: null,
              },
            },
          }),
        });
        return;
      }
      if (url.includes('/subscriptions/current')) {
        if (!subEnabled) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({ code: 'SUBSCRIPTIONS_DISABLED' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({
            subscriptionId: 'sub-1',
            organizationId: 'org-ret-sub',
            profileType: 'RETAIL',
            status: 'ACTIVE',
            effectiveAccessActive: true,
            inGracePeriod: false,
            billingInterval: 'ANNUAL',
            source: 'ENTERPRISE_CONTRACT',
            cancelAtPeriodEnd: false,
            startsAt: '2026-01-01T00:00:00.000Z',
            currentPeriodStart: '2026-01-01T00:00:00.000Z',
            currentPeriodEnd: '2027-01-01T00:00:00.000Z',
            graceEndsAt: null,
            canceledAt: null,
            suspendedAt: null,
            plan: {
              id: 'plan-1',
              code: 'RETAIL_ENT',
              name: 'Retail Enterprise',
              tier: 'ENTERPRISE',
              planVersion: 1,
              isFree: false,
              isEnterprise: true,
            },
            snapshotId: 'snap-2',
          }),
        });
        return;
      }
      if (url.includes('/subscriptions/public/config')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({
            subscriptionsEnabled: subEnabled,
            checkoutEnabled: false,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify([]),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BUSINESS_HOST}/portal/retail/settings/subscription`);
    await expect(page.getByTestId('subscription-disabled-panel')).toBeVisible();

    subEnabled = true;
    await page.reload();
    await expect(page.getByTestId('business-subscription-panel')).toBeVisible();
    await expect(page.getByText('Retail Enterprise')).toBeVisible();
    await expect(page.getByText('2 / 5')).toBeVisible();
    await expect(page.getByText('Unlimited')).toBeVisible();
    await expect(page.getByText('Enterprise Override')).toBeVisible();

    // Simulate SUBSCRIPTION_REQUIRED event -> modal opens without logout, closes cleanly
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('jesmond:subscription-required', {
          detail: {
            statusCode: 403,
            code: 'SUBSCRIPTION_REQUIRED',
            reason: 'USAGE_LIMIT_EXCEEDED',
            profileType: 'RETAIL',
            featureKey: 'RETAIL_BRANCHES',
            pricingUrl: '/pricing?profile=retail',
          },
        }),
      );
    });

    const modal = page.getByTestId('subscription-required-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('RETAIL_BRANCHES')).toBeVisible();
    await expect(modal.getByRole('link', { name: 'View Plans' })).toHaveAttribute(
      'href',
      '/pricing?profile=retail',
    );
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId('business-subscription-panel')).toBeVisible();
  });

  test('All 6 business profiles can navigate to subscription settings without redirect', async ({
    page,
  }) => {
    const profiles = [
      {
        name: 'ACCOMMODATION',
        orgType: 'PROVIDER',
        businessCategory: 'ACCOMMODATION',
        startPath: '/portal',
        expectedSubscriptionPath: '/portal/settings/subscription',
        viaSettingsTab: true,
      },
      {
        name: 'RETAIL',
        orgType: 'RETAIL',
        businessCategory: 'RETAIL',
        startPath: '/portal/retail',
        expectedSubscriptionPath: '/portal/retail/settings/subscription',
        viaSettingsTab: true,
      },
      {
        name: 'FOOD',
        orgType: 'RETAIL',
        businessCategory: 'FOOD',
        startPath: '/food',
        expectedSubscriptionPath: '/portal/settings/subscription',
        viaSettingsTab: false,
      },
      {
        name: 'MECHANICS',
        orgType: 'RETAIL',
        businessCategory: 'MECHANICS',
        startPath: '/mechanics',
        expectedSubscriptionPath: '/portal/settings/subscription',
        viaSettingsTab: false,
      },
      {
        name: 'SERVICES',
        orgType: 'RETAIL',
        businessCategory: 'SERVICES',
        startPath: '/services',
        expectedSubscriptionPath: '/portal/settings/subscription',
        viaSettingsTab: false,
      },
      {
        name: 'RENTALS',
        orgType: 'RETAIL',
        businessCategory: 'RENTALS',
        startPath: '/rentals',
        expectedSubscriptionPath: '/portal/settings/subscription',
        viaSettingsTab: false,
      },
    ];

    for (const p of profiles) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const user = {
        id: `user-${p.name.toLowerCase()}`,
        email: `${p.name.toLowerCase()}@example.com`,
        role: 'ORG_STAFF',
        orgType: p.orgType,
        businessCategory: p.businessCategory,
        organizationId: `org-${p.name.toLowerCase()}`,
        orgRole: 'ADMIN',
        permissions: ['*'],
      };
      await seedBusinessSession(page, user);

      await page.route(/\/api\/v1\//, async (route: any) => {
        const req = route.request();
        const headers = corsHeaders(req);
        if (req.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers });
          return;
        }
        const url = req.url();
        if (url.includes('/auth/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({ ...user, user }),
          });
          return;
        }
        if (url.includes('/onboarding/dashboards/')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({ status: 'COMPLETED', tutorialVersion: 1 }),
          });
          return;
        }
        if (url.includes('/subscriptions/current/entitlements')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({
              organizationId: user.organizationId,
              profileType: p.name,
              subscriptionId: `sub-${p.name.toLowerCase()}`,
              subscriptionStatus: 'ACTIVE',
              effectiveAccessActive: true,
              inGracePeriod: false,
              entitlements: {},
            }),
          });
          return;
        }
        if (url.includes('/subscriptions/current')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers,
            body: JSON.stringify({
              subscriptionId: `sub-${p.name.toLowerCase()}`,
              organizationId: user.organizationId,
              profileType: p.name,
              status: 'ACTIVE',
              effectiveAccessActive: true,
              inGracePeriod: false,
              billingInterval: 'FREE',
              source: 'FREE_AUTO',
              cancelAtPeriodEnd: false,
              startsAt: '2026-01-01T00:00:00.000Z',
              currentPeriodStart: '2026-01-01T00:00:00.000Z',
              currentPeriodEnd: null,
              graceEndsAt: null,
              canceledAt: null,
              suspendedAt: null,
              plan: {
                id: `plan-${p.name.toLowerCase()}`,
                code: `${p.name}_FREE`,
                name: `${p.name} Free`,
                tier: 'FREE',
                planVersion: 1,
                isFree: true,
                isEnterprise: false,
              },
              snapshotId: 'snap-1',
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify([]),
        });
      });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${BUSINESS_HOST}${p.startPath}`);
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      if (p.viaSettingsTab) {
        await page.getByRole('link', { name: 'Subscription', exact: true }).click();
      }
      await expect(page).toHaveURL(new RegExp(`${p.expectedSubscriptionPath}$`));
      await expect(page.getByTestId('business-subscription-panel')).toBeVisible();
    }
  });

  test('Business subdomain & /pricing use orangish-gold theme while main site & admin stay isolated', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('hydrat')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. /pricing uses Business theme even on main host
    await page.route('**/api/v1/subscriptions/public/**', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route.request()),
        body: JSON.stringify({ subscriptionsEnabled: false, checkoutEnabled: false, plans: [] }),
      });
    });
    await page.goto(`${MAIN_HOST}/pricing`);
    await expect(page.locator('[data-theme="business"]').first()).toBeVisible();

    // 2. Main site stays on default theme (no data-theme="business" on <html>)
    await page.goto(`${MAIN_HOST}/`);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'business');

    // 3. Business subdomain sets data-theme="business" on <html> and preserves it on reload
    await seedBusinessSession(page, {
      id: 'biz-theme-user',
      email: 'owner@biz.example.com',
      role: 'ORG_STAFF',
      orgType: 'RETAIL',
      businessCategory: 'RETAIL',
      organizationId: 'org-biz-theme',
      orgRole: 'ADMIN',
      permissions: ['*'],
    });
    await page.route(/\/api\/v1\//, async (route: any) => {
      const req = route.request();
      const headers = corsHeaders(req);
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (req.url().includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({
            id: 'biz-theme-user',
            role: 'ORG_STAFF',
            orgType: 'RETAIL',
            businessCategory: 'RETAIL',
            organizationId: 'org-biz-theme',
            orgRole: 'ADMIN',
            permissions: ['*'],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify([]),
      });
    });

    await page.goto(`${BUSINESS_HOST}/portal/retail`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'business');
    await expect(page.locator('nav').getByText('BUSINESS', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'business');
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgColor).toBe('rgb(26, 16, 10)');

    // 4. Business Login & Privacy Policy on Business host show shared Jesmond BUSINESS logo (desktop & mobile)
    await page.goto(`${BUSINESS_HOST}/business/login`);
    await expect(page.locator('header').getByText('BUSINESS', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BUSINESS_HOST}/privacy`);
    await expect(page.locator('nav').getByText('BUSINESS', { exact: true })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
