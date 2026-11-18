import { test, expect } from '@playwright/test';
import { getDashboardHeading, User } from '../utils/auth';

test.describe('Dynamic Dashboard Headings & Signup Form Terminology', () => {

  test.describe('1. getDashboardHeading unit mappings for all profile types and business categories', () => {
    test('resolves Student -> Student Dashboard', () => {
      const user: Partial<User> = { role: 'STUDENT' };
      expect(getDashboardHeading(user)).toBe('Student Dashboard');
    });

    test('resolves Parent -> Parent Dashboard', () => {
      const user: Partial<User> = { role: 'PARENT' };
      expect(getDashboardHeading(user)).toBe('Parent Dashboard');
    });

    test('resolves Service Provider -> Service Provider Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'PROVIDER',
      };
      expect(getDashboardHeading(user)).toBe('Service Provider Dashboard');
    });

    test('resolves Mechanics -> Mechanics Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'MECHANICS',
      };
      expect(getDashboardHeading(user)).toBe('Mechanics Dashboard');
    });

    test('resolves Services -> Services / Tradies Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'SERVICES',
      };
      expect(getDashboardHeading(user)).toBe('Services / Tradies Dashboard');
    });

    test('resolves Retail -> Retail Business Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'RETAIL',
      };
      expect(getDashboardHeading(user)).toBe('Retail Business Dashboard');
    });

    test('resolves Food -> Food Business Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'RETAIL',
        businessCategory: 'FOOD',
      };
      expect(getDashboardHeading(user)).toBe('Food Business Dashboard');
    });

    test('resolves Agency -> Agency Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'AGENCY',
      };
      expect(getDashboardHeading(user)).toBe('Agency Dashboard');
    });

    test('resolves University -> University Dashboard', () => {
      const user: Partial<User> = {
        role: 'ORG_STAFF',
        orgType: 'UNIVERSITY',
      };
      expect(getDashboardHeading(user)).toBe('University Dashboard');
    });

    test('resolves Admin -> Admin Dashboard', () => {
      const user: Partial<User> = { role: 'ADMIN' };
      expect(getDashboardHeading(user)).toBe('Admin Dashboard');
    });

    test('resolves Super Admin -> Super Admin Dashboard', () => {
      const user: Partial<User> = { role: 'SUPER_ADMIN' };
      expect(getDashboardHeading(user)).toBe('Super Admin Dashboard');
    });

    test('resolves category-only fallback when orgType is omitted', () => {
      expect(getDashboardHeading({ role: 'ORG_STAFF', businessCategory: 'MECHANICS' })).toBe('Mechanics Dashboard');
      expect(getDashboardHeading({ role: 'ORG_STAFF', businessCategory: 'SERVICES' })).toBe('Services / Tradies Dashboard');
      expect(getDashboardHeading({ role: 'ORG_STAFF', businessCategory: 'FOOD' })).toBe('Food Business Dashboard');
      expect(getDashboardHeading({ role: 'ORG_STAFF', businessCategory: 'RETAIL' })).toBe('Retail Business Dashboard');
    });

    test('resolves safe fallback for ORG_STAFF without org context', () => {
      expect(getDashboardHeading({ role: 'ORG_STAFF' })).toBe('Service Provider Dashboard');
    });

    test('resolves safe fallback for null, undefined, or empty user', () => {
      expect(getDashboardHeading(null)).toBe('Dashboard');
      expect(getDashboardHeading(undefined)).toBe('Dashboard');
      expect(getDashboardHeading({})).toBe('Dashboard');
    });
  });

  test.describe('2. Browser E2E Rendering of Dynamic Dashboard Headings', () => {
    const setupAuthSession = async (page: any, user: any, token = 'mock-valid-jwt.eyJzdWIiOiJ1c2VyLTEifQ.sig') => {
      const corsHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      };

      await page.route(/\/api\/v1\//, async (route: any) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }

        const url = route.request().url();
        if (url.includes('/auth/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: corsHeaders,
            body: JSON.stringify({
              ...user,
              user,
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify([]),
        });
      });

      await page.addInitScript(({ tokenVal, userVal }: { tokenVal: string; userVal: any }) => {
        window.localStorage.setItem('token', tokenVal);
        window.localStorage.setItem('access_token', tokenVal);
        window.localStorage.setItem('user', JSON.stringify(userVal));
      }, { tokenVal: token, userVal: user });
    };

    test('Student sees "Student Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-std', role: 'STUDENT', email: 'std@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/student');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Student Dashboard');
    });

    test('Admin sees "Admin Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-adm', role: 'ADMIN', email: 'adm@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/admin');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Admin Dashboard');
    });

    test('Super Admin sees "Super Admin Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-sadm', role: 'SUPER_ADMIN', email: 'sadm@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/admin');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Super Admin Dashboard');
    });

    test('Service Provider sees "Service Provider Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-prov', role: 'ORG_STAFF', orgType: 'PROVIDER', email: 'prov@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Service Provider Dashboard');
    });

    test('Mechanics sees "Mechanics Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-mech', role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'MECHANICS', email: 'mech@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal/business/appointments');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Mechanics Dashboard');
    });

    test('Services sees "Services / Tradies Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-serv', role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'SERVICES', email: 'serv@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal/business/appointments');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Services / Tradies Dashboard');
    });

    test('Retail sees "Retail Business Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-ret', role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'RETAIL', email: 'ret@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal/retail');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Retail Business Dashboard');
    });

    test('Food sees "Food Business Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-food', role: 'ORG_STAFF', orgType: 'RETAIL', businessCategory: 'FOOD', email: 'food@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal/business/orders');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Food Business Dashboard');
    });

    test('Agency sees "Agency Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-ag', role: 'ORG_STAFF', orgType: 'AGENCY', email: 'ag@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('Agency Dashboard');
    });

    test('University sees "University Dashboard" in top header', async ({ page }) => {
      const user = { id: 'u-uni', role: 'ORG_STAFF', orgType: 'UNIVERSITY', email: 'uni@jesmond.demo' };
      await setupAuthSession(page, user);
      await page.goto('/portal');
      await expect(page.locator('[data-testid="dashboard-header-title"]')).toHaveText('University Dashboard');
    });
  });

  test.describe('3. Signup Form Terminology: Services / Tradies Browser Verification', () => {
    test('renders "Services / Tradies" option when selecting Business account type', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 10000 });

      // Click "Business" account type selector
      await page.getByRole('button', { name: 'Business' }).click();

      // Business category select should now be visible
      const categorySelect = page.locator('#business-category');
      await expect(categorySelect).toBeVisible();

      // Check the options within the select
      const servicesOption = categorySelect.locator('option[value="SERVICES"]');
      await expect(servicesOption).toBeAttached();
      await expect(servicesOption).toHaveText('Services / Tradies');

      // Verify selecting Services / Tradies updates the select value to SERVICES
      await categorySelect.selectOption('SERVICES');
      await expect(categorySelect).toHaveValue('SERVICES');

      // Verify other options remain intact
      await expect(categorySelect.locator('option[value="RETAIL"]')).toHaveText('Retail');
      await expect(categorySelect.locator('option[value="FOOD"]')).toHaveText('Food');
      await expect(categorySelect.locator('option[value="MECHANICS"]')).toHaveText('Mechanics');
      await expect(categorySelect.locator('option[value="RENTALS"]')).toHaveText('Rentals');
    });
  });
});
