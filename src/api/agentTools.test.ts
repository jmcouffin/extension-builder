import Ajv2020 from "ajv/dist/2020";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHistory, useStore } from "../state/store";
import { AGENT_TOOLS, argumentsOf, callTool } from "./agentTools";
import { EXAMPLE_SPEC } from "./spec";

vi.mock("../domain/zip", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/zip")>()),
  downloadBlob: vi.fn(),
}));
vi.mock("../state/defaultIcons", () => ({
  loadDefaultIcons: vi.fn(async () => ({ light: null, dark: null })),
}));

const { downloadBlob } = await import("../domain/zip");

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const one = (bundle: Record<string, unknown>) => ({
  name: "X",
  tabs: [{ name: "T", panels: [{ name: "P", items: [bundle] }] }],
});
/** A spec that reads, but pyRevit would skip: a stack needs two bundles. */
const LONE_STACK = one({ type: "stack", name: "S", items: [{ type: "pushbutton", name: "A" }] });

const names = () => Object.values(useStore.getState().elements).map((e) => e.name);

beforeEach(() => {
  useStore.getState().reset();
  clearHistory();
  vi.mocked(downloadBlob).mockClear();
});

describe("agent tools", () => {
  it("declares the six tools, read-only where they only read", () => {
    expect(AGENT_TOOLS.map((t) => [t.name, t.readOnly])).toEqual([
      ["get_extension_schema", true],
      ["get_extension", true],
      ["validate_extension", true],
      ["edit_extension", false],
      ["set_extension", false],
      ["download_extension", false],
    ]);
    for (const tool of AGENT_TOOLS) {
      expect(tool.description).toContain("llms.txt");
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("gives spec-taking tools a short input schema that points to get_extension_schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const name of ["validate_extension", "set_extension"]) {
      const tool = AGENT_TOOLS.find((t) => t.name === name);
      const schema = tool?.inputSchema ?? {};
      // Not the 29 KB extension schema, loaded twice before any call.
      expect(JSON.stringify(schema).length).toBeLessThan(1500);
      expect(JSON.stringify(schema)).toContain("get_extension_schema");
      const check = ajv.compile(schema);
      expect(check({ spec: EXAMPLE_SPEC }), JSON.stringify(check.errors)).toBe(true);
      expect(check({})).toBe(false);
    }
  });

  it("checks the spec itself, as browsers don't check arguments against inputSchema", async () => {
    // Accepted by the short schema, refused by the tool, with the path.
    const result = await callTool("validate_extension", {
      spec: one({ type: "button", name: "B" }),
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ path: "tabs[0].panels[0].items[0].type" }),
    ]);
    expect((await callTool("set_extension", { spec: [1] })).ok).toBe(false);
  });

  it("declares an outputSchema every result matches, refusals included", async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const calls: [string, unknown][] = [
      ["get_extension_schema", {}],
      ["get_extension", {}],
      ["get_extension", { include_icons: true }],
      ["validate_extension", { spec: EXAMPLE_SPEC }],
      ["validate_extension", { spec: one({ type: "button", name: "B" }) }],
      ["edit_extension", { edits: [{ op: "update", path: ["Nope"], set: { name: "X" } }] }],
      ["set_extension", { spec: { name: "X" } }],
      ["set_extension", { spec: EXAMPLE_SPEC }],
      [
        "edit_extension",
        { edits: [{ op: "update", path: ["Acme", "Sheets", "Renumber"], set: { tooltip: "T" } }] },
      ],
      ["download_extension", {}],
      ["get_extension", { includeIcons: true }],
    ];
    for (const [name, input] of calls) {
      const tool = AGENT_TOOLS.find((t) => t.name === name);
      const check = ajv.compile(tool?.outputSchema ?? {});
      const result = await callTool(name, input);
      expect(check(result), `${name}: ${JSON.stringify(check.errors)}`).toBe(true);
    }
  });

  it("get_extension_schema returns the JSON Schema", async () => {
    const result = await callTool("get_extension_schema");
    expect(result.ok).toBe(true);
    expect(result.schema).toMatchObject({ title: "pyRevit extension", required: ["name", "tabs"] });
  });

  it("get_extension returns the builder's extension, its problems and warnings", async () => {
    const result = await callTool("get_extension", {});
    expect(result.ok).toBe(true);
    expect(result.spec).toMatchObject({ version: 1, name: useStore.getState().extensionName });
    expect(result.problems).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("get_extension leaves custom icons out unless asked, and says so", async () => {
    await callTool("set_extension", { spec: one({ type: "pushbutton", name: "A", icon: PNG }) });
    const without = await callTool("get_extension", {});
    expect(JSON.stringify(without.spec)).not.toContain(PNG);
    expect(without.message).toMatch(/1 custom icon left out.*include_icons: true/);
    const withIcons = await callTool("get_extension", { include_icons: true });
    expect(JSON.stringify(withIcons.spec)).toContain(PNG);
    expect(withIcons.message).not.toMatch(/left out/);
  });

  it("validate_extension reports errors, problems and warnings, and changes nothing", async () => {
    const before = useStore.getState().elements;

    const good = await callTool("validate_extension", { spec: EXAMPLE_SPEC });
    expect(good).toMatchObject({ ok: true, errors: [], problems: [], warnings: [] });

    const bad = await callTool("validate_extension", {
      spec: one({ type: "urlbutton", name: "D", hyperlink: 42 }),
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual([
      { path: "tabs[0].panels[0].items[0].hyperlink", message: "must be a string" },
    ]);

    // A required parameter left out reads and downloads, with why it breaks.
    const missing = await callTool("validate_extension", {
      spec: one({ type: "urlbutton", name: "D" }),
    });
    expect(missing.ok).toBe(true);
    expect(missing.problems).toEqual([]);
    expect(missing.warnings).toEqual([expect.stringMatching(/has no Hyperlink: pyRevit logs/)]);

    const lone = await callTool("validate_extension", { spec: LONE_STACK });
    expect(lone.ok).toBe(false);
    expect(lone.errors).toEqual([]);
    expect(lone.problems).not.toEqual([]);

    expect(useStore.getState().elements).toBe(before);
  });

  it("set_extension loads a spec as one undo step", async () => {
    const before = names();
    const result = await callTool("set_extension", { spec: EXAMPLE_SPEC });
    expect(result).toMatchObject({ ok: true, problems: [], warnings: [] });
    expect(result.message).toMatch(/Loaded "Acme Tools" \(1 tab, 1 panel, 7 bundles\)/);
    expect(useStore.getState().extensionName).toBe("Acme Tools");
    expect(names()).toContain("Renumber");

    useStore.temporal.getState().undo();
    expect(names()).toEqual(before);
    expect(useStore.getState().extensionName).not.toBe("Acme Tools");
  });

  it("set_extension refuses a malformed spec and changes nothing", async () => {
    const before = useStore.getState().elements;
    const result = await callTool("set_extension", { spec: one({ type: "button", name: "B" }) });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Not loaded/);
    expect(result.errors).toEqual([
      expect.objectContaining({ path: "tabs[0].panels[0].items[0].type" }),
    ]);
    expect(useStore.getState().elements).toBe(before);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("set_extension loads a spec with problems, and says download will be refused", async () => {
    const result = await callTool("set_extension", { spec: LONE_STACK });
    expect(result.ok).toBe(true);
    expect(result.problems).not.toEqual([]);
    expect(result.message).toMatch(/before it can be downloaded/);
  });

  it("download_extension builds the ZIP and downloads it", async () => {
    await callTool("set_extension", { spec: EXAMPLE_SPEC });
    const result = await callTool("download_extension");
    expect(result).toMatchObject({ ok: true, file_name: "Acme Tools.extension.zip" });
    expect(downloadBlob).toHaveBeenCalledOnce();
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[1]).toBe("Acme Tools.extension.zip");
  });

  it("download_extension downloads a button with an empty hyperlink, and says why it breaks", async () => {
    await callTool("set_extension", { spec: one({ type: "urlbutton", name: "Docs" }) });
    const result = await callTool("download_extension");
    expect(result.ok).toBe(true);
    expect(downloadBlob).toHaveBeenCalledOnce();
    expect(result.message).toMatch(
      /One button won't work as built: URL Button "Docs" has no Hyperlink/,
    );
    expect(result.broken).toEqual([expect.stringMatching(/pyRevit logs an error/)]);
  });

  it("download_extension refuses while there are problems", async () => {
    await callTool("set_extension", { spec: LONE_STACK });
    const result = await callTool("download_extension", {});
    expect(result.ok).toBe(false);
    expect(result.problems).not.toEqual([]);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("refuses an unknown tool or arguments that are not an object, and never throws", async () => {
    expect(await callTool("delete_everything")).toMatchObject({ ok: false });
    expect(await callTool("get_extension", [1])).toMatchObject({ ok: false });
    expect(await callTool("get_extension", "not json")).toMatchObject({ ok: false });
  });

  it("refuses arguments a tool does not declare, names the right ones, and changes nothing", async () => {
    const before = names();
    const typo = await callTool("get_extension", { includeIcons: true });
    expect(typo.ok).toBe(false);
    expect(typo.message).toContain('"includeIcons"');
    expect(typo.message).toContain("include_icons");
    const extra = await callTool("set_extension", { spec: EXAMPLE_SPEC, force: true });
    expect(extra.ok).toBe(false);
    expect(names()).toEqual(before);
    const none = await callTool("download_extension", { now: true });
    expect(none.message).toContain("takes no arguments");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("marks the tools that can remove destructive, and freezes the tools", () => {
    expect(AGENT_TOOLS.filter((t) => t.destructive).map((t) => t.name)).toEqual([
      "edit_extension",
      "set_extension",
    ]);
    expect(Object.isFrozen(AGENT_TOOLS)).toBe(true);
    expect(AGENT_TOOLS.every((t) => Object.isFrozen(t))).toBe(true);
  });

  it("accepts arguments as a JSON string, as older WebMCP builds send them", async () => {
    expect(argumentsOf(undefined)).toEqual({});
    expect(argumentsOf('{"include_icons":true}')).toEqual({ include_icons: true });
    const result = await callTool("set_extension", JSON.stringify({ spec: EXAMPLE_SPEC }));
    expect(result.ok).toBe(true);
  });

  it("edit_extension changes one bundle by name, as one undo step", async () => {
    await callTool("set_extension", { spec: EXAMPLE_SPEC });
    const before = useStore.temporal.getState().pastStates.length;
    const result = await callTool("edit_extension", {
      edits: [
        {
          op: "update",
          path: ["Acme", "Sheets", "Help", "Docs"],
          set: { tooltip: "Read the docs" },
        },
        { op: "add", path: ["Acme", "Sheets"], item: { type: "pushbutton", name: "Purge" } },
      ],
    });
    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(result.message).toMatch(
      /^Updated "Acme" \/ "Sheets" \/ "Help" \/ "Docs"; added bundle "Purge"/,
    );
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1);
    const docs = Object.values(useStore.getState().elements).find((e) => e.name === "Docs");
    expect(docs?.tooltip).toBe("Read the docs");
    useStore.temporal.getState().undo();
    expect(Object.values(useStore.getState().elements).some((e) => e.name === "Purge")).toBe(false);
  });

  it("edit_extension keeps icons it doesn't touch, a JPEG included, across a rename", async () => {
    await callTool("set_extension", { spec: EXAMPLE_SPEC });
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const renumber = Object.entries(useStore.getState().elements).find(
      ([, e]) => e.name === "Renumber",
    );
    useStore.setState((s) => {
      const el = s.elements[renumber?.[0] ?? ""];
      if (el) el.iconData = jpeg;
    });
    const result = await callTool("edit_extension", {
      edits: [
        { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { name: "Renumber All" } },
      ],
    });
    expect(result.ok).toBe(true);
    const renamed = Object.values(useStore.getState().elements).find(
      (e) => e.name === "Renumber All",
    );
    expect(renamed?.iconData).toBe(jpeg);
  });

  it("edit_extension keeps the user on their tab", async () => {
    await callTool("set_extension", {
      spec: {
        ...EXAMPLE_SPEC,
        tabs: [...EXAMPLE_SPEC.tabs, { name: "Second", panels: [{ name: "P", items: [] }] }],
      },
    });
    const second = Object.entries(useStore.getState().tabs).find(
      ([, t]) => t.name === "Second",
    )?.[0];
    useStore.getState().activateTab(second ?? "");
    await callTool("edit_extension", {
      edits: [{ op: "update", path: ["Acme", "Sheets", "Renumber"], set: { tooltip: "x" } }],
    });
    const active = useStore.getState().tabs[useStore.getState().activeTabId];
    expect(active?.name).toBe("Second");
  });

  it("edit_extension changes nothing when an edit or its result is wrong", async () => {
    await callTool("set_extension", { spec: EXAMPLE_SPEC });
    const before = JSON.stringify(useStore.getState().elements);
    const badPath = await callTool("edit_extension", {
      edits: [{ op: "update", path: ["Acme", "Sheets", "Nope"], set: { tooltip: "x" } }],
    });
    expect(badPath.ok).toBe(false);
    expect(badPath.message).toMatch(
      /no bundle named "Nope" in "Acme" \/ "Sheets"; it has "Renumber", "Help", "Export"/,
    );
    const badValue = await callTool("edit_extension", {
      edits: [
        { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { tooltip: "fine" } },
        { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { beta: "yes" } },
      ],
    });
    expect(badValue).toMatchObject({
      ok: false,
      errors: [{ path: "tabs[0].panels[0].items[0].beta", message: "must be true or false" }],
    });
    expect(JSON.stringify(useStore.getState().elements)).toBe(before);
  });
});
