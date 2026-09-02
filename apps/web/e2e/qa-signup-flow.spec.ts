import { test, expect } from '@playwright/test';

// Use deterministic timestamps to avoid collisions in parallel/repeated runs
const timestamp = Date.now();
const NEW_EMAIL = `new-qa-user-${timestamp}@jesmond.demo`;
const EXISTING_UNVERIFIED_EMAIL = `unverified-qa-user-${timestamp}@jesmond.demo`;
const EXISTING_VERIFIED_EMAIL = `verified-qa-user-${timestamp}@jesmond.demo`;

test.describe('Signup & Email OTP UI Verification', () => {

  test.beforeAll(async ({ request }) => {
    // We could potentially prepare the DB via API calls here
    // But since the API E2E tests already cover the backend thoroughly,
    // we will set up the initial state via the UI.
  });

  test.beforeEach(async ({ page }) => {
    // Log console errors to debug
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`PAGE LOG: ${msg.text()}`);
      }
    });
    page.on('pageerror', error => {
      console.log(`PAGE ERROR: ${error.message}`);
    });

    // Mock Turnstile using init script before hydration
    await page.addInitScript(() => {
      // @ts-ignore
      window.turnstile = {
        // @ts-ignore
        render: function(container, options) {
          // @ts-ignore
          // setTimeout(() => { if (options.callback) options.callback('dummy-test-token') }, 100);
          // Deliberately NOT calling callback to simulate Turnstile being absent/optional
          return 'widget-id';
        },
        remove: function() {},
        reset: function() {}
      };
    });
  });

  test('1. BRAND NEW EMAIL: Signup succeeds and shows OTP screen', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15000 });

    // Fill the form
    await page.locator('#first-name').fill('New');
    await page.locator('#last-name').fill('User');
    await page.locator('#email-address').fill(NEW_EMAIL);
    await page.locator('#password').fill('Jesmond@Demo2026!');
    
    // Submit
    await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
    await page.getByRole('button', { name: 'Create account' }).click();

    // Verify UI transitions to OTP screen without error
    await expect(page.getByText('Email already in use')).toBeHidden();
    
    // Should see Verify your email
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#otp')).toBeVisible();
    await expect(page.getByText(`We've sent a 6-digit code to`)).toBeVisible();
    await expect(page.getByText(NEW_EMAIL)).toBeVisible();
  });

  test('2. EXISTING UNVERIFIED EMAIL: Signup succeeds and updates state idempotently', async ({ page }) => {
    // Setup: Create the unverified user first
    await page.goto('http://localhost:3000/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15000 });
    await page.locator('#first-name').fill('Unverified');
    await page.locator('#last-name').fill('User1');
    await page.locator('#email-address').fill(EXISTING_UNVERIFIED_EMAIL);
    await page.locator('#password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible({ timeout: 10000 });
    
    // Now simulate user leaving and coming back later to sign up again
    await page.goto('http://localhost:3000/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15000 });
    await page.locator('#first-name').fill('Unverified Updated');
    await page.locator('#last-name').fill('User2');
    await page.locator('#email-address').fill(EXISTING_UNVERIFIED_EMAIL);
    await page.locator('#password').fill('Jesmond@Demo2026!');
    
    // Submit again
    await page.getByRole('button', { name: 'Create account' }).click();

    // It MUST NOT show "Email already in use"
    await expect(page.getByText('Email already in use')).toBeHidden({ timeout: 5000 });

    // It MUST progress to the OTP screen again
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#otp')).toBeVisible();
  });

  test('3. EXISTING VERIFIED EMAIL: Signup blocked and shows error', async ({ page }) => {
    // Setup: We don't have DB access, but we can try to use a known verified QA user from the seed script.
    // The QA seed typically has student@jesmond.demo verified. Let's use that.
    await page.goto('http://localhost:3000/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15000 });
    
    await page.locator('#first-name').fill('Hacker');
    await page.locator('#last-name').fill('Man');
    await page.locator('#email-address').fill('student@jesmond.demo');
    await page.locator('#password').fill('Jesmond@Demo2026!');
    
    // Submit
    await page.getByRole('button', { name: 'Create account' }).click();

    // It MUST show the conflict error
    await expect(page.getByText('Email already in use', { exact: false })).toBeVisible({ timeout: 10000 });
    
    // MUST NOT transition to OTP screen
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeHidden();
  });

  test('4. BASIC OTP UI: Validation and incorrect OTP handling', async ({ page }) => {
    const TEMP_EMAIL = `otp-test-${Date.now()}@jesmond.demo`;

    // Setup: go to OTP screen
    await page.goto('http://localhost:3000/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15000 });
    await page.locator('#first-name').fill('OTP');
    await page.locator('#last-name').fill('Test');
    await page.locator('#email-address').fill(TEMP_EMAIL);
    await page.locator('#password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible({ timeout: 10000 });

    // Enter wrong OTP
    const otpInput = page.locator('#otp');
    await otpInput.fill('000000');
    
    await page.getByRole('button', { name: 'Verify Email' }).click();

    // Verify error message for invalid OTP
    await expect(page.getByText('Invalid verification code')).toBeVisible({ timeout: 10000 });
    
    // Verify it didn't redirect us to dashboard (still on verification screen)
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  });

});
