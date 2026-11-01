import { expect, test } from "./fixtures";

test("boots when hosted under a sub-path, as on GitHub Pages", async ({ page }) => {
  await page.goto("http://localhost:4175/extension-builder/");
  await expect(page.locator("#ribbonContainer .panel")).toHaveCount(1);
  const logo = page.getByRole("img", { name: "pyRevit Logo" });
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const icon = page.locator('[data-name="Button 1"] img');
  await expect
    .poll(() => icon.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(1);
});
