import type { Page } from "@playwright/test";
import { acceptDialog, appDialog, expect, item, openApp, test } from "./fixtures";

async function modalFits(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const content = page.locator(".modal-content");
  const b = await content.boundingBox();
  if (!b) throw new Error("modal not rendered");
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
  expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
  await expect(page.locator("#createButton")).toBeInViewport();
  return content.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
}

test.describe("bundle modal", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("every command type fits the screen, with Advanced open and closed", async ({
    page,
  }, info) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    const tiles = page.locator(".button-type");
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(9);

    const viewport = page.viewportSize();
    const roomy = !!viewport && viewport.width >= 1024 && viewport.height >= 768;

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      await tile.click();
      await expect(tile).toHaveClass(/selected/);
      const label = await tile.locator(".type-name").innerText();

      const noScroll = await modalFits(page);
      if (roomy) expect(noScroll, `${label}: modal needs a scrollbar`).toBe(true);

      const advanced = page.locator("#advancedDisclosure > summary");
      if (await advanced.count()) {
        await advanced.click();
        const openNoScroll = await modalFits(page);
        if (roomy) expect(openNoScroll, `${label} + Advanced: needs a scrollbar`).toBe(true);
        await advanced.click();
      }
    }
    await info.attach("modal", { body: await page.screenshot(), contentType: "image/png" });
  });

  test("opening the modal does not move the page underneath", async ({ page }) => {
    const ids = ["#resetToolbar", "#downloadZip", "#extensionName", ".ribbon"];
    const boxes = () => Promise.all(ids.map((id) => page.locator(id).first().boundingBox()));
    const before = await boxes();
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await expect(page.locator("#buttonModal")).toBeVisible();
    expect(await boxes()).toEqual(before);
  });

  test("the group picker only offers containers", async ({ page }) => {
    await page.getByRole("button", { name: "GROUP", exact: true }).click();
    await expect(page.locator(".button-type .type-postfix")).toHaveText([
      ".pulldown",
      ".splitbutton",
      ".splitpushbutton",
      ".stack",
    ]);
    await modalFits(page);
  });

  test("a missing name is reported in an app dialog, not an alert", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.getByLabel("Name (required)").fill("   ");
    await page.locator("#createButton").click();
    await expect(appDialog(page)).toContainText("Name required");
    await expect(page.locator("#buttonModal")).toBeVisible();
    await acceptDialog(page);
    await expect(page.locator("#buttonModal")).toBeVisible();
  });

  test("a URL button without a hyperlink opens Advanced and explains", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.locator(".button-type", { hasText: "URL Button" }).click();
    await page.locator("#createButton").click();
    await expect(appDialog(page)).toContainText("Hyperlink is required for a URL Button");
    await acceptDialog(page);
    await expect(page.locator("#advancedDisclosure")).toHaveAttribute("open", "");
    await page.locator("#adv_hyperlink").fill("https://pyrevitlabs.io");
    await page.locator("#createButton").click();
    await expect(item(page, "Button 2")).toHaveClass(/urlbutton/);
  });

  test("a duplicate name is refused with a dialog", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.getByLabel("Name (required)").fill("button 1");
    await page.locator("#createButton").click();
    await expect(appDialog(page)).toContainText("already exists");
    await acceptDialog(page);
  });

  test("Escape closes the dialog first, then the modal", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.getByLabel("Name (required)").fill("");
    await page.locator("#createButton").click();
    await expect(appDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(appDialog(page)).toHaveCount(0);
    await expect(page.locator("#buttonModal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#buttonModal")).toHaveCount(0);
  });

  test("double-click edits a stack, which can become a pulldown", async ({ page }) => {
    await page.getByRole("button", { name: "STACK", exact: true }).click();
    await item(page, "NEW STACK").locator(".stack-grip").dblclick();
    await expect(page.locator("#modalTitle")).toHaveText("Edit Stack");
    await page.locator(".button-type", { hasText: "Pulldown" }).click();
    await page.locator("#createButton").click();
    await expect(item(page, "NEW STACK")).toHaveClass(/pulldown/);
  });
});
