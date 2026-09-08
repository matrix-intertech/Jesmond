import { test, expect } from '@playwright/test';

test.describe('Hero Search', () => {
  test('Verify hero search bar functionality and styling', async ({ page }) => {
    test.setTimeout(45000);

    // 1. Open homepage.
    await page.goto('http://localhost:3000/');

    // 2. Verify hero search controls are visible.
    // The hero search bar has a "Where" block which expands the modal on click.
    const searchPill = page.locator('text=Search university or city');
    await expect(searchPill).toBeVisible();

    // Click to expand the search modal
    await searchPill.click();

    // 3. Verify input backgrounds are white.
    // 4. Verify input text is dark/black.
    const whereInput = page.getByPlaceholder('Search university or city');
    await expect(whereInput).toBeVisible();
    await expect(whereInput).toHaveClass(/bg-white/);
    await expect(whereInput).toHaveClass(/text-brand-navy/);

    const roomSelect = page.getByRole('combobox').nth(0);
    await expect(roomSelect).toBeVisible();
    await expect(roomSelect).toHaveClass(/bg-white/);
    await expect(roomSelect).toHaveClass(/text-brand-navy/);

    const budgetSelect = page.getByRole('combobox').nth(1);
    await expect(budgetSelect).toBeVisible();
    await expect(budgetSelect).toHaveClass(/bg-white/);
    await expect(budgetSelect).toHaveClass(/text-brand-navy/);

    // 5. Enter/select a valid location.
    await whereInput.fill('Melbourne');
    
    // Select room type
    await roomSelect.selectOption('Studio');
    
    // Select budget
    await budgetSelect.selectOption('450');

    // 6. Click Search.
    const searchBtn = page.getByRole('button', { name: 'Search', exact: true });
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    // 7. Verify navigation to the existing property search/discovery flow.
    // 8. Verify the selected search parameter is present.
    await expect(page).toHaveURL(/.*\/search\?city=Melbourne&roomType=Studio&maxPrice=450/);
    
    // 9. Verify property results load or the existing empty-state appears correctly.
    // In the search page, either "Discover Student Living" or "Student Accommodation in Melbourne" is present
    const heading = page.locator('h1');
    await expect(heading).toContainText('Student Accommodation in Melbourne');
  });
});
