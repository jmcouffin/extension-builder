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
    ["a URL button without its hyperlink", { type: "urlbutton", name: "B" }],
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
});
