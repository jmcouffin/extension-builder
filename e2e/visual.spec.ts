import type { Page } from "@playwright/test";
import { addCommand, addGroup, addStack, expect, item, openApp, test } from "./fixtures";

/**
 * Pixel baselines of each theme. The `builder` baselines were captured from
 * the UI before theming existed, so they prove the default theme still looks
 * exactly as it did. Baselines are per-OS (fonts render differently), so this
 * suite is tagged @visual and CI skips it; run it locally.
 */
test.describe("@visual", () => {
  const shot = (page: Page, name: string) =>
    expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      // No pixel may differ beyond a hair of colour. Playwright's default
      // threshold (0.2) is wide enough to pass a brown ribbon for a purple
      // one; 0.02 only absorbs the odd one-level antialiasing wobble under a
      // translucent overlay.
      maxDiffPixels: 0,
      threshold: 0.02,
    });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => document.fonts.ready);
  });

  test("default", async ({ page }) => {
    await shot(page, "default");
  });

  test("populated ribbon with the folder preview open", async ({ page }) => {
    await addStack(page);
    await addGroup(page, "Tools");
    await addCommand(page, "Second");
    await page.locator("#previewDisclosure summary").click();
    await page.mouse.move(0, 0);
    await shot(page, "populated");
  });

  test("bundle modal", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await shot(page, "modal");
  });

  test("bundle modal with Advanced open", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.locator(".button-type", { hasText: "URL Button" }).click();
    await page.locator("#advancedDisclosure > summary").click();
    await shot(page, "modal-advanced");
  });

  test("app dialog", async ({ page }) => {
    await page.locator(".tab").hover();
    await page.locator(".tab-delete-button").click();
    await page.mouse.move(0, 0);
    await shot(page, "dialog");
  });

  test("group editor", async ({ page }) => {
    await addCommand(page, "Tool");
    await addGroup(page, "Tools");
    await item(page, "Tools").locator(".button-icon").click();
    await page.mouse.move(0, 0);
    await shot(page, "group-editor");
  });
});
