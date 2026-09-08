import { test, expect } from '@playwright/test';

test.describe('Form Controls Global Light Theme', () => {
  test('Verify form controls are light across multiple pages', async ({ page }) => {
    test.setTimeout(45000);

    // 1. Homepage Hero Search
    await page.goto('http://localhost:3000/');
    const searchPill = page.locator('text=Search university or city');
    if (await searchPill.isVisible()) {
      await searchPill.click();
      const whereInput = page.getByPlaceholder('Search university or city');
      await expect(whereInput).toBeVisible();
      // Test computed color for text and background
      const bgColor = await whereInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      const textColor = await whereInput.evaluate((el) => window.getComputedStyle(el).color);
      expect(bgColor).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/); // Could be transparent over white bg
      // Since it's #0f172a in hex, it's rgb(15, 23, 42)
      expect(textColor).toMatch(/rgb\(15, 23, 42\)/);

      // Check Select element inside Hero Search
      const selectElements = page.locator('select');
      if (await selectElements.count() > 0) {
        const firstSelect = selectElements.first();
        const selectBg = await firstSelect.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        const selectScheme = await firstSelect.evaluate((el) => window.getComputedStyle(el).colorScheme);
        expect(selectBg).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/);
        expect(selectScheme).toBe('light');
      }
    }

    // 2. Login Page
    await page.goto('http://localhost:3000/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    let computedBg = await emailInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    let computedText = await emailInput.evaluate((el) => window.getComputedStyle(el).color);
    expect(computedBg).toBe('rgb(255, 255, 255)');
    expect(computedText).toBe('rgb(15, 23, 42)');

    // 3. Register Page (another example of form inputs)
    await page.goto('http://localhost:3000/register');
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible();
    computedBg = await firstNameInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    computedText = await firstNameInput.evaluate((el) => window.getComputedStyle(el).color);
    expect(computedBg).toBe('rgb(255, 255, 255)');
    expect(computedText).toBe('rgb(15, 23, 42)');

    // (Select control is now checked as part of homepage hero search)

    // 5. Create Accommodation Page
    await page.goto('http://localhost:3000/portal/create');
    const propertyName = page.locator('input[name="name"]').first();
    // It may redirect if not logged in, but we check if it's there
    if (await propertyName.isVisible()) {
      computedBg = await propertyName.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      computedText = await propertyName.evaluate((el) => window.getComputedStyle(el).color);
      expect(computedBg).toBe('rgb(255, 255, 255)');
      expect(computedText).toBe('rgb(15, 23, 42)');
    }
  });
});
