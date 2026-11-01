import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  addStack,
  expect,
  item,
  namesIn,
  openApp,
  openBrowser,
  panelItems,
  select,
  test,
} from "./fixtures";

const props = (page: import("@playwright/test").Page) => page.locator("#propertiesPalette");

test.describe("Revit frame", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("with nothing selected, Properties shows the extension", async ({ page }) => {
    await expect(props(page).locator(".type-selector")).toContainText("pyRevit Extension");
    await expect(props(page).locator(".type-selector")).toContainText("My Extension.extension");
    await expect(page.locator("#contextTab")).toHaveCount(0);
  });

  test("a click selects a button: ring, Properties, Modify tab, browser row", async ({ page }) => {
    await select(page, "Button 1");
    await expect(props(page).locator(".type-selector")).toContainText("Push Button");
    await expect(props(page).locator(".type-selector")).toContainText(".pushbutton");
    await expect(page.locator("#contextTab")).toHaveText("Modify | Push Button");
    await openBrowser(page);
    await expect(page.locator('#folderPreview [aria-selected="true"]')).toContainText(
      "Button 1.pushbutton",
    );

    // A click on empty ribbon clears it, as in Revit.
    const ribbon = await page.locator("#ribbonContainer").boundingBox();
    if (!ribbon) throw new Error("no ribbon");
    await page.mouse.click(ribbon.x + ribbon.width - 20, ribbon.y + ribbon.height / 2);
    await expect(item(page, "Button 1")).not.toHaveClass(/is-selected/);
    await expect(page.locator("#contextTab")).toHaveCount(0);
  });

  test("Properties edits apply on Enter and reach the files", async ({ page }) => {
    await select(page, "Button 1");
    const name = props(page).getByLabel("Name", { exact: true });
    await name.fill("Renumber");
    await name.press("Enter");
    await expect(item(page, "Renumber")).toBeVisible();

    const tooltip = props(page).getByLabel("Tooltip");
    await tooltip.fill("Renumbers the doors");
    await expect(props(page).locator(".palette-apply")).toBeEnabled();
    await props(page).locator(".palette-apply").click();
    await expect(props(page).locator(".palette-apply")).toBeDisabled();

    await page.getByRole("tab", { name: "bundle.yaml" }).click();
    await expect(page.locator(".code-sheet pre")).toContainText('tooltip: "Renumbers the doors"');

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#downloadZip").click();
    const zip = await JSZip.loadAsync(await readFile(await (await downloadPromise).path()));
    const yaml = Object.keys(zip.files).find((n) => n.endsWith("Renumber.pushbutton/bundle.yaml"));
    expect(yaml).toBeTruthy();
    expect(await zip.file(yaml ?? "")?.async("string")).toContain("Renumbers the doors");
  });

  test("the Type Selector changes the bundle type", async ({ page }) => {
    await select(page, "Button 1");
    await props(page).getByLabel("Bundle type").selectOption("toggle");
    await expect(item(page, "Button 1")).toHaveAttribute("data-type", "toggle");
    await expect(props(page).locator(".type-selector")).toContainText("Toggle");
  });

  test("the Modify tab moves, edits and deletes the selection", async ({ page }) => {
    await addStack(page);
    await select(page, "Button 1");
    await page.locator("#contextTab").click();
    await expect(page.locator(".context-panel")).toHaveCount(3);
    // The tab's own panels stay in view, so the move is seen.
    await expect(page.locator("#ribbonContainer .panel")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Move Left" })).toBeDisabled();

    await page.getByRole("button", { name: "Move Right" }).click();
    expect((await namesIn(panelItems(page)))[1]).toBe("Button 1");

    await page.getByRole("button", { name: "Edit Type" }).first().click();
    await expect(page.locator("#buttonModal")).toBeVisible();
    await page.locator(".cancel-button").click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator(".panel-content > [data-name='Button 1']")).toHaveCount(0);
    await expect(page.locator("#ribbonContainer .panel")).toHaveCount(1);
  });

  test("a bundle row in the Project Browser selects that bundle", async ({ page }) => {
    await openBrowser(page);
    await page
      .locator("#folderPreview")
      .getByRole("button", { name: "Button 1.pushbutton", exact: true })
      .click();
    await expect(item(page, "Button 1")).toHaveClass(/is-selected/);
  });

  test("the preview shows the button on a light and a dark ribbon", async ({ page }) => {
    await expect(page.locator(".view-empty")).toBeVisible();
    await select(page, "Button 1");
    const preview = page.getByTestId("ribbon-preview");
    await expect(preview.locator(".preview-light")).toHaveCount(2);
    await expect(preview.locator(".preview-dark")).toHaveCount(2);
    await expect(preview).toContainText("Button 1");
  });

  test("a dark theme paints each button's dark icon", async ({ page, theme }) => {
    test.skip(!["revit-dark", "pyrevit"].includes(theme), "only a dark ribbon swaps icons");
    const icon = item(page, "Button 1").locator(".button-icon");
    await expect(icon).toHaveCSS("background-image", /url\(/);
    await expect(icon.locator("img")).toHaveCSS("opacity", "0");
  });
});
