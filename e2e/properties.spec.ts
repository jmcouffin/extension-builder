import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import JSZip from "jszip";
import {
  FIELDS,
  ORDER,
  SAMPLE_ASSEMBLY,
  SAMPLE_COMMAND_CLASS,
  SAMPLE_MEMBERS,
  TYPES,
  type TypeId,
} from "../src/domain/bundleTypes";
import {
  acceptDialog,
  addCommand,
  addStack,
  appDialog,
  expect,
  item,
  nameField,
  openApp,
  setType,
  test,
} from "./fixtures";

const palette = (page: Page) => page.locator("#propertiesPalette");

/** The value cell of a parameter row, found by its label. */
function cell(page: Page, label: string) {
  return palette(page)
    .locator(".prop-row")
    .filter({
      has: page.locator(".prop-name", {
        hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`),
      }),
    });
}

async function zipFile(page: Page, endsWith: string) {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadZip").click();
  const zip = await JSZip.loadAsync(await readFile(await (await downloadPromise).path()));
  const name = Object.keys(zip.files).find((n) => n.endsWith(endsWith));
  expect(name, `${endsWith} is in the ZIP`).toBeTruthy();
  return (await zip.file(name ?? "")?.async("string")) ?? "";
}

async function yamlView(page: Page) {
  await page.getByRole("tab", { name: "bundle.yaml" }).click();
  return page.locator(".code-sheet pre");
}

const COMMANDS = ORDER.filter((id) => !TYPES[id].container);
const GROUPS: TypeId[] = ["pulldown", "splitbutton", "splitpushbutton"];

test.describe("creating", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("never opens a dialog, and selects what it made", async ({ page }) => {
    const panel = page.locator(".panel").first();
    await panel.getByRole("button", { name: "BUTTON", exact: true }).click();
    await expect(item(page, "Button 2")).toHaveClass(/is-selected/);
    await expect(nameField(page)).toHaveValue("Button 2");

    await panel.getByRole("button", { name: "GROUP", exact: true }).click();
    await expect(page.locator(".group.is-selected")).toHaveCount(1);
    await expect(palette(page).locator(".type-selector")).toContainText("Pulldown");

    await panel.getByRole("button", { name: "STACK", exact: true }).click();
    await expect(page.locator(".stack.is-selected")).toHaveCount(1);

    await page.locator(".group").first().locator(".button-icon").click();
    await page
      .getByTestId("group-editor")
      .getByRole("button", { name: /ADD COMMAND/ })
      .click();
    await expect(page.getByTestId("group-editor").locator("[data-button-id]")).toHaveCount(2);

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("double-click on a button puts the cursor in its Name", async ({ page }) => {
    await item(page, "Button 1").dblclick({ position: { x: 5, y: 5 } });
    await expect(nameField(page)).toBeFocused();
  });
});

test.describe("Properties", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("every command type shows all its parameters, required ones marked, groups open", async ({
    page,
  }) => {
    await item(page, "Button 1").locator(".button-icon").click();
    for (const id of COMMANDS) {
      await setType(page, id);
      const def = TYPES[id];
      for (const head of await palette(page).locator(".prop-group-head").all()) {
        await expect(head, `${id}: groups start open`).toHaveAttribute("aria-expanded", "true");
      }
      for (const key of def.fields) {
        const row = cell(page, FIELDS[key].label);
        await expect(row, `${id} shows ${key}`).toHaveCount(1);
        if (def.required?.includes(key)) {
          await expect(row, `${id}: ${key} is marked required`).toHaveClass(/is-required/);
          await expect(row, `${id}: ${key} starts filled`).not.toHaveClass(/is-missing/);
        }
      }
      if (def.icons?.length) await expect(cell(page, "Icon")).toHaveCount(1);
      if (def.script) await expect(cell(page, "Script")).toHaveCount(1);
      if (def.toggle) await expect(cell(page, "On Icon")).toHaveCount(1);
    }
  });

  test("every group type shows all its parameters", async ({ page }) => {
    await page
      .locator(".panel")
      .first()
      .getByRole("button", { name: "GROUP", exact: true })
      .click();
    for (const id of GROUPS) {
      await setType(page, id);
      for (const key of TYPES[id].fields) {
        await expect(cell(page, FIELDS[key].label), `${id} shows ${key}`).toHaveCount(1);
      }
    }
  });

  test("required parameters start with working values or samples", async ({ page }) => {
    await addCommand(page, "Docs");
    await setType(page, "urlbutton");
    await expect(cell(page, "Hyperlink").locator("input")).toHaveValue("https://pyrevitlabs.io");

    await setType(page, "content");
    await expect(cell(page, "Family File").locator("input")).toHaveValue("content.rfa");

    await setType(page, "combobox");
    await expect(cell(page, "Members").locator("textarea")).toHaveValue(SAMPLE_MEMBERS);

    await setType(page, "linkbutton");
    await expect(cell(page, "Assembly").locator("input")).toHaveValue(SAMPLE_ASSEMBLY);
    await expect(cell(page, "Command Class").locator("input")).toHaveValue(SAMPLE_COMMAND_CLASS);
    await expect(page.locator(".status-samples")).toContainText("2 sample values to replace");

    await cell(page, "Assembly").locator("input").fill("RevitLookup");
    await cell(page, "Assembly").locator("input").press("Enter");
    await expect(page.locator(".status-samples")).toContainText("1 sample value to replace");
  });

  test("an emptied required parameter is marked and blocks the download", async ({ page }) => {
    await addCommand(page, "Docs");
    await setType(page, "urlbutton");
    const hyperlink = cell(page, "Hyperlink");
    await hyperlink.locator("input").fill("");
    await hyperlink.locator("input").press("Enter");
    await expect(hyperlink).toHaveClass(/is-missing/);
    await page.locator("#downloadZip").click();
    await expect(appDialog(page)).toContainText("Hyperlink");
    await acceptDialog(page);
  });

  test("yes/no, version and engine parameters reach bundle.yaml and the ZIP", async ({ page }) => {
    await addCommand(page, "Tool");
    await cell(page, "Beta").locator("input").check();
    await cell(page, "Clean Engine").locator("input").check();
    await cell(page, "Large Icon").locator("input").check();
    await cell(page, "Min Revit Version").locator("select").selectOption("2024");
    await cell(page, "Highlight").locator("select").selectOption("new");
    await cell(page, "Author").locator("input").fill("Jean-Marc");
    await cell(page, "Author").locator("input").press("Enter");

    const yaml = await yamlView(page);
    await expect(yaml).toContainText("is_beta: true");
    await expect(yaml).toContainText("large_icon: true");
    await expect(yaml).toContainText("min_revit_version: 2024");
    await expect(yaml).toContainText('highlight: "new"');
    await expect(yaml).toContainText('author: "Jean-Marc"');
    await expect(yaml).toContainText(/engine:\s+clean: true/);

    const file = await zipFile(page, "Tool.pushbutton/bundle.yaml");
    expect(file).toMatch(/engine:\n {2}clean: true/);
    expect(file).toContain("is_beta: true");
  });

  test("the script is edited in the drawing area and reaches the ZIP", async ({ page }) => {
    await addCommand(page, "Tool");
    await cell(page, "Script").getByRole("button", { name: "Edit" }).click();
    const editor = page.locator(".code-editor");
    await expect(editor).toHaveValue(/__title__ = "Tool"/);
    await editor.fill('print("hello from the builder")');
    await nameField(page).click();
    await expect(cell(page, "Script")).toContainText("(edited)");
    expect(await zipFile(page, "Tool.pushbutton/script.py")).toBe(
      'print("hello from the builder")',
    );
  });

  test("combo box members are edited in place", async ({ page }) => {
    await addCommand(page, "Pick");
    await setType(page, "combobox");
    const members = cell(page, "Members").locator("textarea");
    await members.fill("- id: a\n  text: Alpha");
    await nameField(page).click();
    await expect(await yamlView(page)).toContainText("text: Alpha");
  });

  test("a stack becomes a pulldown in the Type Selector", async ({ page }) => {
    await addStack(page);
    await expect(page.locator(".stack.is-selected")).toHaveCount(1);
    await setType(page, "pulldown");
    await expect(page.locator(".stack")).toHaveCount(0);
    await expect(page.locator(".group.pulldown")).toHaveCount(1);
  });
});
