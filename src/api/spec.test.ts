import { initialLayout } from "../domain/model";
import { buildFolderStructure, formatFolderStructure } from "../domain/tree";
import { EXAMPLE_SPEC, layoutFromSpec, MAX_SPEC_CHARS, specFromLayout } from "./spec";

/** The layout of a spec that must read. */
function read(spec: unknown) {
  const result = layoutFromSpec(spec);
  if (!result.layout) throw new Error(JSON.stringify(result.errors));
  return { ...result, layout: result.layout };
}

const one = (bundle: Record<string, unknown>) => ({
  name: "X",
  tabs: [{ name: "T", panels: [{ name: "P", items: [bundle] }] }],
});

describe("extension spec", () => {
  it("reads the example into a sound layout and writes it back unchanged", () => {
    const result = read(EXAMPLE_SPEC);
    expect(result.errors).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(specFromLayout(result.layout)).toEqual(EXAMPLE_SPEC);
  });

  it("builds the folders pyRevit expects, parameters in bundle.yaml", () => {
    const { layout } = read(EXAMPLE_SPEC);
    const tree = formatFolderStructure(buildFolderStructure(layout));
    expect(tree).toContain("Acme Tools.extension");
    expect(tree).toContain("Help.stack");
    expect(tree).toContain("Auto Save.smartbutton");
    const pdf = Object.values(layout.elements).find((e) => e.name === "To PDF");
    expect(pdf?.min_revit_version).toBe("2024");
  });

  it("round-trips the builder's own starting layout", () => {
    const spec = specFromLayout(initialLayout());
    const back = read(spec);
    expect(back.errors).toEqual([]);
    expect(specFromLayout(back.layout)).toEqual(spec);
  });

  it("fills in nothing: a missing required parameter downloads, with why it breaks", () => {
    const url = read(one({ type: "urlbutton", name: "Docs" }));
    expect(url.errors).toEqual([]);
    expect(url.problems).toEqual([]);
    expect(url.warnings).toEqual([
      expect.stringMatching(/URL Button "Docs" has no Hyperlink: pyRevit logs an error/),
    ]);
    const link = read(
      one({
        type: "linkbutton",
        name: "L",
        assembly: "MyAddin",
        command_class: "MyAddin.MyCommand",
      }),
    );
    expect(link.problems).toEqual([]);
    expect(link.warnings.length).toBe(2);
  });

  it("accepts a postfix as type, and members as objects", () => {
    const r = read(
      one({
        type: "combobox",
        name: "Pick",
        members: [
          { id: "a", text: "Alpha" },
          { id: "b", text: "Beta: two" },
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(Object.values(r.layout.elements)[0]?.members).toBe(
      '- id: "a"\n  text: "Alpha"\n- id: "b"\n  text: "Beta: two"',
    );
    expect(
      layoutFromSpec(one({ type: "smartbutton", name: "S" })).layout?.elements.element1?.type,
    ).toBe("toggle");
  });

  it("says where and why a spec is wrong", () => {
    const paths = (spec: unknown) =>
      layoutFromSpec(spec).errors.map((e) => `${e.path}: ${e.message}`);
    expect(paths("{nope")).toEqual([": is not valid JSON"]);
    expect(paths({ name: "X", tabs: [] })[0]).toMatch(/^tabs: must be a non-empty array/);
    expect(paths(one({ type: "button", name: "B" }))[0]).toMatch(
      /items\[0\]\.type: unknown type "button"; use one of pushbutton/,
    );
    expect(paths(one({ type: "pushbutton", name: "B", hyperlink: "x" }))[0]).toMatch(
      /items\[0\]\.hyperlink: is not a parameter of a Push Button; it takes: name, title, tooltip, context/,
    );
    expect(paths(one({ type: "pushbutton", name: "B", beta: "yes" }))).toEqual([
      "tabs[0].panels[0].items[0].beta: must be true or false",
    ]);
    expect(paths(one({ type: "pushbutton", name: "B", min_revit_version: 2019 }))[0]).toMatch(
      /must be one of 2021/,
    );
    expect(
      paths(
        one({ type: "pulldown", name: "G", items: [{ type: "stack", name: "S", items: [] }] }),
      )[0],
    ).toMatch(/items\[0\]\.items\[0\]\.type: Pulldown cannot contain Stack/);
    expect(paths(one({ type: "pushbutton", name: "B", icon: "http://x/i.png" }))[0]).toMatch(
      /PNG data URL/,
    );
  });

  it("reports two bundles that would share a folder as a problem", () => {
    const spec = {
      name: "X",
      tabs: [
        {
          name: "T",
          panels: [
            {
              name: "P",
              items: [
                { type: "pushbutton", name: "Go" },
                { type: "pushbutton", name: "go" },
              ],
            },
          ],
        },
      ],
    };
    const r = read(spec);
    expect(r.problems).toEqual([expect.stringMatching(/same folder/)]);
  });

  it("reports what pyRevit would skip as problems, not errors", () => {
    const r = layoutFromSpec(
      one({ type: "stack", name: "S", items: [{ type: "pushbutton", name: "A" }] }),
    );
    expect(r.errors).toEqual([]);
    expect(r.problems[0]).toMatch(/stack with 1 command/);
  });

  it("loads back what get_extension gives for layouts the builder can hold", () => {
    const layout = initialLayout();
    const button = layout.elements.element1;
    if (!button) throw new Error("no button");
    // An icon kept across a change to a type without icons.
    button.iconData = "data:image/png;base64,iVBORw0KGgo=";
    button.type = "combobox";
    button.members = "- id: a\n  text: A";
    expect(layoutFromSpec(specFromLayout(layout)).errors).toEqual([]);
    // A required parameter cleared in Properties.
    button.type = "urlbutton";
    expect(read(specFromLayout(layout)).warnings).toEqual([
      expect.stringMatching(/has no Hyperlink/),
    ]);
  });

  it("writes members as strings YAML can't retype, and refuses keys pyRevit doesn't read", () => {
    const r = read(
      one({
        type: "combobox",
        name: "C",
        members: [
          { id: "yes", text: "- x" },
          { id: "0x1F", text: "null" },
        ],
      }),
    );
    expect(Object.values(r.layout.elements)[0]?.members).toBe(
      '- id: "yes"\n  text: "- x"\n- id: "0x1F"\n  text: "null"',
    );
    expect(
      layoutFromSpec(
        one({ type: "combobox", name: "C", members: [{ id: "a", text: "b", "x\nengine": "y" }] }),
      ).errors[0]?.message,
    ).toMatch(/item 0 has "x\nengine"/);
  });

  it("puts a No Button only in a menu, and a year only as a number", () => {
    expect(layoutFromSpec(one({ type: "nobutton", name: "N" })).errors[0]?.message).toMatch(
      /can't sit in a panel/,
    );
    expect(
      layoutFromSpec(one({ type: "pulldown", name: "G", items: [{ type: "nobutton", name: "N" }] }))
        .errors,
    ).toEqual([]);
    expect(
      layoutFromSpec(one({ type: "pushbutton", name: "B", min_revit_version: "2024" })).errors[0]
        ?.message,
    ).toBe("must be a number, like 2024");
  });

  it("refuses a context pyRevit forces, and a min version above the max", () => {
    expect(
      layoutFromSpec(one({ type: "panelbutton", name: "P", context: "selection" })).errors[0]
        ?.message,
    ).toMatch(/is not a parameter of a Panel Button/);
    const r = read(
      one({ type: "pushbutton", name: "B", min_revit_version: 2026, max_revit_version: 2024 }),
    );
    expect(r.problems).toEqual([expect.stringMatching(/above its Max/)]);
  });

  it("never throws, however deep or large the spec", () => {
    let deep: Record<string, unknown> = { type: "pushbutton", name: "Leaf" };
    for (let i = 0; i < 20000; i++) deep = { type: "stack", name: `S${i}`, items: [deep] };
    const result = layoutFromSpec(one(deep));
    expect(result.layout).toBeNull();
    expect(result.errors.some((e) => /nested too deep/.test(e.message))).toBe(true);
    expect(layoutFromSpec("x".repeat(MAX_SPEC_CHARS + 1)).errors[0]?.message).toMatch(/MB at most/);
  });
});
