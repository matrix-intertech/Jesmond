import { test, expect } from '@playwright/test';

const MAIN_HOST =
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';

const SAMPLE_STORES = [
  {
    id: 'store-1',
    name: 'Jesmond Espresso Bar',
    deliveryEnabled: true,
    takeawayEnabled: true,
    address: '12 Blue Gum Rd, Jesmond NSW',
    phone: '0412 111 222',
    organization: { name: 'Jesmond Espresso Bar', businessCategory: 'FOOD' },
  },
  {
    id: 'store-2',
    name: 'Callaghan Auto Care',
    deliveryEnabled: false,
    takeawayEnabled: false,
    address: '45 University Dr, Callaghan NSW',
    phone: '0412 333 444',
    organization: { name: 'Callaghan Auto Care', businessCategory: 'MECHANICS' },
  },
  {
    id: 'store-3',
    name: 'Campus Tech Retail',
    deliveryEnabled: true,
    takeawayEnabled: true,
    address: '88 Mordue Parade, Jesmond NSW',
    phone: '0412 555 666',
    organization: { name: 'Campus Tech Retail', businessCategory: 'RETAIL' },
  },
];

test.describe('Public Business Directory (/businesses)', () => {
  test('1 & 6. Loads businesses cleanly and keeps count consistent with listing', async ({ page }) => {
    await page.route('**/api/v1/retail/marketplace/stores*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: SAMPLE_STORES,
          meta: { total: SAMPLE_STORES.length, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    await page.goto(`${MAIN_HOST}/businesses`);
    // Trigger client fetch via filter interaction (since initial SSR has no backend in mocked mode)
    await page.getByRole('button', { name: 'Food & Dining' }).click();

    await expect(page.getByTestId('businesses-results-count')).toHaveText('3 businesses found');
    await expect(page.getByText('Jesmond Espresso Bar')).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });

  test('2 & 3. Shows error without misleading count on API failure and recovers on Retry', async ({ page }) => {
    let shouldFail = true;
    await page.route('**/api/v1/retail/marketplace/stores*', async (route) => {
      if (shouldFail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: SAMPLE_STORES,
          meta: { total: SAMPLE_STORES.length, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    await page.goto(`${MAIN_HOST}/businesses`);
    await page.getByRole('button', { name: 'Retail' }).click();

    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page.getByText('Failed to load businesses. Please try again.')).toBeVisible();
    await expect(page.getByTestId('businesses-results-count')).toHaveText('Unable to load businesses');
    await expect(page.getByTestId('businesses-results-count')).not.toContainText('businesses found');

    shouldFail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('businesses-results-count')).toHaveText('3 businesses found');
    await expect(page.getByText('Campus Tech Retail')).toBeVisible();
  });

  test('4. Displays empty state accurately when zero businesses match', async ({ page }) => {
    await page.route('**/api/v1/retail/marketplace/stores*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto(`${MAIN_HOST}/businesses`);
    await page.getByRole('button', { name: 'Services' }).click();

    await expect(page.getByTestId('businesses-results-count')).toHaveText('0 businesses found');
    await expect(page.getByText('No businesses available')).toBeVisible();
  });

  test('5. Search and filter combinations send expected query parameters', async ({ page }) => {
    const requestedUrls: string[] = [];
    await page.route('**/api/v1/retail/marketplace/stores*', async (route) => {
      requestedUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [SAMPLE_STORES[0]],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    await page.goto(`${MAIN_HOST}/businesses`);
    await page.getByRole('button', { name: 'Food & Dining' }).click();
    await page.locator('#suburb-filter').selectOption('Jesmond');
    await page.getByRole('button', { name: 'Verified only' }).click();
    await page.getByRole('button', { name: 'Open now' }).click();
    await page.locator('#business-search').fill('Espresso');

    await expect(page.getByTestId('businesses-results-count')).toHaveText(
      '1 business found for "Espresso"',
    );

    const lastUrl = new URL(requestedUrls[requestedUrls.length - 1]);
    expect(lastUrl.searchParams.get('category')).toBe('FOOD');
    expect(lastUrl.searchParams.get('suburb')).toBe('Jesmond');
    expect(lastUrl.searchParams.get('verifiedOnly')).toBe('true');
    expect(lastUrl.searchParams.get('openNow')).toBe('true');
    expect(lastUrl.searchParams.get('q')).toBe('Espresso');
  });

  test('7. Mobile layout has no horizontal overflow at 360x800', async ({ page }) => {
    await page.route('**/api/v1/retail/marketplace/stores*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: SAMPLE_STORES,
          meta: { total: SAMPLE_STORES.length, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${MAIN_HOST}/businesses`);
    await page.getByRole('button', { name: 'Food & Dining' }).click();
    await expect(page.getByText('Jesmond Espresso Bar')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
