import { moveDestinations } from "../domain/modify";
import { useStore } from "./store";

const st = () => useStore.getState();
const panelItems = (panelId = "panel1") => st().panels[panelId]?.elements ?? [];
const nameOf = (id: string) => st().elements[id]?.name;

beforeEach(() => st().reset());

describe("Modify tab commands", () => {
  it("duplicates a bundle next to itself, with a free name, and selects the copy", () => {
    st().updateElement("element1", { type: "urlbutton", name: "Docs", hyperlink: "https://x.io" });
    expect(st().duplicateElement("element1")).toBeNull();
    const [first, copy] = panelItems();
    expect(first).toBe("element1");
    expect(nameOf(copy ?? "")).toBe("Docs copy");
    expect(st().elements[copy ?? ""]).toMatchObject({
      type: "urlbutton",
      hyperlink: "https://x.io",
    });
    expect(st().selectedId).toBe(copy);
    st().duplicateElement("element1");
    expect(nameOf(panelItems()[1] ?? "")).toBe("Docs copy 1");
  });

  it("duplicates a group with copies of its commands, not the same ones", () => {
    st().addGroup("panel1");
    const groupId = panelItems().at(-1) ?? "";
    st().duplicateElement(groupId);
    const copyId = panelItems().at(-1) ?? "";
    const [orig] = st().elements[groupId]?.children ?? [];
    const [copied] = st().elements[copyId]?.children ?? [];
    expect(copied).toBeDefined();
    expect(copied).not.toBe(orig);
    expect(st().elements[copied ?? ""]?.parentId).toBe(copyId);
  });

  it("refuses to duplicate into a full stack", () => {
    st().addStack("panel1");
    const stackId = panelItems().at(-1) ?? "";
    const [child] = st().elements[stackId]?.children ?? [];
    expect(st().duplicateElement(child ?? "")).toBeNull();
    expect(st().duplicateElement(child ?? "")).toMatch(/at most 3/);
  });

  it("moves a bundle to a panel on another tab, opens that tab, in one undo step", () => {
    st().addCommand({ kind: "panel", panelId: "panel1" });
    st().addTab();
    st().activateTab("tab1");
    const before = useStore.temporal.getState().pastStates.length;
    const dest = moveDestinations(st(), "element1").find(
      (d) => d.target.kind === "panel" && d.tabId === "tab2",
    );
    expect(dest?.reason).toBeNull();
    expect(dest?.rename).toBe("Button 1 1");
    expect(
      st().moveElementTo("element1", dest?.target ?? { kind: "panel", panelId: "" }),
    ).toBeNull();
    expect(st().activeTabId).toBe("tab2");
    expect(st().selectedId).toBe("element1");
    expect(nameOf("element1")).toBe("Button 1 1");
    expect(useStore.temporal.getState().pastStates.length).toBe(before + 1);
  });

  it("greys a destination pyRevit would not load, and renames on a name clash", () => {
    st().addStack("panel1");
    st().addGroup("panel1");
    const [, stackId, groupId] = panelItems();
    const stack = (id: string) =>
      moveDestinations(st(), id).find(
        (d) => d.target.kind === "element" && d.target.elementId === stackId,
      );
    expect(stack("element1")?.reason).toBeNull();
    expect(stack("element1")?.rename).toBe("Button 1 1");
    st().addCommand({ kind: "element", elementId: stackId ?? "" });
    expect(stack("element1")?.reason).toMatch(/at most 3/);
    const intoGroup = moveDestinations(st(), stackId ?? "").find(
      (d) => d.target.kind === "element" && d.target.elementId === groupId,
    );
    expect(intoGroup?.reason).toMatch(/cannot contain Stack/);
  });

  it("wraps a button in a stack with a second command, in its place", () => {
    st().addCommand({ kind: "panel", panelId: "panel1" });
    expect(st().wrapElement("element1", "stack")).toBeNull();
    const [stackId] = panelItems();
    const stack = st().elements[stackId ?? ""];
    expect(stack?.type).toBe("stack");
    expect(stack?.children?.[0]).toBe("element1");
    expect(stack?.children?.map(nameOf)).toEqual(["Button 1", "Button 2"]);
    expect(st().selectedId).toBe(stackId);
  });

  it("wraps a button in a pulldown, also inside a stack", () => {
    st().addStack("panel1");
    const stackId = panelItems().at(-1) ?? "";
    const [child] = st().elements[stackId]?.children ?? [];
    expect(st().wrapElement(child ?? "", "pulldown")).toBeNull();
    const [wrapped] = st().elements[stackId]?.children ?? [];
    expect(st().elements[wrapped ?? ""]?.type).toBe("pulldown");
    expect(st().elements[wrapped ?? ""]?.children).toEqual([child]);
  });

  it("refuses wraps pyRevit would not load", () => {
    st().addGroup("panel1");
    const groupId = panelItems().at(-1) ?? "";
    const [child] = st().elements[groupId]?.children ?? [];
    expect(st().wrapElement(child ?? "", "stack")).toMatch(/directly in a panel/);
    expect(st().wrapElement(child ?? "", "pulldown")).toMatch(/not in another group/);
    expect(st().wrapElement(groupId, "pulldown")).toMatch(/can't go in a pulldown/);
    st().updateElement("element1", { type: "panelbutton", name: "Button 1" });
    expect(st().wrapElement("element1", "stack")).toMatch(/can't go in a stack/);
  });

  it("ungroups in place, renaming a command whose name is taken", () => {
    st().addGroup("panel1");
    const groupId = panelItems().at(-1) ?? "";
    expect(st().ungroupElement(groupId)).toBeNull();
    expect(st().elements[groupId]).toBeUndefined();
    expect(panelItems().map(nameOf)).toEqual(["Button 1", "Button 1 1"]);
    expect(st().selectedId).toBe(panelItems()[1]);
  });

  it("refuses to ungroup a command, or a group that would overfill its stack", () => {
    expect(st().ungroupElement("element1")).toMatch(/Only a stack or a group/);
    st().addStack("panel1");
    const stackId = panelItems().at(-1) ?? "";
    const [child] = st().elements[stackId]?.children ?? [];
    st().wrapElement(child ?? "", "pulldown");
    const [pulldownId] = st().elements[stackId]?.children ?? [];
    st().addCommand({ kind: "element", elementId: pulldownId ?? "" });
    st().addCommand({ kind: "element", elementId: pulldownId ?? "" });
    expect(st().ungroupElement(pulldownId ?? "")).toMatch(/at most 3/);
  });
});
