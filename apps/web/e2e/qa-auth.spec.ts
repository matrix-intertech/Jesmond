import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Phase 2: Authentication & Boundaries', () => {

  test('Guest access to protected routes', async ({ page }) => {
    const protectedRoutes = ['/student', '/portal', '/admin'];
    
    for (const route of protectedRoutes) {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    }
  });

  test('Student trying to access Provider and Admin routes', async ({ page }) => {
    // Login as student
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email address').fill('student@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/student');

    // Try accessing provider
    await page.goto('http://localhost:3000/portal');
    // Depending on 403 handling, might redirect to /student or /
    await expect(page).not.toHaveURL(/.*\/portal/);
    
    // Try accessing admin
    await page.goto('http://localhost:3000/admin');
    await expect(page).not.toHaveURL(/.*\/admin/);
  });

  test('Provider trying to access Admin routes', async ({ page }) => {
    // Login as provider
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email address').fill('provider@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/portal');

    // Try accessing admin
    await page.goto('http://localhost:3000/admin');
    await expect(page).not.toHaveURL(/.*\/admin/);
  });

  test('Admin trying to access Super Admin feature flag', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('Email address').fill('admin@jesmond.demo');
    await page.getByLabel('Password').fill('Jesmond@Demo2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin');

    // The feature controls section should NOT be visible
    const featureControls = page.locator('text=Platform Controls');
    await expect(featureControls).toBeHidden();
  });
});
