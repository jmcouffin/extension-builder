import { acceptDialog, addStack, appDialog, draft, expect, item, openApp, test } from "./fixtures";

test.describe("ribbon", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("adds, renames, switches and deletes tabs", async ({ page }) => {
    await page.locator("#addTab").click();
    await expect(page.locator(".tab")).toHaveCount(2);
    await expect(page.locator(".tab.active .tab-name")).toHaveValue("NEW TAB");
    await expect(page.locator(".panel-name")).toHaveValue("NEW PANEL");

    await page.locator(".tab.active .tab-name").fill("Tools");
    await page.locator(".tab.active .tab-name").press("Enter");
    await expect(page.locator("#folderPreview")).toContainText("Tools.tab", {
      useInnerText: false,
    });

    await page
      .locator(".tab")
      .first()
      .click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".panel-name")).toHaveValue("My Panel");

    await page.locator(".tab").nth(1).hover();
    await page.locator(".tab").nth(1).locator(".tab-delete-button").click();
    await expect(page.locator(".tab")).toHaveCount(1);
  });

  test("a duplicate tab name is refused in an app dialog", async ({ page }) => {
    await page.locator("#addTab").click();
    const input = page.locator(".tab.active .tab-name");
    await input.fill("my tab");
    await input.press("Enter");
    await expect(appDialog(page)).toContainText("Tab name already exists");
    await acceptDialog(page);
    await expect(input).toHaveValue("NEW TAB");
  });

  test("the last tab and the last panel cannot be deleted", async ({ page }) => {
    await page.locator(".tab").hover();
    await page.locator(".tab-delete-button").click();
    await expect(appDialog(page)).toContainText("Cannot delete the last tab");
    await acceptDialog(page);

    await page.locator(".panel").hover();
    await page.locator(".panel-delete-button").click();
    await expect(appDialog(page)).toContainText("Cannot delete the last panel");
    await acceptDialog(page);
    await expect(page.locator(".panel")).toHaveCount(1);
  });

  test("adds a panel beside the current one", async ({ page }) => {
    await page.locator(".add-panel-inline").click();
    await expect(page.locator(".panel")).toHaveCount(2);
    await expect(page.locator(".panel-name").nth(1)).toHaveValue("NEW PANEL");
    await page.locator(".panel").nth(1).hover();
    await page.locator(".panel").nth(1).locator(".panel-delete-button").click();
    await expect(page.locator(".panel")).toHaveCount(1);
  });

  test("click on a name renames the command in place", async ({ page }) => {
    await item(page, "Button 1").locator(".button-name").click();
    const input = item(page, "Button 1").locator(".button-name input");
    await input.fill("Renamed");
    await input.press("Enter");
    await expect(item(page, "Renamed")).toBeVisible();
  });

  test("deleting a stack with commands asks in an app dialog", async ({ page }) => {
    await addStack(page);
    const stack = item(page, "NEW STACK");
    await stack.hover({ position: { x: 3, y: 3 } });
    await stack.locator(":scope > .element-delete-button").click();
    await expect(appDialog(page)).toContainText("contains 2 command(s)");
    await acceptDialog(page, "Cancel");
    await expect(stack).toBeVisible();

    await stack.hover({ position: { x: 3, y: 3 } });
    await stack.locator(":scope > .element-delete-button").click();
    await acceptDialog(page, "Delete");
    await expect(page.locator(".stack")).toHaveCount(0);
  });

  test("the stack add row opens the modal for that stack", async ({ page }) => {
    await addStack(page);
    await page.locator(".stack-add-button").click();
    await page.locator("#createButton").click();
    await expect(page.locator(".stack .stack-items > .button")).toHaveCount(3);
    await expect(page.locator(".stack-add-button")).toHaveCount(0);
  });

  test("the draft survives a reload, and RESET discards it after confirming", async ({ page }) => {
    await addStack(page);
    await page.locator("#extensionName").fill("Kept");
    await expect.poll(async () => (await draft(page))?.extensionName).toBe("Kept");
    await page.reload();
    await expect(page.locator("#extensionName")).toHaveValue("Kept");
    await expect(page.locator(".stack")).toHaveCount(1);

    await page.locator("#resetToolbar").click();
    await expect(appDialog(page)).toContainText("Discard the whole toolbar?");
    await acceptDialog(page, "Cancel");
    await expect(page.locator(".stack")).toHaveCount(1);

    await page.locator("#resetToolbar").click();
    await acceptDialog(page, "Reset");
    await expect(page.locator(".stack")).toHaveCount(0);
    await expect(page.locator("#extensionName")).toHaveValue("My Extension");
    await page.reload();
    await expect(page.locator(".stack")).toHaveCount(0);
  });

  test("the extension name warns when it will be rewritten", async ({ page }) => {
    await page.locator("#extensionName").fill(".bad:name");
    await expect(page.locator("#extensionNameHint")).toHaveText("Saved as bad name.extension");
    await page.locator("#extensionName").fill("");
    await expect(page.locator("#extensionNameHint")).toHaveText("Give the extension a name");
  });
});

test.describe("history", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("undo and redo step back and forward through changes", async ({ page }) => {
    await expect(page.locator("#undoAction")).toBeDisabled();
    await expect(page.locator("#redoAction")).toBeDisabled();

    await page.locator("#addTab").click();
    await expect(page.locator(".tab")).toHaveCount(2);
    await page.locator("#undoAction").click();
    await expect(page.locator(".tab")).toHaveCount(1);
    await expect(page.locator("#redoAction")).toBeEnabled();
    await page.locator("#redoAction").click();
    await expect(page.locator(".tab")).toHaveCount(2);
  });

  test("Ctrl/Cmd+Z and Shift+Z work outside text fields", async ({ page }) => {
    await page.locator("#addTab").click();
    await expect(page.locator(".tab")).toHaveCount(2);
    await page.locator("body").press("ControlOrMeta+z");
    await expect(page.locator(".tab")).toHaveCount(1);
    await page.locator("body").press("ControlOrMeta+Shift+z");
    await expect(page.locator(".tab")).toHaveCount(2);
  });

  test("typing in a field keeps the browser's own undo", async ({ page }) => {
    await page.locator("#addTab").click();
    await page.locator("#extensionName").fill("Other");
    await page.locator("#extensionName").press("ControlOrMeta+z");
    await expect(page.locator(".tab")).toHaveCount(2);
  });
});

test.describe("saved layouts", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("Save keeps the ribbon in the browser and Load brings it back", async ({ page }) => {
    await page.locator("#extensionName").fill("Alpha");
    await page.locator("#addTab").click();
    await expect(page.locator(".tab")).toHaveCount(2);

    await page.locator("#saveConfig").click();
    await acceptDialog(page);

    await page.locator("#resetToolbar").click();
    await acceptDialog(page, "Reset");
    await expect(page.locator(".tab")).toHaveCount(1);

    await page.locator("#loadConfig").click();
    const row = page.locator('[data-save-name="Alpha"]');
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Load" }).click();
    await expect(page.locator(".tab")).toHaveCount(2);
    await expect(page.locator("#extensionName")).toHaveValue("Alpha");
  });

  test("saving under the same name updates it; several saves are listed", async ({ page }) => {
    await page.locator("#extensionName").fill("Alpha");
    await page.locator("#saveConfig").click();
    await acceptDialog(page);
    await page.locator("#addTab").click();
    await page.locator("#saveConfig").click();
    await acceptDialog(page);
    await page.locator("#extensionName").fill("Beta");
    await page.locator("#saveConfig").click();
    await acceptDialog(page);

    await page.locator("#loadConfig").click();
    await expect(page.locator(".saved-row")).toHaveCount(2);
  });

  test("a save can be deleted, and an empty list explains itself", async ({ page }) => {
    await page.locator("#loadConfig").click();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.locator("#saveConfig").click();
    await acceptDialog(page);
    await page.locator("#loadConfig").click();
    await page.getByRole("button", { name: /Delete My Extension/ }).click();
    await acceptDialog(page, "Delete");
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });

  test("saves survive a reload", async ({ page }) => {
    await page.locator("#saveConfig").click();
    await acceptDialog(page);
    await page.reload();
    await page.locator("#loadConfig").click();
    await expect(page.locator(".saved-row")).toHaveCount(1);
  });
});
