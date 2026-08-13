// Revised Playwright test: verify response role and assert correct redirect
import { test, expect, Page } from '@playwright/test';

async function loginAndAssert(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);

  // Capture login API response
  const [response] = await Promise.all([
    page.waitForResponse((resp: any) => resp.url().includes('/api/v1/auth/login')),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const role = data.user.role as string;

  // Wait for navigation to a new path
  await page.waitForURL((url: any) => url.pathname !== '/login', { timeout: 30000 });

  // Determine expected path based on role
  const expectedPath = role === 'SUPER_ADMIN' || role === 'ADMIN' ? '/admin'
    : role === 'ORG_STAFF' ? '/portal'
    : role === 'STUDENT' ? '/student'
    : '/';

  await expect(page).toHaveURL(new RegExp(expectedPath));
}

test.describe('Jesmond Marketplace Role-based Login Tests', () => {
  test('Super Admin login', async ({ page }) => {
    await loginAndAssert(page, 'superadmin@jesmond.demo', 'Jesmond@Demo2026!');
  });

  test('Admin login', async ({ page }) => {
    await loginAndAssert(page, 'admin@jesmond.demo', 'Jesmond@Demo2026!');
  });

  test('Provider login', async ({ page }) => {
    await loginAndAssert(page, 'provider@jesmond.demo', 'Jesmond@Demo2026!');
  });

  test('Student login', async ({ page }) => {
    await loginAndAssert(page, 'student@jesmond.demo', 'Jesmond@Demo2026!');
  });
});
