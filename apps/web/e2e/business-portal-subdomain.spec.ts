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
});

