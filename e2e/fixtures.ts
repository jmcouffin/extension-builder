import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * Every test fails on an uncaught page error, a console error, a failed
 * request, or a native alert/confirm/prompt. The app must only ever talk to
 * the user through its own dialogs.
 */
export const test = base.extend<{ problems: string[]; theme: string }>({
  // Which theme the project runs in. Set per project in playwright.config.ts,
  // where the choice is seeded into localStorage before the page loads.
  theme: ["builder", { option: true }],
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
      });
      page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
      page.on("dialog", async (d) => {
        problems.push(`native ${d.type()}: ${d.message()}`);
        await d.dismiss();
      });
      await use(problems);
      expect(problems, "page reported problems").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator("#ribbonContainer .panel")).toHaveCount(1);
}

export function item(page: Page | Locator, name: string): Locator {
  return page.locator(`[data-button-id][data-name="${name}"]`).first();
}

export function panelItems(page: Page, panelIndex = 0): Locator {
  return page.locator(".panel-content").nth(panelIndex).locator(":scope > [data-button-id]");
}

export async function namesIn(list: Locator): Promise<string[]> {
  return list.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-name") ?? ""));
}

export function appDialog(page: Page): Locator {
  return page.getByTestId("app-dialog");
}

/** Close the app's own dialog with its primary button. */
export async function acceptDialog(page: Page, label = "OK") {
  await appDialog(page).getByRole("button", { name: label, exact: true }).click();
  await expect(appDialog(page)).toHaveCount(0);
}

/**
 * Drag with a real pointer, the way dnd-kit's PointerSensor expects: press,
 * travel past the activation distance, glide to the target, release. `at`
 * is where on the target to let go, as a fraction of its box.
 */
export async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  at: { x?: number; y?: number } = {},
) {
  const grab = await handleOf(source);
  await grab.scrollIntoViewIfNeeded();
  const from = await grab.boundingBox();
  if (!from) throw new Error("drag source is not visible");
  const sx = from.x + Math.min(from.width / 2, 20);
  const sy = from.y + Math.min(from.height / 2, 12);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10, { steps: 4 });

  const to = await target.boundingBox();
  if (!to) throw new Error("drag target is not visible");
  const tx = to.x + to.width * (at.x ?? 0.5);
  const ty = to.y + to.height * (at.y ?? 0.5);
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.move(tx + 1, ty, { steps: 2 });
  await page.mouse.up();
  // dnd-kit swallows clicks for 50ms after a drop, so the release is not
  // read as a click. A person never clicks again that fast; a test does.
  await page.waitForTimeout(80);
}

/** The part of an item that picks it up: a stack's grip, or the item itself. */
export async function handleOf(target: Locator): Promise<Locator> {
  const grip = target.locator(":scope > .stack-grip");
  return (await grip.count()) ? grip : target;
}

export async function addCommand(page: Page, name: string, panelIndex = 0) {
  await page
    .locator(".panel")
    .nth(panelIndex)
    .getByRole("button", { name: "BUTTON", exact: true })
    .click();
  await page.getByLabel("Name (required)").fill(name);
  await page.locator("#createButton").click();
  await expect(page.locator("#buttonModal")).toHaveCount(0);
  await expect(item(page, name)).toBeVisible();
}

export async function addGroup(page: Page, name: string, type = "Pulldown") {
  await page.locator(".panel").first().getByRole("button", { name: "GROUP", exact: true }).click();
  await page.locator(".button-type", { hasText: type }).first().click();
  await page.getByLabel("Name (required)").fill(name);
  await page.locator("#createButton").click();
  await expect(item(page, name)).toBeVisible();
}

export async function addStack(page: Page) {
  await page.locator(".panel").first().getByRole("button", { name: "STACK", exact: true }).click();
}

/** The layout in localStorage, once the debounced draft write has landed. */
export async function draft(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("pyrevit-extension-builder:draft:v2") ?? "null"),
  );
}
