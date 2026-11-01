import {
  acceptDialog,
  addCommand,
  addGroup,
  addStack,
  appDialog,
  drag,
  expect,
  item,
  namesIn,
  openApp,
  panelItems,
  test,
} from "./fixtures";

test.describe("drag and drop", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("reorders commands inside a panel", async ({ page }) => {
    await addCommand(page, "Second");
    await addCommand(page, "Third");
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Button 1", "Second", "Third"]);

    await drag(page, item(page, "Button 1"), item(page, "Third"), { x: 0.9 });
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Second", "Third", "Button 1"]);

    await drag(page, item(page, "Third"), item(page, "Second"), { x: 0.1 });
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Third", "Second", "Button 1"]);
    await expect(page.locator("#folderPreview")).toHaveText(
      /Third\.pushbutton[\s\S]*Second\.pushbutton[\s\S]*Button 1\.pushbutton/,
      { useInnerText: false },
    );
  });

  test("moves a command into a stack and back out", async ({ page }) => {
    await addCommand(page, "Loose");
    await addStack(page);
    const stack = item(page, "NEW STACK");
    await drag(page, item(page, "Loose"), stack, { x: 0.5, y: 0.9 });
    await expect(stack.locator(".stack-items > .button")).toHaveCount(3);
    await expect(stack.locator('.stack-items > [data-name="Loose"]')).toBeVisible();
    await expect(page.locator(".stack-add-button")).toHaveCount(0);

    await drag(page, stack.locator('[data-name="Loose"]'), item(page, "Button 1"), { x: 0.9 });
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Button 1", "Loose", "NEW STACK"]);
    await expect(stack.locator(".stack-items > .button")).toHaveCount(2);
  });

  test("reorders rows inside a stack", async ({ page }) => {
    await addStack(page);
    const rows = page.locator(".stack .stack-items > [data-button-id]");
    await expect.poll(() => namesIn(rows)).toEqual(["Button 1", "Button 2"]);
    await drag(page, rows.nth(0), rows.nth(1), { y: 0.9 });
    await expect.poll(() => namesIn(rows)).toEqual(["Button 2", "Button 1"]);
  });

  test("moves a command into a pulldown, then out of its open list", async ({ page }) => {
    await addCommand(page, "Tool");
    await addGroup(page, "Tools");
    await drag(page, item(page, "Tool"), item(page, "Tools"));
    await expect(panelItems(page)).toHaveCount(2);
    await expect(item(page, "Tools")).toHaveAttribute("title", /with 1 command/);

    await item(page, "Tools").locator(".button-icon").click();
    const editor = page.getByTestId("group-editor");
    await expect(editor.locator('[data-name="Tool"]')).toBeVisible();

    await drag(page, editor.locator('[data-name="Tool"]'), item(page, "Button 1"), { x: 0.1 });
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Tool", "Button 1", "Tools"]);
    await expect(item(page, "Tools")).toHaveAttribute("title", /with 0 command/);
  });

  test("an illegal drop is refused with the reason, and nothing moves", async ({ page }) => {
    await addStack(page);
    await addStack(page);
    const before = await namesIn(panelItems(page));
    await drag(page, item(page, "NEW STACK 1"), item(page, "NEW STACK"), { x: 0.5, y: 0.5 });
    await expect(appDialog(page)).toContainText("Stack cannot contain Stack");
    await acceptDialog(page);
    await expect.poll(() => namesIn(panelItems(page))).toEqual(before);
  });

  test("a full stack refuses a fourth command", async ({ page }) => {
    await addCommand(page, "Extra");
    await addCommand(page, "More");
    await addStack(page);
    const stack = item(page, "NEW STACK");
    await drag(page, item(page, "Extra"), stack, { y: 0.9 });
    await expect(stack.locator(".stack-items > .button")).toHaveCount(3);
    await drag(page, item(page, "More"), stack.locator(".stack-items > .button").nth(1));
    await expect(appDialog(page)).toContainText("at most 3 commands");
    await acceptDialog(page);
    await expect(stack.locator(".stack-items > .button")).toHaveCount(3);
  });

  test("dragging does not break click, double-click or rename", async ({ page }) => {
    await addGroup(page, "Tools");
    await drag(page, item(page, "Tools"), item(page, "Button 1"), { x: 0.1 });
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Tools", "Button 1"]);

    await item(page, "Tools").locator(".button-icon").click();
    await expect(page.getByTestId("group-editor")).toBeVisible();
    await page.getByTestId("group-editor").getByRole("button", { name: "CLOSE" }).click();

    await item(page, "Button 1").dblclick({ position: { x: 5, y: 5 } });
    await expect(page.locator("#modalTitle")).toHaveText("Edit Push Button");
    await page.keyboard.press("Escape");

    await item(page, "Button 1").locator(".button-name").click();
    await expect(item(page, "Button 1").locator(".button-name input")).toBeFocused();
  });

  test("moves a command to another panel", async ({ page }) => {
    await page.locator(".add-panel-inline").click();
    await expect(page.locator(".panel")).toHaveCount(2);
    await drag(page, item(page, "Button 1"), page.locator(".panel-content").nth(1), { x: 0.8 });
    await expect(appDialog(page)).toContainText('"Button 1" already exists');
    await acceptDialog(page);
    await expect(panelItems(page, 0)).toHaveCount(1);

    await item(page, "Button 1").locator(".button-name").click();
    await item(page, "Button 1").locator(".button-name input").fill("Mover");
    await item(page, "Button 1").locator(".button-name input").press("Enter");
    await drag(page, item(page, "Mover"), page.locator(".panel-content").nth(1), { x: 0.8 });
    await expect(
      page.locator(".panel-content").nth(1).locator('[data-name="Mover"]'),
    ).toBeVisible();
    await expect(panelItems(page, 0)).toHaveCount(0);
  });

  test("reorders with the keyboard", async ({ page }) => {
    await addCommand(page, "Second");
    await item(page, "Button 1").focus();
    // dnd-kit measures drop targets a frame after pick-up; a person pressing
    // keys is never faster than that, a test is.
    const press = async (key: string) => {
      await page.keyboard.press(key);
      await page.waitForTimeout(60);
    };
    await press("Space");
    await expect(page.locator(".dnd-source")).toHaveCount(1);
    for (let i = 0; i < 4; i++) await press("ArrowRight");
    await press("Space");
    await expect.poll(() => namesIn(panelItems(page))).toEqual(["Second", "Button 1"]);
  });
});
