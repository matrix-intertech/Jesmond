# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\student-flow.spec.ts >> Student Marketplace Flow >> Student full flow: login -> search -> property -> save -> apply -> track -> saved
- Location: e2e\student-flow.spec.ts:33:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/student" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Sign in to Jesmond" [level=2] [ref=e5]
      - paragraph [ref=e6]:
        - text: Don't have an account?
        - link "Sign up" [ref=e7] [cursor=pointer]:
          - /url: /register
    - generic [ref=e8]:
      - generic [ref=e9]: Unexpected token 'T', "Too many r"... is not valid JSON
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Email address
          - textbox "Email address" [ref=e13]: student@jesmond.demo
        - generic [ref=e14]:
          - generic [ref=e15]: Password
          - textbox "Password" [ref=e16]: Jesmond@Demo2026!
      - button "Sign in" [ref=e18] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e24] [cursor=pointer]
  - alert [ref=e28]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Student Marketplace Flow', () => {
  4   | 
  5   |   test.beforeEach(async ({ page }) => {
  6   |     // Optionally clear any state, but since we reuse the same DB, we will just login
  7   |   });
  8   | 
  9   |   test('Guest -> property detail -> Apply -> login', async ({ page }) => {
  10  |     await page.goto('http://localhost:3000/search');
  11  |     
  12  |     // Wait for the search results to load
  13  |     const firstPropertyCard = page.locator('h3').first();
  14  |     await expect(firstPropertyCard).toBeVisible({ timeout: 15000 });
  15  |     
  16  |     // Click the card
  17  |     await firstPropertyCard.click();
  18  |     
  19  |     // Wait for URL to change to /property
  20  |     await page.waitForURL(/\/property\/.*/, { timeout: 15000 });
  21  |     
  22  |     // Check if the property page loaded
  23  |     await expect(page.locator('h1').first()).toBeVisible();
  24  | 
  25  |     // The Apply button when logged out says "Sign up to reserve"
  26  |     const reserveLink = page.getByRole('link', { name: /sign up to reserve/i }).first();
  27  |     await expect(reserveLink).toBeVisible();
  28  |     await reserveLink.click();
  29  |     
  30  |     await expect(page).toHaveURL(/.*\/register/);
  31  |   });
  32  | 
  33  |   test('Student full flow: login -> search -> property -> save -> apply -> track -> saved', async ({ page }) => {
  34  |     // 1. Login
  35  |     await page.goto('http://localhost:3000/login');
  36  |     await page.getByLabel('Email address').fill('student@jesmond.demo');
  37  |     await page.getByLabel('Password').fill('Jesmond@Demo2026!');
  38  |     await page.getByRole('button', { name: /sign in/i }).click();
  39  | 
> 40  |     await page.waitForURL('**/student', { timeout: 30000 });
      |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  41  |     await expect(page.locator('h1', { hasText: 'Student Dashboard' })).toBeVisible();
  42  | 
  43  |     // 2. Search
  44  |     await page.getByRole('link', { name: 'Find Accommodation' }).first().click();
  45  |     await expect(page).toHaveURL(/.*\/search/);
  46  |     
  47  |     // Wait for results
  48  |     const firstPropertyCard = page.locator('h3').first();
  49  |     await expect(firstPropertyCard).toBeVisible({ timeout: 15000 });
  50  |     
  51  |     // 3. Open real property
  52  |     await firstPropertyCard.click();
  53  |     await page.waitForURL(/\/property\/.*/, { timeout: 15000 });
  54  |     await expect(page.locator('h1').first()).toBeVisible();
  55  | 
  56  |     // 4. Save property
  57  |     const saveButton = page.locator('button[title="Save Property"], button[title="Unsave Property"]').first();
  58  |     await expect(saveButton).toBeVisible();
  59  |     await saveButton.click();
  60  | 
  61  |     // 5. Apply
  62  |     const reserveButton = page.getByRole('button', { name: 'Reserve Room' }).first();
  63  |     await reserveButton.click();
  64  | 
  65  |     // Fill application form (Move in Date and Duration)
  66  |     await expect(page.getByRole('heading', { name: 'Reserve Room' })).toBeVisible();
  67  |     
  68  |     const dateInput = page.locator('input[type="date"]');
  69  |     await dateInput.fill('2026-10-01');
  70  | 
  71  |     const durationSelect = page.locator('select');
  72  |     await durationSelect.selectOption('6');
  73  | 
  74  |     const submitBtn = page.getByRole('button', { name: 'Submit Application' });
  75  |     await submitBtn.click();
  76  | 
  77  |     // Verify success
  78  |     await expect(page.getByRole('heading', { name: 'Application Submitted' })).toBeVisible({ timeout: 15000 });
  79  | 
  80  |     // 6. Application tracking
  81  |     await page.getByRole('link', { name: 'View My Applications' }).click();
  82  |     await expect(page).toHaveURL(/.*\/student/);
  83  |     
  84  |     await expect(page.locator('table')).toBeVisible();
  85  |     await expect(page.locator('td', { hasText: 'Pending Review' }).first()).toBeVisible();
  86  | 
  87  |     // 7. Saved properties
  88  |     await page.getByRole('link', { name: 'Saved Properties' }).first().click();
  89  |     await expect(page).toHaveURL(/.*\/student\/saved/);
  90  |     await expect(page.locator('h1', { hasText: 'Saved Properties' })).toBeVisible();
  91  |     
  92  |     // 8. Logout
  93  |     await page.goto('http://localhost:3000/');
  94  |     const userMenu = page.locator('button:has-text("S")').first(); 
  95  |     if (await userMenu.isVisible()) {
  96  |         await userMenu.click();
  97  |         const logout = page.getByRole('menuitem', { name: 'Sign out' });
  98  |         if (await logout.isVisible()) {
  99  |             await logout.click();
  100 |         }
  101 |     }
  102 |   });
  103 | });
  104 | 
```