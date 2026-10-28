import { test, expect } from '@playwright/test';

test.describe('Support Page — Functional Interactions & Theme Cleanup', () => {

  test('1. Clean purple hero section with heading and functional search only', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    // Verify main landmark with id="main-content" and tabIndex="-1"
    const main = page.locator('main#main-content');
    await expect(main).toBeAttached();
    await expect(main).toHaveAttribute('tabIndex', '-1');

    // Hero section checks
    const heroSection = page.locator('section[aria-labelledby="support-hero-heading"]');
    await expect(heroSection).toBeVisible();
    await expect(heroSection).toHaveClass(/bg-primary/);

    // Hero heading "How can we help?"
    const heroHeading = heroSection.locator('h1#support-hero-heading');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/how can we help\?/i);

    // Hero contains search input and search button
    const searchInput = heroSection.locator('#support-search');
    await expect(searchInput).toBeVisible();
    const searchButton = heroSection.locator('button[type="submit"]');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toHaveText(/search/i);

    // Verify no extra CTA buttons or unrelated decorative buttons in hero
    const allHeroButtons = heroSection.locator('button');
    // Initially without input text, only the Search button is present
    await expect(allHeroButtons).toHaveCount(1);
    const heroLinks = heroSection.locator('a');
    await expect(heroLinks).toHaveCount(0);
  });

  test('2. Knowledge base search works with Enter and Search button', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('#support-search');
    const searchButton = page.locator('button[type="submit"]');

    // Type query and press Enter
    await searchInput.click();
    await searchInput.fill('bond');
    await expect(searchInput).toHaveValue('bond');
    await searchInput.press('Enter');

    // Verify URL updated with query
    await expect(page).toHaveURL(/.*\/support\?q=bond/);

    // Verify search results container appeared
    const resultsHeading = page.locator('h2', { hasText: /search results/i });
    await expect(resultsHeading).toBeVisible();

    // Verify matching article is displayed
    const bondArticle = page.locator('article', { hasText: /how are rental bonds handled in australia\?/i });
    await expect(bondArticle).toBeVisible();

    // Search with Search button click
    await searchInput.fill('visa');
    await searchButton.click();

    // Verify URL updated
    await expect(page).toHaveURL(/.*\/support\?q=visa/);

    const visaArticle = page.locator('article', { hasText: /student visa/i });
    await expect(visaArticle.first()).toBeVisible();
  });

  test('3. Search empty-state and clear/reset actions', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('#support-search');

    // Search for a nonexistent term
    await searchInput.fill('xyzunknownterm123');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/.*\/support\?q=xyzunknownterm123/);

    // Verify clear empty state
    const emptyStateHeading = page.locator('h2', { hasText: /no matching articles found/i });
    await expect(emptyStateHeading).toBeVisible();

    // Verify reset action
    const resetBtn = page.locator('a, button', { hasText: /clear search/i }).first();
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // URL returns to base /support
    await expect(page).toHaveURL(/\/support$/);

    // Category cards are displayed again
    const categoryGrid = page.locator('section[aria-label="Support Categories"]');
    await expect(categoryGrid).toBeVisible();
  });

  test('4. All six category cards navigate and filter correctly', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    const expectedCategories = [
      { slug: 'finding-accommodation', title: 'Finding Accommodation' },
      { slug: 'students', title: 'Students' },
      { slug: 'providers', title: 'Providers' },
      { slug: 'applications', title: 'Applications' },
      { slug: 'account-security', title: 'Account & Security' },
      { slug: 'payments', title: 'Payments' },
    ];

    for (const cat of expectedCategories) {
      // Find card specifically within the categories grid
      const card = page.locator(`section[aria-label="Support Categories"] a[href="/support?category=${cat.slug}"]`);
      await expect(card).toBeVisible();
      await expect(card).toHaveText(new RegExp(cat.title, 'i'));

      // Click card
      await card.click();

      // Verify URL updated
      await expect(page).toHaveURL(new RegExp(`/support\\?category=${cat.slug}`));

      // Verify category header is displayed
      const categoryHeading = page.locator('h2', { hasText: cat.title });
      await expect(categoryHeading).toBeVisible();

      // Verify articles for this category are shown
      const articles = page.locator('article');
      const count = await articles.count();
      expect(count).toBeGreaterThan(0);

      // Return to all categories
      const backLink = page.locator('a', { hasText: /back to all categories/i });
      await expect(backLink).toBeVisible();
      await backLink.click();

      await expect(page).toHaveURL(/\/support$/);
    }
  });

  test('5. Browser Back button returns to previous category state', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    // Navigate to Payments
    await page.locator('section[aria-label="Support Categories"] a[href="/support?category=payments"]').click();
    await expect(page).toHaveURL(/\/support\?category=payments/);
    await expect(page.locator('h2', { hasText: 'Payments' })).toBeVisible();

    // Navigate back to all categories
    await page.locator('a', { hasText: /back to all categories/i }).click();
    await expect(page).toHaveURL(/\/support$/);

    // Navigate to Students
    await page.locator('section[aria-label="Support Categories"] a[href="/support?category=students"]').click();
    await expect(page).toHaveURL(/\/support\?category=students/);
    await expect(page.locator('h2', { hasText: 'Students' })).toBeVisible();

    // Browser back to /support
    await page.goBack();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.locator('section[aria-label="Support Categories"]')).toBeVisible();

    // Browser back to /support?category=payments
    await page.goBack();
    await expect(page).toHaveURL(/\/support\?category=payments/);
    await expect(page.locator('h2', { hasText: 'Payments' })).toBeVisible();
  });

  test('6. Mobile viewports (320px, 375px, 430px) have zero horizontal overflow', async ({ page }) => {
    const viewports = [
      { width: 320, height: 640 },
      { width: 375, height: 667 },
      { width: 430, height: 932 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/support', { waitUntil: 'domcontentloaded' });

      const searchInput = page.locator('#support-search');
      await expect(searchInput).toBeVisible();

      const docWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      expect(scrollWidth).toBeLessThanOrEqual(docWidth + 1);

      // Verify search input font size is >= 16px to prevent iOS auto-zoom
      const fontSize = await searchInput.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);

      // Verify search button touch target height >= 38px
      const searchBtn = page.locator('button[type="submit"]');
      await expect(searchBtn).toBeVisible();
      const btnBox = await searchBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      if (btnBox) {
        expect(btnBox.height).toBeGreaterThanOrEqual(38);
      }
    }
  });

  test('7. Keyboard focus indicators and no nested invalid button HTML', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    // Verify no buttons nested inside anchor tags (W3C invalid HTML)
    const nestedButtons = page.locator('a button');
    await expect(nestedButtons).toHaveCount(0);

    // Tab through to the search input and search button
    await page.locator('#support-search').focus();
    await expect(page.locator('#support-search')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button[type="submit"]')).toBeFocused();

    // Tab into first category card in the categories section
    await page.keyboard.press('Tab');
    const firstCard = page.locator('section[aria-label="Support Categories"] a[href="/support?category=finding-accommodation"]');
    await expect(firstCard).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/support\?category=finding-accommodation/);
  });

  test('8. Axe-core accessibility scan on /support', async ({ page }) => {
    await page.goto('/support', { waitUntil: 'domcontentloaded' });

    // Inject axe-core
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js',
    });

    const results = await page.evaluate(async () => {
      // @ts-expect-error window.axe is injected dynamically
      return await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      });
    });

    const critical = results.violations.filter((v: any) => v.impact === 'critical');
    if (critical.length > 0) {
      console.error('[axe-core] Critical violations on /support:', critical);
    }
    expect(critical).toHaveLength(0);
  });

});
