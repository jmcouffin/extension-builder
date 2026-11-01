import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  acceptDialog,
  addCommand,
  addGroup,
  addStack,
  appDialog,
  drag,
  expect,
  item,
  openApp,
  test,
} from "./fixtures";

// Every folder suffix pyRevit's ExtensionParser recognises. Anything else is
// skipped silently on load.
const REAL_POSTFIXES = new Set([
  ".extension",
  ".tab",
  ".panel",
  ".pushbutton",
  ".pulldown",
  ".splitbutton",
  ".splitpushbutton",
  ".stack",
  ".smartbutton",
  ".panelbutton",
  ".linkbutton",
  ".invokebutton",
  ".urlbutton",
  ".content",
  ".nobutton",
  ".combobox",
]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

test.describe("export", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("downloads a ZIP that pyRevit would load", async ({ page }) => {
    await addStack(page);
    await addCommand(page, "Tool");
    await addGroup(page, "Tools");
    await drag(page, item(page, "Tool"), item(page, "Tools"));
    await expect(item(page, "Tools")).toHaveAttribute("title", /with 1 command/);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#downloadZip").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("My Extension.extension.zip");

    const path = await download.path();
    const zip = await JSZip.loadAsync(await readFile(path));
    const names = Object.keys(zip.files);

    const folders = names.filter((n) => n.endsWith("/"));
    for (const folder of folders) {
      const last = folder.slice(0, -1).split("/").pop() ?? "";
      const postfix = last.slice(last.lastIndexOf("."));
      expect(REAL_POSTFIXES.has(postfix), `${folder} has an unknown suffix`).toBe(true);
    }

    for (const expected of [
      "My Extension.extension/extension.json",
      "My Extension.extension/My Tab.tab/My Panel.panel/Button 1.pushbutton/script.py",
      "My Extension.extension/My Tab.tab/My Panel.panel/NEW STACK.stack/Button 2.pushbutton/bundle.yaml",
      "My Extension.extension/My Tab.tab/My Panel.panel/Tools.pulldown/Tool.pushbutton/script.py",
    ]) {
      expect(names).toContain(expected);
    }

    for (const bogus of ["__init__.py", "entrypoint.py", ".pyrevit"]) {
      expect(names.some((n) => n.endsWith(bogus))).toBe(false);
    }

    const icons = names.filter((n) => n.endsWith("icon.png"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const bytes = await zip.file(icon)?.async("uint8array");
      expect(bytes && [...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
      expect(bytes?.length ?? 0, `${icon} is a placeholder pixel`).toBeGreaterThan(200);
    }
  });

  test("refuses to export a broken extension, and lists why", async ({ page }) => {
    await page.getByRole("button", { name: "BUTTON", exact: true }).click();
    await page.locator(".button-type", { hasText: "Content Button" }).click();
    await page.getByLabel("Name (required)").fill("Family");
    await page.locator("#createButton").click();

    await page.locator("#downloadZip").click();
    await expect(appDialog(page)).toContainText("This extension will not work as built");
    await expect(appDialog(page).locator(".dialog-details li")).toContainText([/content\.rfa/]);
    await acceptDialog(page);
  });

  test("exports a saved layout to a file and imports it back", async ({ page }) => {
    await addStack(page);
    await page.locator("#extensionName").fill("Round Trip");
    await page.locator("#saveConfig").click();
    await acceptDialog(page);

    await page.locator("#loadConfig").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Round Trip to a file" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Round Trip_layout.json");
    const saved = await download.path();
    await page.keyboard.press("Escape");

    await page.locator("#resetToolbar").click();
    await acceptDialog(page, "Reset");
    await expect(page.locator(".stack")).toHaveCount(0);

    await page.locator("#loadConfig").click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import from file" }).click();
    await (await chooserPromise).setFiles(saved);
    await expect(page.locator("#extensionName")).toHaveValue("Round Trip");
    await expect(page.locator(".stack")).toHaveCount(1);
  });

  test("a file that is not a layout is refused in a dialog", async ({ page }) => {
    await page.locator("#loadConfig").click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import from file" }).click();
    await (await chooserPromise).setFiles({
      name: "nope.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json"),
    });
    await expect(appDialog(page)).toContainText("That file is not valid JSON.");
    await acceptDialog(page);
    await expect(page.locator(".panel")).toHaveCount(1);
  });
});
