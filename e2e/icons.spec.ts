import { readFileSync } from "node:fs";
import { acceptDialog, appDialog, expect, item, openApp, test } from "./fixtures";

const PNG = readFileSync("public/icon.png");
// JPEG bytes under a .png name: the picker goes by the bytes.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

const iconRow = (page: import("@playwright/test").Page) =>
  page
    .locator("#propertiesPalette .prop-row")
    .filter({ has: page.getByRole("button", { name: "Browse for icon" }) });

async function pick(
  page: import("@playwright/test").Page,
  name: string,
  buffer: Buffer,
  mimeType: string,
) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse for icon" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType, buffer });
}

test.describe("icons are PNG only", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await item(page, "Button 1").locator(".button-icon").click();
  });

  test("the picker offers PNG files", async ({ page }) => {
    await expect(iconRow(page).locator('input[type="file"]')).toHaveAttribute(
      "accept",
      "image/png,.png",
    );
  });

  test("a file that isn't a PNG is refused and says what it is", async ({ page }) => {
    await pick(page, "logo.png", JPEG, "image/png");
    await expect(appDialog(page)).toContainText('"logo.png" is a JPEG image');
    await expect(appDialog(page)).toContainText("pyRevit icons are PNG files");
    await acceptDialog(page);
    await expect(iconRow(page)).toContainText("Default");
  });

  test("a PNG becomes the icon", async ({ page }) => {
    await pick(page, "mine.png", PNG, "image/png");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(iconRow(page)).not.toContainText("Default");
    const src = await item(page, "Button 1").locator("img").first().getAttribute("src");
    expect(src?.startsWith("data:image/png;base64,iVBORw0KGgo")).toBe(true);
  });

  test("a draft saved with a JPEG icon comes back with the default icon, and says so", async ({
    page,
  }) => {
    await pick(page, "mine.png", PNG, "image/png");
    // What an older builder left in the draft: the same icon as a JPEG.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("pyrevit-extension-builder:draft:v2")))
      .toContain("iVBORw0KGgo");
    const key = "pyrevit-extension-builder:draft:v2";
    const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), key);
    for (const el of Object.values(draft.elements) as { iconData?: string }[]) {
      if (el.iconData) el.iconData = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    }
    // Written as the next page starts: leaving this one saves its own draft over it.
    await page.addInitScript(([k, value]) => localStorage.setItem(k, value), [
      key,
      JSON.stringify(draft),
    ] as const);
    await page.reload();
    await expect(appDialog(page)).toContainText("One icon wasn't a PNG");
    await expect(appDialog(page).locator(".dialog-details li")).toHaveText(['"Button 1": icon']);
    await acceptDialog(page);
    await item(page, "Button 1").locator(".button-icon").click();
    await expect(iconRow(page)).toContainText("Default");
  });
});
