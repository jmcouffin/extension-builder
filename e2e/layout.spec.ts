import type { Page } from "@playwright/test";
import { addGroup, addStack, expect, openApp, openBrowser, test } from "./fixtures";

type Box = { x: number; y: number; width: number; height: number };

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not rendered`);
  return b;
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(clientWidth);
}

test.describe("layout", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("boots with the default tab, panel and command", async ({ page }) => {
    await expect(page.locator(".tab.active .tab-name")).toHaveValue("My Tab");
    await expect(page.locator(".panel-name")).toHaveValue("My Panel");
    await expect(page.locator('[data-name="Button 1"] img')).toHaveJSProperty("complete", true);
    const natural = await page
      .locator('[data-name="Button 1"] img')
      .evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(natural, "the bundled default icon loaded").toBeGreaterThan(1);
  });

  test("the page never scrolls sideways", async ({ page }) => {
    await expectNoSidewaysScroll(page);
    await addStack(page);
    await addGroup(page, "Tools");
    await page.locator("#addTab").click();
    await openBrowser(page);
    await expectNoSidewaysScroll(page);
  });

  test("header actions are visible, inside the viewport and apart", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    const ids = ["#loadConfig", "#saveConfig", "#resetToolbar", "#downloadZip"];
    const boxes: Box[] = [];
    for (const id of ids) {
      const b = await box(page, id);
      expect(b.x, `${id} left edge`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${id} right edge`).toBeLessThanOrEqual(viewport.width);
      boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i] as Box, boxes[j] as Box), `${ids[i]} overlaps ${ids[j]}`).toBe(
          false,
        );
      }
    }
  });

  test("on a phone, Properties comes before the drawing area and the Project Browser", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 700, "the palettes stack only on a phone");
    const properties = await box(page, "#propertiesPalette");
    const drawing = await box(page, ".drawing-area");
    const browser = await box(page, ".preview-panel");
    expect(properties.y + properties.height).toBeLessThanOrEqual(drawing.y + 1);
    expect(properties.y + properties.height).toBeLessThanOrEqual(browser.y + 1);
  });

  test("the ribbon and the folder preview do not overlap", async ({ page }) => {
    await openBrowser(page);
    await expect(page.locator("#folderPreview")).toContainText("My Extension.extension");
    const ribbon = await box(page, ".ribbon-container");
    const preview = await box(page, ".preview-panel");
    expect(overlaps(ribbon, preview)).toBe(false);
  });

  test("the tab strip belongs to the ribbon and its + sits inside it", async ({ page }) => {
    const strip = await box(page, ".tabs-container");
    const ribbon = await box(page, ".ribbon");
    const add = await box(page, "#addTab");
    expect(Math.abs(strip.x + strip.width - (ribbon.x + ribbon.width))).toBeLessThanOrEqual(1);
    expect(add.x + add.width).toBeLessThanOrEqual(strip.x + strip.width);
    expect(add.x).toBeGreaterThanOrEqual(strip.x);
  });

  test("ribbon items stay inside their panel", async ({ page }) => {
    await addStack(page);
    await addGroup(page, "Tools");
    const panel = await box(page, ".panel");
    for (const b of await page.locator(".panel-content > [data-button-id]").all()) {
      const r = await b.boundingBox();
      if (!r) throw new Error("item not rendered");
      expect(r.x).toBeGreaterThanOrEqual(panel.x - 1);
      expect(r.y).toBeGreaterThanOrEqual(panel.y - 1);
      expect(r.y + r.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
    }
  });

  test("a stack's first row lines up with a full-height command's icon", async ({
    page,
    theme,
  }) => {
    test.skip(theme === "legacy-8bit", "a Revit ribbon rule; the legacy theme never followed it");
    await addStack(page);
    const solo = await box(page, '.panel-content > [data-name="Button 1"] .button-icon');
    const firstRow = await box(page, ".stack .stack-items > .button .button-icon");
    expect(Math.abs(solo.y - firstRow.y)).toBeLessThanOrEqual(1);
  });

  test("the Project Browser lists every folder and scrolls inside its palette", async ({
    page,
  }) => {
    await addStack(page);
    await addGroup(page, "Tools");
    await openBrowser(page);
    await expect(page.locator("#previewSummaryMeta")).toContainText("folders");
    const fits = (sel: string) =>
      page.locator(sel).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(await fits("#previewSummaryMeta"), "the folder/file count is cut off").toBe(true);

    // Every row carries its full name, so a deep one cut by the palette's
    // edge is still readable, and the palette scrolls sideways, not the page.
    for (const row of await page.locator("#folderPreview .tree-row").all()) {
      await expect(row).toHaveAttribute("title", /\S/);
    }
    await expect(page.locator("#folderPreview")).toHaveCSS("overflow-x", "auto");
    const ribbon = await box(page, ".ribbon-container");
    const open = await box(page, ".preview-panel");
    expect(overlaps(ribbon, open)).toBe(false);
    await expectNoSidewaysScroll(page);
  });

  test("the folder preview scrolls inside its own panel", async ({ page }, info) => {
    await addStack(page);
    await addGroup(page, "Tools");
    await openBrowser(page);
    const preview = await box(page, ".preview-content");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    expect(preview.width).toBeLessThanOrEqual(viewport.width);
    await info.attach("layout", { body: await page.screenshot(), contentType: "image/png" });
  });

  test("a long folder tree fits the window and scrolls inside the panel", async ({ page }) => {
    await openBrowser(page);
    for (let i = 0; i < 8; i++) await addStack(page);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    const narrow = viewport.width <= 700;

    const panel = await box(page, ".preview-panel");
    if (!narrow) {
      expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
      const pageScrolls = await page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight + 1,
      );
      expect(pageScrolls, "the page scrolls vertically").toBe(false);
    }
    const tree = page.locator("#folderPreview");
    expect(await tree.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expectNoSidewaysScroll(page);
  });

  test("the tab icon is the app logo and it loads", async ({ page }) => {
    const href = await page.locator('link[rel="icon"]').getAttribute("href");
    expect(href).toMatch(/logo-[\w-]+\.svg$/);
    const response = await page.request.get(new URL(href ?? "", page.url()).href);
    expect(response.ok()).toBe(true);
  });
});
