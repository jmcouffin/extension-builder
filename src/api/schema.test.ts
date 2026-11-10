import Ajv2020 from "ajv/dist/2020";
import { initialLayout } from "../domain/model";
import { extensionSchema } from "./schema";
import { EXAMPLE_SPEC, layoutFromSpec, specFromLayout } from "./spec";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(extensionSchema());
const one = (bundle: Record<string, unknown>) => ({
  name: "X",
  tabs: [{ name: "T", panels: [{ name: "P", items: [bundle] }] }],
});

describe("the published JSON Schema", () => {
  it("accepts the example and what the builder writes", () => {
    expect(validate(EXAMPLE_SPEC), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(specFromLayout(initialLayout()))).toBe(true);
  });

  it.each([
    ["an unknown type", { type: "button", name: "B" }],
    ["a parameter of another type", { type: "pushbutton", name: "B", hyperlink: "https://x" }],
    ["a string for a yes/no", { type: "pushbutton", name: "B", beta: "yes" }],
    [
      "a stack in a pulldown",
      { type: "pulldown", name: "G", items: [{ type: "stack", name: "S", items: [] }] },
    ],
    [
      "four rows in a stack",
      {
        type: "stack",
        name: "S",
        items: ["A", "B", "C", "D"].map((name) => ({ type: "pushbutton", name })),
      },
    ],
  ])("rejects %s, as the builder does", (_label, bundle) => {
    expect(validate(one(bundle))).toBe(false);
    const result = layoutFromSpec(one(bundle));
    expect(result.errors.length + result.problems.length).toBeGreaterThan(0);
  });

  it("accepts every spec the builder opens without errors", () => {
    const sound = [
      one({ type: "pulldown", name: "G", items: [{ type: "nobutton", name: "N" }] }),
      one({ type: "combobox", name: "C", members: [{ id: "a", text: "A", tooltip: "t" }] }),
      one({ type: "panelbutton", name: "P", engine_persistent: true }),
      one({ type: "content", name: "F", content: "f.rfa", content_alt: "g.rfa" }),
      one({ type: "invokebutton", name: "I", assembly: "Lib.dll" }),
      one({ type: "pushbutton", name: "B", icon: "data:image/png;base64,iVBORw0KGgo=" }),
    ];
    for (const spec of sound) {
      expect(layoutFromSpec(spec).errors).toEqual([]);
      expect(validate(spec), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it.each([
    ["a blank name", { type: "pushbutton", name: "   " }],
    [
      "a PNG data URL that isn't base64",
      { type: "pushbutton", name: "B", icon: "data:image/png;base64,!!!" },
    ],
    [
      "a JPEG icon",
      { type: "pushbutton", name: "B", icon: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" },
    ],
    [
      "JPEG bytes called PNG",
      { type: "pushbutton", name: "B", icon: "data:image/png;base64,/9j/4AAQSkZJRg==" },
    ],
    ["a No Button in a panel", { type: "nobutton", name: "N" }],
    ["a forced context", { type: "panelbutton", name: "P", context: "selection" }],
    ["a year as text", { type: "pushbutton", name: "B", min_revit_version: "2024" }],
  ])("both refuse %s", (_label, bundle) => {
    expect(validate(one(bundle))).toBe(false);
    expect(layoutFromSpec(one(bundle)).errors.length).toBeGreaterThan(0);
  });

  it("requires what pyRevit needs, while the builder downloads it and says why it breaks", () => {
    const spec = one({ type: "urlbutton", name: "B" });
    expect(validate(spec)).toBe(false);
    const result = layoutFromSpec(spec);
    expect(result.problems).toEqual([]);
    expect(result.warnings[0]).toMatch(/URL Button "B" has no Hyperlink: pyRevit logs an error/);
  });
});
