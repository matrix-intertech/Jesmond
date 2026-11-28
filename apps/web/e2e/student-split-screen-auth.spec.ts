import { test, expect } from '@playwright/test';

test.describe('Phase 3: Student Portal Split-Screen Authentication & Business Switching', () => {

  test.beforeEach(async ({ page }) => {
    // Listen for uncaught page errors and console errors
    page.on('pageerror', (err) => {
      console.error(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
  });

  test('1. Split-screen layout displays student portal on left and business portal on right (Desktop)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // --- Left Panel: Student / Customer ---
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Customer Account')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /forgot your password\?/i })).toBeVisible();

    // Mode Switcher Tabs
    await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Create Account' })).toBeVisible();

    // --- Right Panel: Business Owners & Hosts ---
    await expect(page.getByRole('heading', { name: /manage your enterprise on jesmond/i })).toBeVisible();
    await expect(page.getByText('Commercial & Partner Portal')).toBeVisible();
    await expect(page.getByText('Property & Accommodation Hosting')).toBeVisible();
    await expect(page.getByText('Retail POS & Live Inventory')).toBeVisible();
    await expect(page.getByText('Food & Dining Operations')).toBeVisible();
    await expect(page.getByText('Appointments & Bookings')).toBeVisible();
    await expect(page.getByText('business.jesmond.com.au')).toBeVisible();

    // CTA Button "Continue as Business"
    const businessCta = page.getByRole('link', { name: /continue as business/i });
    await expect(businessCta).toBeVisible();
    await expect(businessCta).toHaveAttribute('target', '_blank');
    await expect(businessCta).toHaveAttribute('rel', 'noopener noreferrer');
    const href = await businessCta.getAttribute('href');
    expect(href).toMatch(/(business\.jesmond\.com\.au|business\.localhost)/);

    // New partner registration link
    const partnerRegLink = page.getByRole('link', { name: /new partner\? register your business/i });
    await expect(partnerRegLink).toBeVisible();
    await expect(partnerRegLink).toHaveAttribute('target', '_blank');
    await expect(partnerRegLink).toHaveAttribute('rel', 'noopener noreferrer');

    // No uncaught console errors
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('2. Mode switching to Create Account displays student registration fields and identity switching', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Click Create Account tab
    await page.getByRole('tab', { name: 'Create Account' }).click();

    // Verify registration heading and inputs
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.locator('#first-name')).toBeVisible();
    await expect(page.locator('#last-name')).toBeVisible();
    await expect(page.locator('#email-address')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#date-of-birth')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

    // Switch back to Sign In
    await page.getByRole('tab', { name: 'Sign In' }).click();
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible();
  });

  test('3. Forgot password mode switches and displays OTP reset request', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Click "Forgot your password?"
    await page.getByRole('button', { name: /forgot your password\?/i }).click();

    await expect(page.getByRole('heading', { name: /forgot your password\?/i })).toBeVisible();
    await expect(page.locator('#forgot-email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send otp/i })).toBeVisible();

    // Back to sign in
    await page.getByRole('button', { name: /back to sign in/i }).click();
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible();
  });

  test('4. Direct navigation to /register renders registration view with business panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.locator('#first-name')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /manage your enterprise on jesmond/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /continue as business/i })).toBeVisible();
  });

  test('5. OTP verification view renders properly for email confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login?verify=true&email=student%40jesmond.demo', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
    await expect(page.getByText('student@jesmond.demo')).toBeVisible();
    await expect(page.locator('#otp')).toBeVisible();
    await expect(page.getByRole('button', { name: /verify email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /resend code/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /return to login/i })).toBeVisible();
  });

  test('6. Form validation and error states: registration validation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Switch to register
    await page.getByRole('tab', { name: 'Create Account' }).click();

    // Fill first name, last name, email, short password (< 8 chars)
    await page.locator('#first-name').fill('Test');
    await page.locator('#last-name').fill('Student');
    await page.locator('#email-address').fill('valid-email@example.com');
    await page.locator('#password').fill('short');

    // Click submit
    await page.getByRole('button', { name: /create account/i }).click();

    // Error alert should be visible
    const alertBox = page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText(/password must be at least 8 characters/i);

    // Now enter 8 chars password but mismatching confirm password
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirm-password').fill('Mismatching123!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(alertBox).toContainText(/passwords do not match/i);
  });

  test('7. Form validation and error states: invalid login shows error', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.locator('#email-address').fill('nonexistent-student-user-9999@jesmond.demo');
    await page.locator('#password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should display error alert
    const alertBox = page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alertBox).toBeVisible({ timeout: 10000 });
  });

  test('8. Responsive E2E — Desktop (1280x800): No horizontal overflow, forms accessible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify left and right panels are both visible
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /manage your enterprise on jesmond/i })).toBeVisible();

    // Verify interactive controls are unclipped and clickable
    await expect(page.getByLabel('Email address')).toBeEditable();
    await expect(page.getByLabel('Password')).toBeEditable();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
    await expect(page.getByRole('link', { name: /continue as business/i })).toBeVisible();
  });

  test('9. Responsive E2E — Tablet (768x1024): No horizontal overflow, unclipped layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify form elements are accessible
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Business section is present and accessible
    const businessSection = page.getByRole('heading', { name: /manage your enterprise on jesmond/i });
    await expect(businessSection).toBeVisible();
    await expect(page.getByRole('link', { name: /continue as business/i })).toBeVisible();
  });

  test('10. Responsive E2E — Mobile (375x812): No horizontal overflow, stacked controls accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Student form renders cleanly on top
    await expect(page.getByRole('heading', { name: /sign in to jesmond/i })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Switch to register in mobile view
    await page.getByRole('tab', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.locator('#first-name')).toBeVisible();
    await expect(page.locator('#last-name')).toBeVisible();

    // Re-verify no horizontal overflow in register mode
    const hasHorizontalScrollRegister = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScrollRegister).toBe(false);

    // Scroll to see the business portal card below
    const businessHeading = page.getByRole('heading', { name: /manage your enterprise on jesmond/i });
    await businessHeading.scrollIntoViewIfNeeded();
    await expect(businessHeading).toBeVisible();
    await expect(page.getByRole('link', { name: /continue as business/i })).toBeVisible();
  });

});
