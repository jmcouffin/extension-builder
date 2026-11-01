import { initialLayout } from "../domain/model";
import { newPushButton } from "../domain/rules";
import { resolveIntent, selfAndDescendants } from "./model";

function layout() {
  const l = initialLayout();
  l.panels.panel1?.elements.push("s1", "b2");
  l.elements.s1 = {
    type: "stack",
    name: "S",
    children: ["c1", "c2"],
    panelId: "panel1",
  };
  l.elements.c1 = newPushButton("One", { parentId: "s1" });
  l.elements.c2 = newPushButton("Two", { parentId: "s1" });
  l.elements.b2 = newPushButton("Other", { panelId: "panel1" });
  return l;
}

const rect = { left: 100, top: 0, width: 100, height: 60, right: 200, bottom: 60 };
const panel = { kind: "panel", panelId: "panel1" } as const;

describe("resolveIntent", () => {
  it("drops before or after a plain item by pointer side", () => {
    const data = { kind: "item", elementId: "b2", container: panel, axis: "x", layer: 0 } as const;
    const before = resolveIntent(layout(), "element1", "item:b2", data, rect, { x: 110, y: 30 });
    const after = resolveIntent(layout(), "element1", "item:b2", data, rect, { x: 190, y: 30 });
    expect(before).toMatchObject({ mode: "before", index: 2, reason: null });
    expect(after).toMatchObject({ mode: "after", index: 3, reason: null });
  });

  it("drops into a container item when over its middle, beside it at its edges", () => {
    const into = { kind: "element", elementId: "s1" } as const;
    const data = {
      kind: "item",
      elementId: "s1",
      container: panel,
      axis: "x",
      into,
      layer: 0,
    } as const;
    expect(resolveIntent(layout(), "b2", "item:s1", data, rect, { x: 150, y: 30 })).toMatchObject({
      mode: "into",
      target: into,
      reason: null,
    });
    expect(resolveIntent(layout(), "b2", "item:s1", data, rect, { x: 105, y: 30 })).toMatchObject({
      mode: "before",
      target: panel,
      index: 1,
    });
  });

  it("explains why a drop is illegal", () => {
    const l = layout();
    l.elements.s2 = { type: "stack", name: "S2", children: [], panelId: "panel1" };
    const into = { kind: "element", elementId: "s1" } as const;
    const data = {
      kind: "item",
      elementId: "s1",
      container: panel,
      axis: "x",
      into,
      layer: 0,
    } as const;
    const intent = resolveIntent(l, "s2", "item:s1", data, rect, { x: 150, y: 30 });
    expect(intent.reason).toMatch(/Stack cannot contain Stack/);
  });

  it("collects a bundle and its descendants", () => {
    expect([...selfAndDescendants(layout(), "s1")].sort()).toEqual(["c1", "c2", "s1"]);
  });
});
