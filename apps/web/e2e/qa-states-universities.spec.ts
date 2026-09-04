import { test, expect } from '@playwright/test';

test.describe('States and Universities End-to-End Tests', () => {
  test('Navbar links navigate to /states and /universities and render backend data', async ({ page, isMobile }) => {
    // 1. Start at homepage
    await page.goto('/');

    const mainContent = page.locator('main');

    // 2. Click "States" from navbar
    if (isMobile) {
      const menuButton = page.getByLabel('Toggle Navigation Menu');
      await menuButton.click();
      await page.locator('a[href="/states"]').filter({ hasText: 'States' }).locator('visible=true').click();
    } else {
      const statesNav = page.locator('nav a[href="/states"]').filter({ hasText: 'States' }).locator('visible=true');
      await statesNav.click();
    }

    // Verify URL and heading
    await expect(page).toHaveURL(/\/states/);
    await expect(page.getByRole('heading', { name: 'Explore Australian States' })).toBeVisible();

    // Verify backend data loaded (state cards present)
    await expect(mainContent.getByRole('heading', { name: 'New South Wales' })).toBeVisible();
    await expect(mainContent.getByRole('heading', { name: 'Victoria' })).toBeVisible();

    // 3. Direct page reload on /states
    await page.reload();
    await expect(mainContent.getByRole('heading', { name: 'New South Wales' })).toBeVisible();

    // 4. Click "Universities" from navbar
    if (isMobile) {
      const menuButton = page.getByLabel('Toggle Navigation Menu');
      await menuButton.click();
      await page.locator('a[href="/universities"]').filter({ hasText: 'Universities' }).locator('visible=true').click();
    } else {
      const uniNav = page.locator('nav a[href="/universities"]').filter({ hasText: 'Universities' }).locator('visible=true');
      await uniNav.click();
    }

    // Verify URL and heading
    await expect(page).toHaveURL(/\/universities/);
    await expect(page.getByRole('heading', { name: 'Find your university in Australia' })).toBeVisible();

    // Verify backend data loaded (university cards present in main)
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();
    await expect(mainContent.getByRole('heading', { name: 'University of Melbourne' })).toBeVisible();

    // 5. Direct page reload on /universities
    await page.reload();
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();
  });

  test('Browser back and forward navigation works correctly', async ({ page }) => {
    const mainContent = page.locator('main');

    await page.goto('/');
    await page.goto('/states');
    await expect(page).toHaveURL(/\/states/);
    await expect(mainContent.getByRole('heading', { name: 'New South Wales' })).toBeVisible();

    await page.goto('/universities');
    await expect(page).toHaveURL(/\/universities/);
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/states/);
    await expect(mainContent.getByRole('heading', { name: 'New South Wales' })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/universities/);
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();
  });

  test('Filtered search via query params', async ({ page }) => {
    const mainContent = page.locator('main');

    // States search query param
    await page.goto('/states?search=Victoria');
    await expect(mainContent.getByRole('heading', { name: 'Victoria' })).toBeVisible();
    await expect(mainContent.getByRole('heading', { name: 'Queensland' })).not.toBeVisible();

    // Universities search query param
    await page.goto('/universities?search=Monash');
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();
    await expect(mainContent.getByRole('heading', { name: 'University of Sydney' })).not.toBeVisible();
  });

  test('Mobile navigation menu explicitly works for States and Universities', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const mainContent = page.locator('main');

    // Open mobile menu
    const menuButton = page.getByLabel('Toggle Navigation Menu');
    await menuButton.click();

    // Click States link in mobile menu
    await page.locator('a[href="/states"]').filter({ hasText: 'States' }).locator('visible=true').click();

    await expect(page).toHaveURL(/\/states/);
    await expect(mainContent.getByRole('heading', { name: 'New South Wales' })).toBeVisible();

    // Open mobile menu again on /states
    await menuButton.click();

    // Click Universities link in mobile menu
    await page.locator('a[href="/universities"]').filter({ hasText: 'Universities' }).locator('visible=true').click();

    await expect(page).toHaveURL(/\/universities/);
    await expect(mainContent.getByRole('heading', { name: 'Monash University' })).toBeVisible();
  });
});
