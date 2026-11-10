import { EXAMPLE_SPEC } from "../src/api/spec";
import { expect, item, openApp, test } from "./fixtures";

/** What the fake modelContext records: the tools as the page registered them. */
interface Recorded {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: unknown): Promise<unknown>;
}
type Recorder = { __webmcpTools: Recorded[] };

/**
 * Run a registered tool the way the browser does for an agent: call execute,
 * then serialize what it returns to JSON.
 */
async function run(page: import("@playwright/test").Page, name: string, input: unknown = {}) {
  return page.evaluate(
    async ([name, input]) => {
      const tool = (window as unknown as Recorder).__webmcpTools.find((t) => t.name === name);
      if (!tool) throw new Error(`no tool ${name}`);
      return JSON.parse(JSON.stringify(await tool.execute(input)));
    },
    [name, input] as const,
  );
}

test.describe("WebMCP", () => {
  test.beforeEach(async ({ page }) => {
    // A browser with WebMCP, as the current draft has it: document.modelContext.registerTool.
    await page.addInitScript(() => {
      const tools: Recorded[] = [];
      (window as unknown as Recorder).__webmcpTools = tools;
      Object.defineProperty(document, "modelContext", {
        configurable: true,
        value: {
          registerTool: async (tool: Recorded) => {
            tools.push(tool);
          },
        },
      });
    });
    await openApp(page);
  });

  test("registers the six tools, with short input schemas and an output schema", async ({
    page,
  }) => {
    const tools = await page.evaluate(() =>
      (window as unknown as Recorder).__webmcpTools.map((t) => ({
        name: t.name,
        readOnly: t.annotations?.readOnlyHint,
        type: t.inputSchema.type,
        args: Object.keys((t.inputSchema.properties as object | undefined) ?? {}),
        // The whole tool list stays small: no 29 KB schema inlined twice.
        small: JSON.stringify(t.inputSchema).length < 3000,
        output: (t as unknown as { outputSchema?: { required?: string[] } }).outputSchema?.required,
        described: t.description.length > 100,
      })),
    );
    const common = { type: "object", small: true, output: ["ok", "message"], described: true };
    expect(tools).toEqual([
      { name: "get_extension_schema", readOnly: true, args: [], ...common },
      { name: "get_extension", readOnly: true, args: ["include_icons"], ...common },
      { name: "validate_extension", readOnly: true, args: ["spec"], ...common },
      { name: "edit_extension", readOnly: false, args: ["edits"], ...common },
      { name: "set_extension", readOnly: false, args: ["spec"], ...common },
      { name: "download_extension", readOnly: false, args: [], ...common },
    ]);
  });

  test("an agent edits one button by name, keeping the rest", async ({ page }) => {
    await run(page, "set_extension", { spec: EXAMPLE_SPEC });
    const edited = await run(page, "edit_extension", {
      edits: [
        { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { name: "Renumber All" } },
        { op: "remove", path: ["Acme", "Sheets", "Export"] },
      ],
    });
    expect(edited).toMatchObject({ ok: true, problems: [] });
    const ribbon = page.locator("#ribbonContainer");
    await expect(item(ribbon, "Renumber All")).toBeVisible();
    await expect(item(ribbon, "Docs")).toBeVisible();
    await expect(ribbon.locator('[data-name="Export"]')).toHaveCount(0);

    // One undo step brings both edits back.
    await page.locator("#undoAction").click();
    await expect(item(ribbon, "Renumber")).toBeVisible();
    await expect(item(ribbon, "Export")).toBeVisible();
  });

  test("an agent builds an extension and downloads it", async ({ page }) => {
    const set = await run(page, "set_extension", { spec: EXAMPLE_SPEC });
    expect(set).toMatchObject({ ok: true, problems: [] });
    // The tool's own result, not an MCP envelope holding JSON in a string.
    expect(set).not.toHaveProperty("content");

    await expect(page.locator(".tab.active .tab-name")).toHaveValue("Acme");
    await expect(page.locator(".panel-name")).toHaveValue("Sheets");
    const ribbon = page.locator("#ribbonContainer");
    for (const name of ["Renumber", "Docs", "Auto Save", "Export"]) {
      await expect(item(ribbon, name)).toBeVisible();
    }

    const read = await run(page, "get_extension");
    expect(read.spec).toEqual(EXAMPLE_SPEC);

    const downloadPromise = page.waitForEvent("download");
    const done = await run(page, "download_extension");
    const download = await downloadPromise;
    expect(done).toMatchObject({ ok: true, file_name: "Acme Tools.extension.zip" });
    expect(download.suggestedFilename()).toBe("Acme Tools.extension.zip");
  });

  test("a malformed spec is refused and the ribbon is left alone", async ({ page }) => {
    const refused = await run(page, "set_extension", {
      spec: {
        name: "X",
        tabs: [{ name: "T", panels: [{ name: "P", items: [{ type: "button" }] }] }],
      },
    });
    expect(refused).toMatchObject({ ok: false });
    expect(refused.errors.length).toBeGreaterThan(0);
    await expect(page.locator("#ribbonContainer .panel")).toHaveCount(1);
    await expect(page.locator(".tab.active .tab-name")).not.toHaveValue("T");
  });
});

test.describe("window.pyrevitBuilder", () => {
  test("drives the builder by script, without WebMCP", async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => "modelContext" in document)).toBe(false);
    const result = await page.evaluate(() => window.pyrevitBuilder?.call("get_extension", {}));
    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(result?.spec).toMatchObject({ version: 1, tabs: [expect.anything()] });

    await page.evaluate((spec) => window.pyrevitBuilder?.setExtension(spec), EXAMPLE_SPEC);
    await expect(item(page.locator("#ribbonContainer"), "Renumber")).toBeVisible();
  });
});
