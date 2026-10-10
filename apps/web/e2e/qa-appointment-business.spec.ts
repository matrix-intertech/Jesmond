import { test, expect } from "@playwright/test";

test.describe("Appointment Business Navigation & Access Control", () => {
  test("SERVICES account receives appointment navigation and cannot access Retail commerce routes", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 1. Log in with Demo Services account
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo.services@jesmond.com.au");
    await page.getByLabel(/password/i).fill("12345678");
    await page.getByRole("button", { name: /sign in/i }).click();

    // 2. Should redirect to appointment dashboard rather than retail commerce overview
    await page.waitForURL("**/portal/business/appointments*");
    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
    await expect(
      page.getByRole("heading", { name: /Appointments Management/i }),
    ).toBeVisible();

    // 3. Verify appointment navigation links exist in the sidebar
    await expect(
      page.getByRole("link", { name: "Appointments", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Services", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Staff & Professionals", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Customers", exact: true }),
    ).toBeVisible();

    // 4. Verify Retail commerce links are NOT visible to appointment business
    await expect(
      page.getByRole("link", { name: "Business Overview", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "POS", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Business Catalog", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inventory", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Business Terminals", exact: true }),
    ).not.toBeVisible();

    // 5. Navigate to Services Catalogue
    await page.getByRole("link", { name: "Services", exact: true }).click();
    await page.waitForURL("**/portal/business/services");
    await expect(
      page.getByRole("heading", { name: /Services Catalogue/i }),
    ).toBeVisible();

    // 6. Navigate to Staff & Professionals
    await page
      .getByRole("link", { name: "Staff & Professionals", exact: true })
      .click();
    await page.waitForURL("**/portal/business/staff");
    await expect(
      page.getByRole("heading", { name: /Staff & Professionals/i }),
    ).toBeVisible();

    // 7. Direct URL protection: attempting to access /portal/retail/pos directly redirects back to appointments
    await page.goto("/portal/retail/pos");
    await page.waitForURL("**/portal/business/appointments");
    await expect(page).toHaveURL(/\/portal\/business\/appointments/);
  });

  test("RETAIL commerce account retains standard Retail navigation", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill("provider@jesmond.demo");
    await page.getByLabel(/password/i).fill("Jesmond@Demo2026!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("**/portal/retail*");
    await expect(page).toHaveURL(/\/portal\/retail/);

    // Verify retail navigation items are visible for Retail commerce accounts
    await expect(
      page.getByRole("link", { name: "Business Overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "POS", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Business Catalog", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inventory", exact: true }),
    ).toBeVisible();
  });
});
