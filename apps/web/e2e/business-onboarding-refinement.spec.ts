import { test, expect } from '@playwright/test';

test.describe('Phase 4: Business Onboarding Refinement & Guided Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // Provide authenticated customer/partner session for onboarding
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock_verified_jwt_token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-partner-onboard-1',
          email: 'partner@jesmond.com.au',
          role: 'STUDENT',
          firstName: 'Partner',
          lastName: 'Candidate',
        }),
      );
    });
  });

  test('1. Step 1: Category selection renders all 4 commercial sectors', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    // Header & Welcome
    await expect(page.getByRole('heading', { name: /Welcome to Jesmond Business/i })).toBeVisible();
    await expect(page.getByText('partner@jesmond.com.au')).toBeVisible();
    await expect(page.getByText(/Your identity is active, but you do not yet have a registered commercial organization/i)).toBeVisible();

    // 4 Category options
    await expect(page.getByRole('button', { name: /Accommodation Provider/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Retail Merchant/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Food & Dining/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Services & Trades/i })).toBeVisible();

    // Progress bar shows step 1
    await expect(page.getByText('1. Category')).toBeVisible();
  });

  test('2. Multi-step progression through Identity, Location, and Operations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    // Select Accommodation
    await page.getByRole('button', { name: /Accommodation Provider/i }).click();
    await page.getByRole('button', { name: /Continue to Profile/i }).click();

    // Step 2: Legal & Identity
    await expect(page.getByRole('heading', { name: /Business Identity & Legal Profile/i })).toBeVisible();
    await page.locator('#org-name').fill('Jesmond Student Lodge');
    await page.locator('#phone').fill('02 4900 1234');
    await page.locator('input[type="checkbox"]').check(); // ABN exemption

    await page.getByRole('button', { name: /Continue to Location/i }).click();

    // Step 3: Location
    await expect(page.getByRole('heading', { name: /Primary Location & Operating Schedule/i })).toBeVisible();
    await page.locator('#address').fill('15 Blue Gum Road');
    await page.locator('#city').fill('Jesmond');
    await page.locator('#postcode').fill('2299');

    await page.getByRole('button', { name: /Continue to Operations/i }).click();

    // Step 4: Accommodation Operations
    await expect(page.getByRole('heading', { name: /Accommodation & Property Settings/i })).toBeVisible();
    await expect(page.locator('#portfolio-size')).toBeVisible();
    await expect(page.locator('#lease-term')).toBeVisible();

    await page.getByRole('button', { name: /Review & Submit/i }).click();

    // Step 5: Review Card
    await expect(page.getByRole('heading', { name: /Review Your Business Profile/i })).toBeVisible();
    await expect(page.getByText('Jesmond Student Lodge')).toBeVisible();
    await expect(page.getByText('15 Blue Gum Road, Jesmond NSW 2299')).toBeVisible();
    await expect(page.getByText('02 4900 1234')).toBeVisible();
    await expect(page.getByRole('button', { name: /Launch Business Dashboard/i })).toBeVisible();
  });

  test('3. Category-specific setup for Retail Merchant', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    // Select Retail
    await page.getByRole('button', { name: /Retail Merchant/i }).click();
    await page.getByRole('button', { name: /Continue to Profile/i }).click();

    // Step 2
    await page.locator('#org-name').fill('Campus Stationery & Tech');
    await page.locator('#phone').fill('02 4911 5678');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Continue to Location/i }).click();

    // Step 3
    await page.locator('#address').fill('Shop 4, Student Union');
    await page.locator('#city').fill('Callaghan');
    await page.locator('#postcode').fill('2308');
    await page.getByRole('button', { name: /Continue to Operations/i }).click();

    // Step 4: Retail Operations
    await expect(page.getByRole('heading', { name: /Retail POS & Terminal Configuration/i })).toBeVisible();
    await expect(page.locator('#branch-name')).toBeVisible();
    await expect(page.locator('#pos-label')).toBeVisible();
    await expect(page.locator('#return-policy')).toBeVisible();
  });

  test('4. Inline ABN validation error on invalid checksum', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    await page.getByRole('button', { name: /Continue to Profile/i }).click();

    // Enter invalid 11-digit ABN
    await page.locator('#abn').fill('11111111111');
    await expect(page.getByText(/Invalid Australian Business Number checksum/i)).toBeVisible();

    // Attempt to proceed with invalid ABN
    await page.locator('#org-name').fill('Test Org');
    await page.locator('#phone').fill('0400000000');
    await page.getByRole('button', { name: /Continue to Location/i }).click();

    // Should block progression with alert
    const alertBox = page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText(/valid 11-digit ABN/i);
  });

  test('5. Save and resume draft preserves form inputs across page reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    await page.getByRole('button', { name: /Food & Dining/i }).click();
    await page.getByRole('button', { name: /Continue to Profile/i }).click();

    await page.locator('#org-name').fill('Jesmond Noodle Bar');
    await page.locator('#phone').fill('02 4988 9900');

    // Reload page
    await page.reload();

    // Verify draft data persisted
    await expect(page.locator('#org-name')).toHaveValue('Jesmond Noodle Bar');
    await expect(page.locator('#phone')).toHaveValue('02 4988 9900');
  });

  test('6. Reset Draft restores initial clean state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');

    await page.getByRole('button', { name: /Continue to Profile/i }).click();
    await page.locator('#org-name').fill('Temporary Draft Corp');

    // Click Reset Draft
    await page.getByRole('button', { name: /Reset Draft/i }).click();

    // Form resets back to Step 1
    await expect(page.getByText('1. Category')).toBeVisible();
    await expect(page.getByRole('button', { name: /Accommodation Provider/i })).toBeVisible();
  });

  test('7. Responsive viewports — Desktop, Tablet, and Mobile check for zero overflow', async ({ page }) => {
    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/onboarding');
    let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Mobile (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Controls accessible in mobile
    await expect(page.getByRole('button', { name: /Accommodation Provider/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue to Profile/i })).toBeVisible();
  });

});
