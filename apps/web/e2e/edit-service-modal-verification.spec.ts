import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = "C:/Users/Shikhar/.gemini/antigravity/brain/3dc3351f-37ff-48b7-98d1-a24657b912b1/screenshots";

test.describe("Edit Bookable Service Modal - Visual & Functional Verification", () => {
  test("Desktop (1920x1080), Laptop (1366x768), and Mobile (390x844) Viewport Verification", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Initial Login at Desktop Resolution
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/email/i).fill("demo.services@jesmond.com.au");
    await page.getByLabel(/password/i).fill("12345678");
    await page.getByRole("button", { name: /sign in/i }).click();

    // 2. Navigate to /portal/business/services
    await page.waitForURL("**/portal/business/**");
    await page.goto("http://localhost:3000/portal/business/services");
    await page.waitForLoadState("networkidle");

    // Dismiss verification prompt modal if it appears
    const verificationModal = page.locator('[data-testid="business-verification-modal"]');
    if (await verificationModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      const dismissBtn = page.locator('[data-testid="business-verification-dismiss-btn"]');
      if (await dismissBtn.isVisible()) {
        await dismissBtn.click();
        await expect(verificationModal).not.toBeVisible();
      }
    }

    // Dismiss "Complete your profile" modal if it appears
    const profileModalDismiss = page.getByRole("button", { name: "Maybe Later" });
    if (await profileModalDismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
      await profileModalDismiss.click();
      await expect(profileModalDismiss).not.toBeVisible();
    }

    await expect(
      page.getByRole("heading", { name: /Services Catalogue/i }),
    ).toBeVisible();

    // =========================================================================
    // STEP 1: DESKTOP VIEWPORT (1920x1080)
    // =========================================================================
    // Locate the first Edit Service button
    const firstEditButton = page.locator('button[title="Edit Service"]').first();
    await expect(firstEditButton).toBeVisible();
    await firstEditButton.click();

    // Verify modal appears
    const modalHeading = page.getByRole("heading", { name: "Edit Bookable Service" });
    await expect(modalHeading).toBeVisible();

    // Confirm both Cancel and Save Changes are in the viewport
    const cancelButton = page.getByRole("button", { name: "Cancel" });
    const saveButton = page.getByRole("button", { name: "Save Changes" });

    await expect(cancelButton).toBeVisible();
    await expect(saveButton).toBeVisible();

    // Ensure buttons are in viewport without scrolling
    const saveBoundingBox = await saveButton.boundingBox();
    expect(saveBoundingBox).not.toBeNull();
    expect(saveBoundingBox!.y + saveBoundingBox!.height).toBeLessThanOrEqual(1080);

    // Take Desktop Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "edit_service_modal_desktop.png"),
    });

    // Change Location to CUSTOMER_LOCATION ("At Customer")
    await page.getByRole("button", { name: /At Customer/i }).click();

    // Click Save Changes
    await saveButton.click();

    // Verify Success notification banner appears
    const successBanner = page.locator(".bg-green-50");
    await expect(successBanner).toBeVisible({ timeout: 10000 });
    await expect(successBanner).toContainText(/updated successfully/i);

    // Verify modal is closed
    await expect(modalHeading).not.toBeVisible();

    // Reopen modal to verify CUSTOMER_LOCATION persisted
    await firstEditButton.click();
    await expect(modalHeading).toBeVisible();

    const customerLocationButton = page.getByRole("button", { name: /At Customer/i });
    await expect(customerLocationButton).toHaveClass(/border-purple-600/);

    // Close modal
    await cancelButton.click();
    await expect(modalHeading).not.toBeVisible();

    // =========================================================================
    // STEP 2: LAPTOP VIEWPORT (1366x768)
    // =========================================================================
    await page.setViewportSize({ width: 1366, height: 768 });

    // Open Edit Modal
    await firstEditButton.click();
    await expect(modalHeading).toBeVisible();

    // Verify Save Changes and Cancel buttons are both visible and within 768px height
    await expect(cancelButton).toBeVisible();
    await expect(saveButton).toBeVisible();

    const laptopSaveBox = await saveButton.boundingBox();
    expect(laptopSaveBox).not.toBeNull();
    expect(laptopSaveBox!.y + laptopSaveBox!.height).toBeLessThanOrEqual(768);

    // Take Laptop Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "edit_service_modal_laptop.png"),
    });

    // Change Location to FLEXIBLE ("Both Locations")
    await page.getByRole("button", { name: /Both Locations/i }).click();

    // Save Changes
    await saveButton.click();

    // Verify Success notification banner
    await expect(page.locator(".bg-green-50")).toBeVisible({ timeout: 10000 });
    await expect(modalHeading).not.toBeVisible();

    // Reopen modal to verify FLEXIBLE persisted
    await firstEditButton.click();
    await expect(modalHeading).toBeVisible();

    const flexibleButton = page.getByRole("button", { name: /Both Locations/i });
    await expect(flexibleButton).toHaveClass(/border-blue-600/);

    // Close modal
    await cancelButton.click();
    await expect(modalHeading).not.toBeVisible();

    // =========================================================================
    // STEP 3: MOBILE VIEWPORT (390x844)
    // =========================================================================
    await page.setViewportSize({ width: 390, height: 844 });

    // Open Edit Modal
    await firstEditButton.click();
    await expect(modalHeading).toBeVisible();

    // Verify Save Changes and Cancel buttons are visible in mobile viewport
    await expect(cancelButton).toBeVisible();
    await expect(saveButton).toBeVisible();

    const mobileSaveBox = await saveButton.boundingBox();
    expect(mobileSaveBox).not.toBeNull();
    expect(mobileSaveBox!.y + mobileSaveBox!.height).toBeLessThanOrEqual(844);

    // Take Mobile Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "edit_service_modal_mobile.png"),
    });

    // Switch back to AT_BRANCH ("At Business")
    await page.getByRole("button", { name: /At Business/i }).click();

    // Click Save Changes
    await saveButton.click();

    // Verify Success notification banner and closed modal
    await expect(page.locator(".bg-green-50")).toBeVisible({ timeout: 10000 });
    await expect(modalHeading).not.toBeVisible();

    // Reopen and verify AT_BRANCH persisted
    await firstEditButton.click();
    await expect(modalHeading).toBeVisible();
    const branchButton = page.getByRole("button", { name: /At Business/i });
    await expect(branchButton).toHaveClass(/border-accent/);

    await cancelButton.click();
    await expect(modalHeading).not.toBeVisible();
  });
});
