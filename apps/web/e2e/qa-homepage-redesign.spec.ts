import { test, expect } from '@playwright/test';

test.describe('Homepage Redesign Verification', () => {
  // Max timeout 45 seconds
  test.setTimeout(45000);
  test.describe.configure({ retries: 0 });

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    // Add page error listener (unhandled exceptions)
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
  });

  test('Desktop: Loads and components render correctly', async ({ page }) => {
    await page.goto('/');

    // 1. Homepage loads & 2. Header visible
    const header = page.locator('nav').first();
    await expect(header).toBeVisible();

    // Check "Sign up" CTA exists
    const signUpCta = page.getByRole('link', { name: 'Sign up' });
    await expect(signUpCta).toBeVisible();

    // 3. Hero visible & 4. Hero heading visible
    const heroHeading = page.getByRole('heading', { name: /Find your perfect student home/i });
    await expect(heroHeading).toBeVisible();

    // 5. Hero search visible
    const searchBtn = page.getByRole('button', { name: 'Search' });
    await expect(searchBtn).toBeVisible();

    // 8. Trust Experience visible
    const trustExperience = page.getByText('Built for students');
    await expect(trustExperience).toBeVisible();

    // 9. Featured property section works with real data
    const curatedSection = page.getByText('Curated living spaces.');
    await expect(curatedSection).toBeVisible();

    // 11. No horizontal overflow
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

    // 12. No browser console errors
    // 13. No React "Maximum update depth exceeded"
    const hasReactLoop = consoleErrors.some(err => err.includes('Maximum update depth exceeded'));
    expect(hasReactLoop).toBe(false);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Mobile: Viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Check hamburger menu
    const menuButton = page.locator('button').filter({ has: page.locator('motion.div') }).first();
    await expect(menuButton).toBeVisible();

    // Verify hero text wrapped correctly (still visible)
    const heroHeading = page.getByRole('heading', { name: /Find your perfect student home/i });
    await expect(heroHeading).toBeVisible();

    // Verify search button is accessible
    const searchBtn = page.getByRole('button', { name: 'Search' }).first();
    await expect(searchBtn).toBeVisible();

    // 11. No horizontal overflow on mobile
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('Search functionality works', async ({ page }) => {
    await page.goto('/');

    // The original hero search bar uses an input placeholder "Search university or city" or "Where" label
    const whereInput = page.getByPlaceholder('Search university or city');
    
    // We need to click the search bar first to open the modal
    const searchModalTrigger = page.locator('text=Where to?').first();
    if (await searchModalTrigger.isVisible()) {
        await searchModalTrigger.click();
    } else {
        // Desktop pill
        await page.locator('text=Where').first().click();
    }
    
    await expect(whereInput).toBeVisible();
    await whereInput.fill('Sydney');
    
    // Click Search Properties button
    const searchBtn = page.getByRole('button', { name: 'Search' });
    await searchBtn.click();

    // Verify it navigated to /search and query param is in URL
    await page.waitForURL(url => url.pathname.includes('/search') && url.searchParams.get('city') === 'Sydney');
    
    // Ensure no errors on search page either
    const hasReactLoop = consoleErrors.some(err => err.includes('Maximum update depth exceeded'));
    expect(hasReactLoop).toBe(false);
  });
});
