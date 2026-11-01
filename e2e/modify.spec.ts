import type { Page } from "@playwright/test";
import {
  addGroup,
  addStack,
  expect,
  item,
  namesIn,
  openApp,
  panelItems,
  select,
  test,
} from "./fixtures";

/** Select a bundle and open its "Modify | <type>" tab. */
async function modify(page: Page, name: string) {
  await select(page, name);
  await page.locator("#contextTab").click();
  await expect(page.locator(".context-panel")).toHaveCount(3);
}

const command = (page: Page, name: string) =>
  page.locator(".context-panel").getByRole("button", { name, exact: true });

test.describe("the Modify tab", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("Duplicate copies the selection next to it and selects the copy", async ({ page }) => {
    await modify(page, "Button 1");
    await command(page, "Duplicate").click();
    expect(await namesIn(panelItems(page))).toEqual(["Button 1", "Button 1 copy"]);
    await expect(item(page, "Button 1 copy")).toHaveClass(/is-selected/);
    // The Modify tab stays open on the copy.
    await expect(page.locator("#contextTab")).toHaveText("Modify | Push Button");
  });

  test("Move to sends a bundle to another tab, renamed there, in one undo", async ({ page }) => {
    await page.locator("#addTab").click();
    await page
      .locator(".tab")
      .first()
      .click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".panel-name")).toHaveValue("My Panel");
    await modify(page, "Button 1");

    await page.locator("#moveToButton").click();
    const menu = page.getByTestId("move-menu");
    await expect(menu).toContainText("NEW TAB");
    const target = menu.getByRole("menuitem").filter({ hasText: "NEW PANEL" });
    await expect(target).toContainText("Button 1 1");
    await target.click();

    await expect(page.locator(".panel-name")).toHaveValue("NEW PANEL");
    expect(await namesIn(panelItems(page))).toEqual(["Button 1", "Button 1 1"]);
    await expect(item(page, "Button 1 1")).toHaveClass(/is-selected/);

    await page.keyboard.press("Control+z");
    await expect(page.locator(".panel-name")).toHaveValue("My Panel");
    expect(await namesIn(panelItems(page))).toEqual(["Button 1"]);
  });

  test("Move to greys a place pyRevit would not load, with the reason", async ({ page }) => {
    await addStack(page);
    await addGroup(page, "Tools");
    await page.locator(".stack .stack-grip").click();
    await expect(page.locator(".stack.is-selected")).toHaveCount(1);
    await page.locator("#contextTab").click();
    await page.locator("#moveToButton").click();
    const group = page.getByTestId("move-menu").getByRole("menuitem").filter({ hasText: "Tools" });
    await expect(group).toHaveAttribute("data-disabled", "");
    await expect(group).toContainText("cannot contain Stack");
  });

  test("Wrap in Stack puts the button in a stack with a second command", async ({ page }) => {
    await modify(page, "Button 1");
    await command(page, "Wrap in Stack").click();
    await expect(page.locator(".stack.is-selected")).toHaveCount(1);
    expect(await namesIn(page.locator(".stack [data-button-id]"))).toEqual([
      "Button 1",
      "Button 2",
    ]);
    await expect(page.locator("#contextTab")).toHaveText("Modify | Stack");
    // A stack can't be wrapped in another stack.
    await expect(command(page, "Wrap in Stack")).toBeDisabled();
  });

  test("Wrap in Pulldown, then Ungroup, puts the button back", async ({ page }) => {
    await modify(page, "Button 1");
    await expect(command(page, "Ungroup")).toBeDisabled();
    await command(page, "Wrap in Pulldown").click();
    await expect(page.locator(".group.pulldown.is-selected")).toHaveCount(1);
    await expect(page.locator("#contextTab")).toHaveText("Modify | Pulldown");
    await expect(command(page, "Wrap in Pulldown")).toBeDisabled();

    await command(page, "Ungroup").click();
    await expect(page.locator(".group")).toHaveCount(0);
    expect(await namesIn(panelItems(page))).toEqual(["Button 1"]);
    await expect(item(page, "Button 1")).toHaveClass(/is-selected/);
  });
});
