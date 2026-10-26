import { test, expect } from '@playwright/test';

interface AxeNode {
  html: string;
}

interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeViolation[];
  passes: unknown[];
}

test.describe('Accessibility & Agentic Browsing Verification Pass', () => {

  test('1. Skip Link, Focus Indicators & Semantic Landmarks', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify skip link exists and has proper target
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveText(/skip to main content/i);

    // Tab to skip link
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    // Verify main landmark
    const mainLandmark = page.locator('main#main-content');
    await expect(mainLandmark).toBeAttached();
    await expect(mainLandmark).toHaveAttribute('tabIndex', '-1');

    // Verify GlobalNav and Footer are not inside main
    const navInsideMain = mainLandmark.locator('nav[aria-label="Main Navigation"]');
    await expect(navInsideMain).toHaveCount(0);
    const footerInsideMain = mainLandmark.locator('footer');
    await expect(footerInsideMain).toHaveCount(0);
  });

  test('2. Navigation & Mobile Menu Accessibility with Escape Dismissal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Main nav landmark
    const nav = page.locator('nav[aria-label="Main Navigation"]');
    await expect(nav).toBeAttached();

    // Saved property link has aria-label
    const savedLink = page.locator('a[aria-label="Saved Properties"]');
    await expect(savedLink).toBeAttached();

    // Desktop auth links
    const loginLink = page.locator('nav a[href="/login"]').first();
    const registerLink = page.locator('nav a[href="/register"]').first();
    await expect(loginLink).toBeAttached();
    await expect(registerLink).toBeAttached();

    // Mobile menu viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileMenuBtn = page.locator('button[aria-controls="mobile-navigation-menu"]');
    await expect(mobileMenuBtn).toBeVisible();
    await expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');

    // Open mobile menu
    await mobileMenuBtn.dispatchEvent('click');
    await expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'true');

    const mobileMenu = page.locator('#mobile-navigation-menu');
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu).toHaveAttribute('role', 'dialog');
    await expect(mobileMenu).toHaveAttribute('aria-modal', 'true');

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(mobileMenu).not.toBeVisible();
    await expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('3. Heading Hierarchy & Clean Semantic Nesting', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check single h1 heading on homepage
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);

    // Verify no buttons nested inside anchor tags (invalid HTML nesting)
    const nestedButtons = page.locator('a button');
    await expect(nestedButtons).toHaveCount(0);

    // Verify footer section headings are h3 (not skipping hierarchy)
    const footerH3 = page.locator('footer h3');
    const footerH3Count = await footerH3.count();
    expect(footerH3Count).toBeGreaterThan(0);
  });

  test('4. Registration Account-Type Selection & React Hooks Safety', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    const studentBtn = page.locator('button', { hasText: 'Student' });
    const hostBtn = page.locator('button', { hasText: 'Host' });
    const businessBtn = page.locator('button', { hasText: 'Business' });

    // Wait for Suspense boundary hydration
    await expect(studentBtn).toBeVisible({ timeout: 15000 });

    // Default is student
    await expect(studentBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(hostBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(businessBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Host
    await hostBtn.click();
    await expect(hostBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(studentBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(businessBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Business
    await businessBtn.click();
    await expect(businessBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(hostBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(studentBtn).toHaveAttribute('aria-pressed', 'false');

    // Check that business-specific fields appear
    await expect(page.locator('#org-name')).toBeVisible();
    await expect(page.locator('#business-category')).toBeVisible();

    // Click back to Student
    await studentBtn.click();
    await expect(studentBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#org-name')).not.toBeAttached();

    // Verify no React Hook violation errors logged
    const hookErrors = consoleErrors.filter(e => e.includes('Rendered more hooks') || e.includes('Invalid hook call'));
    expect(hookErrors).toHaveLength(0);

    // Verify form input autocomplete attributes
    await expect(page.locator('#name')).toHaveAttribute('autoComplete', 'name');
    await expect(page.locator('#email')).toHaveAttribute('autoComplete', 'email');
    await expect(page.locator('#phone')).toHaveAttribute('autoComplete', 'tel-national');
    await expect(page.locator('#dob')).toHaveAttribute('autoComplete', 'bday');
    await expect(page.locator('#password')).toHaveAttribute('autoComplete', 'new-password');
    await expect(page.locator('#confirm-password')).toHaveAttribute('autoComplete', 'new-password');
  });

  test('5. Login Form Autocomplete & Error Alert Attributes', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('#email-address');
    const passwordInput = page.locator('#password');

    // Wait for Suspense boundary hydration
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(emailInput).toHaveAttribute('autoComplete', 'email');
    await expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');

    // Trigger validation / submission
    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('short');
    await page.locator('button[type="submit"]').click();

    // If an error alert appears, verify it has role="alert"
    const alert = page.locator('[role="alert"]');
    if (await alert.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(alert).toHaveAttribute('aria-live', 'assertive');
    }
  });

  test('6. Location Autocomplete Combobox / Listbox Semantics', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Find location search input
    const locationInput = page.locator('#hero-location-search, #location-search').first();
    await expect(locationInput).toBeAttached();
    await expect(locationInput).toHaveAttribute('aria-autocomplete', 'list');

    // Focus and type to trigger suggestions
    await locationInput.click();
    await locationInput.fill('Sydney');

    // Wait for listbox dropdown
    const listbox = page.locator('ul[role="listbox"]').first();
    if (await listbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(listbox).toHaveAttribute('aria-label', /location suggestions/i);
      const options = listbox.locator('li[role="option"]');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('7. Search Page Property Article Cards & Internal Anchor Links', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const mainContent = page.locator('main#main-content');
    await expect(mainContent).toBeAttached();

    // Check filter pills for aria-pressed
    const filterPills = page.locator('button[aria-pressed]');
    const count = await filterPills.count();
    expect(count).toBeGreaterThan(0);

    // Check if property cards are semantic articles with real anchor links
    const articles = page.locator('article');
    const articleCount = await articles.count();
    if (articleCount > 0) {
      const firstArticle = articles.first();
      const detailLink = firstArticle.locator('a[href^="/property/"]').first();
      await expect(detailLink).toBeAttached();
      const href = await detailLink.getAttribute('href');
      expect(href).toMatch(/^\/property\/.+/);

      // Verify save button inside article is not inside an anchor
      const saveBtnInsideLink = firstArticle.locator('a button');
      await expect(saveBtnInsideLink).toHaveCount(0);
    }
  });

  test('8. Canonical URLs, Robots Meta & Structured Data (JSON-LD)', async ({ page }) => {
    // Check Homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const canonical = page.locator('link[rel="canonical"]');
    if (await canonical.count() > 0) {
      const href = await canonical.getAttribute('href');
      expect(href).toMatch(/^https?:\/\//);
    }

    // Structured data
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const scriptCount = await jsonLdScripts.count();
    expect(scriptCount).toBeGreaterThan(0);

    for (let i = 0; i < scriptCount; i++) {
      const rawText = await jsonLdScripts.nth(i).textContent();
      expect(rawText).toBeTruthy();
      const parsed: unknown = JSON.parse(rawText || '{}');
      if (Array.isArray(parsed)) {
        for (const item of parsed as Record<string, unknown>[]) {
          expect(item['@context']).toBe('https://schema.org');
        }
      } else {
        expect((parsed as Record<string, unknown>)['@context']).toBe('https://schema.org');
      }
    }

    // Check Cost guide page FAQ schema
    await page.goto('/cost', { waitUntil: 'domcontentloaded' });
    const costJsonLd = page.locator('script[type="application/ld+json"]');
    expect(await costJsonLd.count()).toBeGreaterThan(0);
  });

  test('9. Automated Accessibility Scan via axe-core on Key Routes', async ({ page }) => {
    const routesToTest = ['/', '/login', '/register', '/guide'];

    for (const route of routesToTest) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Inject axe-core from CDN
      await page.addScriptTag({
        url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'
      });

      // Run axe evaluation
      const results = (await page.evaluate(async () => {
        // @ts-expect-error window.axe is injected dynamically via addScriptTag
        return await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
          }
        });
      })) as AxeResults;

      console.log(`[axe-core] Route ${route}: ${results.violations.length} violations, ${results.passes.length} passed rules`);
      if (results.violations.length > 0) {
        console.log(`[axe-core] Violations on ${route}:`, results.violations.map((v: AxeViolation) => `${v.id} (${v.impact}): ${v.description} -> Nodes: ${v.nodes.map((n: AxeNode) => n.html).join(' | ')}`));
      }
      const critical = results.violations.filter((v: AxeViolation) => v.impact === 'critical');
      if (critical.length > 0) {
        console.error(`[axe-core] Critical violations on ${route}:`, critical.map((v: AxeViolation) => ({
          id: v.id,
          description: v.description,
          nodes: v.nodes.length
        })));
      }

      // Assert zero critical accessibility violations
      expect(critical).toHaveLength(0);
    }
  });

});
