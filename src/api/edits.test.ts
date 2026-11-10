import { applyEdits } from "./edits";
import { EXAMPLE_SPEC, type ExtensionSpec } from "./spec";

const spec = (): ExtensionSpec => structuredClone(EXAMPLE_SPEC);
const panel = (s: ExtensionSpec | null) => s?.tabs[0]?.panels[0];
const names = (s: ExtensionSpec | null) => panel(s)?.items.map((b) => b.name);

describe("applyEdits", () => {
  it("updates a bundle by name, and null removes a key", () => {
    const { spec: out, done } = applyEdits(spec(), [
      { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { tooltip: "New", author: null } },
    ]);
    const renumber = panel(out)?.items[0];
    expect(renumber?.tooltip).toBe("New");
    expect(renumber).not.toHaveProperty("author");
    expect(done).toEqual(['updated "Acme" / "Sheets" / "Renumber"']);
  });

  it("reaches into a stack or group, and matches a name ignoring case", () => {
    const { spec: out } = applyEdits(spec(), [
      {
        op: "update",
        path: ["acme", "sheets", "help", "docs"],
        set: { hyperlink: "https://x.io" },
      },
    ]);
    expect(panel(out)?.items[1]?.items?.[0]?.hyperlink).toBe("https://x.io");
  });

  it("adds, removes and moves, in order, without touching the input", () => {
    const input = spec();
    const { spec: out, errors } = applyEdits(input, [
      { op: "add", path: ["Acme", "Sheets"], item: { type: "pushbutton", name: "New" }, index: 0 },
      { op: "remove", path: ["Acme", "Sheets", "Renumber"] },
      { op: "move", path: ["Acme", "Sheets", "Export", "To PDF"], to: ["Acme", "Sheets"] },
      { op: "add", path: [], item: { name: "Second", panels: [{ name: "P", items: [] }] } },
      { op: "update", path: ["Acme"], set: { name: "Acme Tools" } },
    ]);
    expect(errors).toEqual([]);
    expect(names(out)).toEqual(["New", "Help", "Export", "To PDF"]);
    expect(out?.tabs.map((t) => t.name)).toEqual(["Acme Tools", "Second"]);
    expect(input).toEqual(EXAMPLE_SPEC);
  });

  it("says which edit is wrong and what is there instead, applying none", () => {
    const { spec: out, errors } = applyEdits(spec(), [
      { op: "update", path: ["Acme", "Sheets", "Renumber"], set: { tooltip: "x" } },
      { op: "remove", path: ["Acme", "Tools"] },
    ]);
    expect(out).toBeNull();
    expect(errors).toEqual([
      { path: "edits[1].path[1]", message: 'no panel named "Tools" in "Acme"; it has "Sheets"' },
    ]);
  });

  it.each([
    [[], "edits", /non-empty array/],
    [[{ op: "rename", path: [] }], "edits[0].op", /update, add, remove, move/],
    [[{ op: "remove", path: "Acme" }], "edits[0].path", /array of names/],
    [[{ op: "remove", path: [] }], "edits[0].path", /extension itself/],
    [
      [{ op: "remove", path: ["Acme"], set: {} }],
      "edits[0].set",
      /is not a key of a "remove" edit/,
    ],
    [
      [{ op: "update", path: ["Acme"], set: { panels: [] } }],
      "edits[0].set.panels",
      /only has a name/,
    ],
    [
      [{ op: "update", path: ["Acme", "Sheets", "Export"], set: { items: [] } }],
      "edits[0].set.items",
      /add, remove and move/,
    ],
    [
      [
        {
          op: "add",
          path: ["Acme", "Sheets", "Renumber"],
          item: { type: "pushbutton", name: "X" },
        },
      ],
      "edits[0].path",
      /holds no other bundles/,
    ],
    [
      [{ op: "move", path: ["Acme", "Sheets", "Export"], to: ["Acme", "Sheets", "Export"] }],
      "edits[0].to",
      /or inside it/,
    ],
    [
      [{ op: "move", path: ["Acme", "Sheets"], to: ["Acme", "Sheets"] }],
      "edits[0].to",
      /must name a tab/,
    ],
    [
      [{ op: "add", path: ["Acme"], item: { name: "P", items: [] }, index: -1 }],
      "edits[0].index",
      /whole number/,
    ],
  ])("refuses %j", (edits, path, message) => {
    const { spec: out, errors } = applyEdits(spec(), edits);
    expect(out).toBeNull();
    expect(errors[0]?.path).toBe(path);
    expect(errors[0]?.message).toMatch(message);
  });
});
