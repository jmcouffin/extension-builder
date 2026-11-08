import { EXAMPLE_SPEC } from "../src/api/spec";
import { acceptDialog, addCommand, appDialog, expect, item, openApp, test } from "./fixtures";

const link = (spec: unknown) => `/#spec=${encodeURIComponent(JSON.stringify(spec))}`;

test.describe("import link", () => {
  test("opens the extension a link carries, then takes it out of the URL", async ({ page }) => {
    await page.goto(link(EXAMPLE_SPEC));
    await expect(page.locator("#extensionName")).toHaveValue("Acme Tools");
    await expect(page.locator(".tab.active .tab-name")).toHaveValue("Acme");
    await expect(page.locator(".panel-name")).toHaveValue("Sheets");
    for (const name of ["Renumber", "Docs", "Auto Save", "Export"]) {
      await expect(item(page, name)).toBeVisible();
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
    // A reload opens the draft, not the link again.
    await page.reload();
    await expect(page.locator("#extensionName")).toHaveValue("Acme Tools");
  });

  test("a broken spec is refused with where it is wrong", async ({ page }) => {
    await page.goto(
      link({
        name: "X",
        tabs: [
          { name: "T", panels: [{ name: "P", items: [{ type: "urlbutton", name: "Docs" }] }] },
        ],
      }),
    );
    await expect(appDialog(page)).toContainText("tabs[0].panels[0].items[0].hyperlink is required");
    await acceptDialog(page);
    await expect(page.locator("#extensionName")).toHaveValue("My Extension");
  });

  test("asks before replacing work in progress; Undo brings it back", async ({ page }) => {
    await openApp(page);
    await addCommand(page, "Mine");
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, link(EXAMPLE_SPEC).slice(2));
    await expect(appDialog(page)).toContainText('Open "Acme Tools" from this link?');
    await acceptDialog(page, "Open");
    await expect(page.locator("#extensionName")).toHaveValue("Acme Tools");

    await page.locator("#undoAction").click();
    await expect(item(page, "Mine")).toBeVisible();
  });

  test("Load opens a spec file as well as a saved layout", async ({ page }) => {
    await openApp(page);
    await page.locator("#loadConfig").click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import from file" }).click();
    await (await chooserPromise).setFiles({
      name: "acme.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(EXAMPLE_SPEC)),
    });
    await expect(page.locator("#extensionName")).toHaveValue("Acme Tools");
    await expect(item(page, "Renumber")).toBeVisible();
  });
});

test.describe("published API files", () => {
  test("llms.txt, the schema and the example are served", async ({ page }) => {
    const llms = await page.request.get("/llms.txt");
    expect(llms.ok()).toBe(true);
    const text = await llms.text();
    expect(text).toMatch(/^# pyRevit Extension Builder/);
    expect(text).toContain("#spec=");
    expect(text).toContain("| `urlbutton` | .urlbutton |");

    const schema = await (await page.request.get("/api/extension.schema.json")).json();
    expect(Object.keys(schema.$defs)).toContain("pushbutton");

    const example = await (await page.request.get("/api/example.json")).json();
    expect(example).toEqual(EXAMPLE_SPEC);
  });

  test("the example in llms.txt opens as it is", async ({ page }) => {
    const text = await (await page.request.get("/llms.txt")).text();
    const url = text.match(/Example: (https:\/\/\S+)/)?.[1] ?? "";
    expect(url).toContain("#spec=");
    await page.goto(`/${new URL(url).hash}`);
    await expect(page.locator("#extensionName")).toHaveValue("Hello");
    await expect(item(page, "Say Hi")).toBeVisible();
  });
});
