import { initialLayout } from "../domain/model";
import { buildFolderStructure, formatFolderStructure } from "../domain/tree";
import { EXAMPLE_SPEC, layoutFromSpec, specFromLayout } from "./spec";

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

  it("requires what pyRevit requires, and warns about sample values", () => {
    expect(layoutFromSpec(one({ type: "urlbutton", name: "Docs" })).errors).toEqual([
      { path: "tabs[0].panels[0].items[0].hyperlink", message: "is required for a URL Button" },
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
      '- id: a\n  text: Alpha\n- id: b\n  text: "Beta: two"',
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

  it("refuses two bundles that would share a folder", () => {
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
    expect(layoutFromSpec(spec).errors[0]?.path).toBe("tabs[0].panels[0].items[1].name");
  });

  it("reports what pyRevit would skip as problems, not errors", () => {
    const r = layoutFromSpec(
      one({ type: "stack", name: "S", items: [{ type: "pushbutton", name: "A" }] }),
    );
    expect(r.errors).toEqual([]);
    expect(r.problems[0]).toMatch(/stack with 1 command/);
  });
});
