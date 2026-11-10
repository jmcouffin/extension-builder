import { EXAMPLE_SPEC } from "../src/api/spec";
import { expect, item, openApp, test } from "./fixtures";

// The browser's own WebMCP, not a fake: Chromium with the feature behind
// chrome://flags/#enable-webmcp-testing turned on. Its document.modelContext
// also has the agent's side, getTools() and executeTool(tool, jsonArgs), so
// the page's tools run exactly as an agent in the browser would run them.
test.use({ launchOptions: { args: ["--enable-features=WebMCPTesting"] } });

interface NativeTool {
  name: string;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}
interface NativeModelContext {
  getTools(): Promise<NativeTool[]>;
  executeTool(tool: NativeTool, args: string): Promise<string>;
}

/** Call a tool through the browser, and parse the JSON it hands the agent. */
async function run(page: import("@playwright/test").Page, name: string, input: unknown = {}) {
  const text = await page.evaluate(
    async ([name, args]) => {
      const context = (document as unknown as { modelContext: NativeModelContext }).modelContext;
      const tool = (await context.getTools()).find((t) => t.name === name);
      if (!tool) throw new Error(`no tool ${name}`);
      return context.executeTool(tool, args);
    },
    [name, JSON.stringify(input)] as const,
  );
  return JSON.parse(text);
}

test.describe("the browser's own WebMCP", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    test.skip(
      !(await page.evaluate(() => "modelContext" in document)),
      "this Chromium has no WebMCP behind the flag",
    );
  });

  test("lists the six tools, with their hints", async ({ page }) => {
    const tools = await page.evaluate(async () =>
      (
        await (document as unknown as { modelContext: NativeModelContext }).modelContext.getTools()
      ).map((t) => ({
        name: t.name,
        readOnly: !!t.annotations?.readOnlyHint,
        untrusted: !!t.annotations?.untrustedContentHint,
      })),
    );
    expect(tools.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "download_extension", readOnly: false, untrusted: false },
      { name: "edit_extension", readOnly: false, untrusted: false },
      { name: "get_extension", readOnly: true, untrusted: true },
      { name: "get_extension_schema", readOnly: true, untrusted: false },
      { name: "set_extension", readOnly: false, untrusted: false },
      { name: "validate_extension", readOnly: true, untrusted: false },
    ]);
  });

  test("an agent builds, reads back and downloads an extension", async ({ page }) => {
    const set = await run(page, "set_extension", { spec: EXAMPLE_SPEC });
    // The agent gets the tool's own result: no JSON in a string in JSON.
    expect(set).toMatchObject({ ok: true, problems: [] });
    expect(set).not.toHaveProperty("content");
    for (const name of ["Renumber", "Docs", "Auto Save", "Export"]) {
      await expect(item(page.locator("#ribbonContainer"), name)).toBeVisible();
    }

    expect((await run(page, "get_extension")).spec).toEqual(EXAMPLE_SPEC);
    expect(
      await run(page, "edit_extension", {
        edits: [
          { op: "update", path: ["Acme", "Sheets", "Help", "Docs"], set: { tooltip: "Read me" } },
        ],
      }),
    ).toMatchObject({ ok: true, problems: [] });
    const docs = (await run(page, "get_extension")).spec.tabs[0].panels[0].items[1].items[0];
    expect(docs).toMatchObject({ name: "Docs", tooltip: "Read me" });
    expect(
      await run(page, "validate_extension", {
        spec: {
          name: "X",
          tabs: [{ name: "T", panels: [{ name: "P", items: [{ type: "button", name: "B" }] }] }],
        },
      }),
    ).toMatchObject({ ok: false, errors: [{ path: "tabs[0].panels[0].items[0].type" }] });

    const downloadPromise = page.waitForEvent("download");
    expect(await run(page, "download_extension")).toMatchObject({
      ok: true,
      file_name: "Acme Tools.extension.zip",
    });
    expect((await downloadPromise).suggestedFilename()).toBe("Acme Tools.extension.zip");
  });
});
