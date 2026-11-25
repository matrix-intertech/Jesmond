import { test, expect } from '@playwright/test';

test.describe('Phase 2 — Business Portal Frontend & Subdomain Routing', () => {
  test('should render dedicated Business Login page on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/login');

    // Title and Enterprise Badge
    await expect(page).toHaveTitle(/Business Portal/);
    await expect(page.getByRole('heading', { name: /Manage your enterprise on Jesmond/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Everything Your Business Needs\. One Connected Platform\./i })).toBeVisible();
    await expect(page.getByText('Sign in to Business Portal')).toBeVisible();

    // Six Business Categories & Vehicle Rentals vs Property Rentals distinction
    await expect(page.getByText('Mechanics & Automotive')).toBeVisible();
    await expect(page.getByText('Services & Tradies')).toBeVisible();
    await expect(page.getByText('Rentals & Vehicle Hire')).toBeVisible();
    await expect(page.getByText(/Manage vehicle rental listings, fleet availability/i)).toBeVisible();
    await expect(page.getByText('Accommodation & Hospitality')).toBeVisible();
    await expect(page.getByText(/Property rentals and leasing/i)).toBeVisible();
    await expect(page.getByText('Retail & Point of Sale')).toBeVisible();
    await expect(page.getByText('Restaurants & Food Services')).toBeVisible();

    // Inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In to Dashboard/i })).toBeVisible();

    // SSO and Customer Portal links
    await expect(page.getByRole('button', { name: /Single Sign-On/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Register your organization/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Forgot password/i })).toBeVisible();
  });

  test('should render dedicated Business Login page on mobile (responsive)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/business/login');

    await expect(page.getByText('Sign in to Business Portal')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In to Dashboard/i })).toBeVisible();
  });

  test('should render Business Registration page with business categories', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/business/register');

    await expect(page.getByText('Register Your Business on Jesmond')).toBeVisible();

    // Category selectors
    await expect(page.getByRole('button', { name: /Accommodation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Retail Store/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Food & Dining/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Services & Trades/i })).toBeVisible();

    // Required Business Type dropdown with exact 5 options and RENTALS mapping
    const businessTypeSelect = page.getByLabel('Business Type');
    await expect(businessTypeSelect).toBeVisible();
    await expect(businessTypeSelect).toHaveAttribute('required', '');
    const optionValues = await businessTypeSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ text: o.textContent?.trim(), value: (o as HTMLOptionElement).value })),
    );
    expect(optionValues).toEqual([
      { text: 'Retail', value: 'RETAIL' },
      { text: 'Food', value: 'FOOD' },
      { text: 'Mechanics', value: 'MECHANICS' },
      { text: 'Services', value: 'SERVICES' },
      { text: 'Rentals', value: 'RENTALS' },
    ]);
    await businessTypeSelect.selectOption('RENTALS');
    await expect(businessTypeSelect).toHaveValue('RENTALS');

    // Form inputs
    await expect(page.locator('input[placeholder*="Trading Name"], input[placeholder*="Matrix Cafe"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Jane Smith"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Business Account/i })).toBeVisible();
  });

  test('should render Business Password Reset page', async ({ page }) => {
    await page.goto('/business/forgot-password');

    await expect(page.getByText('Reset Business Password')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Reset Code/i })).toBeVisible();
  });

  test('should render Business Verification page with OTP input', async ({ page }) => {
    await page.goto('/business/verify?email=partner%40business.com');

    await expect(page.getByText('Verify Business Account')).toBeVisible();
    await expect(page.getByText('partner@business.com')).toBeVisible();
    await expect(page.locator('input[placeholder="123456"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Complete Verification/i })).toBeVisible();
  });

  test('should render Business Onboarding page when user lacks organization access', async ({ page }) => {
    // Set authenticated user without org role in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock_jwt_customer_token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-student-1',
          email: 'student@jesmond.com.au',
          role: 'STUDENT',
          firstName: 'Student',
          lastName: 'User',
        }),
      );
    });

    await page.goto('/business/onboarding');

    await expect(page.getByText('Welcome to Jesmond Business')).toBeVisible();
    await expect(page.getByText('student@jesmond.com.au')).toBeVisible();
    await expect(page.getByText('Your identity is active, but you do not yet have a registered commercial organization')).toBeVisible();
    await expect(page.locator('input[placeholder*="Trading Name"], input[placeholder*="Matrix Store"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Launch Business Dashboard/i })).toBeVisible();
  });

  test('should handle SSO callback error gracefully when code or state is missing', async ({ page }) => {
    await page.goto('/auth/callback');

    await expect(page.getByText('Authentication Failed')).toBeVisible();
    await expect(page.getByText('Missing authorization code or state parameter in callback URL.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to Business Sign In/i })).toBeVisible();
  });

  test('should enforce zero localStorage token storage on business portal domain', async ({ page }) => {
    await page.goto('/business/login');

    // Verify localStorage has no access_token or token keys
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(accessToken).toBeNull();
    expect(token).toBeNull();

    // Verify sessionStorage has no tokens
    const sessionToken = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(sessionToken).toBeNull();
  });

  const viewports = [
    { name: 'mobile-440x956', width: 440, height: 956 },
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'mobile-375x812', width: 375, height: 812 },
    { name: 'desktop-1440x900', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`Business Portal layout has no bottom white strip, no public mobile nav, and zero overflow at ${vp.width}x${vp.height}`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3005';
      const parsed = new URL(baseUrl);
      const businessLoginUrl = `${parsed.protocol}//business.${parsed.host}/login`;

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(businessLoginUrl);

      await expect(page.getByText('Sign in to Business Portal')).toBeVisible();

      // Public mobile bottom nav must NOT be rendered/visible on Business Portal
      await expect(page.locator('nav[aria-label="Primary mobile navigation"]')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Guide' })).toHaveCount(0);

      // No horizontal overflow
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasOverflow).toBe(false);

      // Root background must be dark brown (#1A100A -> rgb(26, 16, 10)), not white/light
      const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bodyBg).toBe('rgb(26, 16, 10)');

      // Footer must be accessible and flush with bottom of document (no 92px white gap)
      const footer = page.locator('footer');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();
      const gapBelowFooter = await page.evaluate(() => {
        const f = document.querySelector('footer');
        if (!f) return -1;
        const rect = f.getBoundingClientRect();
        const docBottom = Math.max(document.documentElement.scrollHeight, window.innerHeight);
        const footerBottomInDoc = rect.bottom + window.scrollY;
        return Math.round(docBottom - footerBottomInDoc);
      });
      expect(gapBelowFooter).toBeLessThanOrEqual(2);

      // Capture screenshot for visual verification
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.screenshot({
        path: `C:/Users/Shikhar/.gemini/antigravity/brain/3dc3351f-37ff-48b7-98d1-a24657b912b1/screenshots/business-mobile-fix/${vp.name}.png`,
        fullPage: false,
      });

      expect(consoleErrors).toEqual([]);
    });
  }

  test('Main public website still renders mobile bottom navigation at 440x956', async ({ page }) => {
    await page.setViewportSize({ width: 440, height: 956 });
    await page.goto('/');

    const mobileNav = page.locator('nav[aria-label="Primary mobile navigation"]');
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Businesses' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Guide' })).toBeVisible();
  });
});

