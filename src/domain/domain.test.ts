import { KNOWN_POSTFIXES, rejectionReason, TYPES } from "./bundleTypes";
import { migrate, validateLoadedState } from "./layoutFile";
import { type Element, initialLayout, type Layout } from "./model";
import {
  buildBundle,
  type FolderNode,
  sanitizeFileName,
  type TreeNode,
  yamlValue,
} from "./templates";
import { buildFolderStructure, validate } from "./tree";

function yamlOf(folder: FolderNode | null): string {
  const file = folder?.children.find((c) => c.name === "bundle.yaml");
  return file?.type === "file" ? (file.content ?? "") : "";
}

function findNode(root: TreeNode, name: string): TreeNode | null {
  if (root.name === name) return root;
  if (root.type !== "folder") return null;
  for (const child of root.children) {
    const hit = findNode(child, name);
    if (hit) return hit;
  }
  return null;
}

function el(partial: Partial<Element> & Pick<Element, "type" | "name">): Element {
  return { title: "", tooltip: "", code: "", ...partial };
}

describe("postfix table matches pyRevit's FromExtension", () => {
  const elementPostfixes = KNOWN_POSTFIXES.filter((p) => p !== ".tab" && p !== ".panel");

  it("uses only postfixes pyRevit knows", () => {
    for (const def of Object.values(TYPES)) {
      expect(KNOWN_POSTFIXES).toContain(def.postfix);
    }
  });

  it("covers every element postfix", () => {
    const covered = new Set(Object.values(TYPES).map((d) => d.postfix));
    for (const p of elementPostfixes) expect(covered).toContain(p);
  });
});

describe("sanitizeFileName", () => {
  it.each([
    ["Packages & Tags", "Packages & Tags"],
    ["My  Button", "My Button"],
    ['a<b>c:d"e/f\\g|h?i*j', "a b c d e f g h i j"],
    [".hidden", "hidden"],
    ["trailing.  ", "trailing"],
    ["", "Untitled"],
    ["keep-dash_and_us", "keep-dash_and_us"],
  ])("%j -> %j", (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });
});

describe("yamlValue", () => {
  it.each<[unknown, string]>([
    ["Button 1", '"Button 1"'],
    ["Rev: v2", '"Rev: v2"'],
    ["A # B", '"A # B"'],
    ['say "hi"', '"say \\"hi\\""'],
    ["a\nb", '"a\\nb"'],
    [true, "true"],
    [false, "false"],
    [2024, "2024"],
  ])("%j -> %s", (input, expected) => {
    expect(yamlValue(input)).toBe(expected);
  });
});

describe("bundles", () => {
  it("linkbutton uses assembly + command_class", () => {
    const lb = buildBundle(
      "linkbutton",
      el({
        type: "linkbutton",
        name: "My Link",
        title: "L",
        assembly: "MyDll",
        command_class: "MyNs.MyCmd",
        availability_class: "MyNs.MyCmdAvail",
      }),
      "e1",
    );
    const yaml = yamlOf(lb);
    expect(yaml).toMatch(/assembly: "MyDll"/);
    expect(yaml).toMatch(/command_class: "MyNs.MyCmd"/);
    expect(yaml).not.toMatch(/hyperlink/);
    expect(yaml).not.toMatch(/\binvoke:/);
    expect(lb?.name).toBe("My Link.linkbutton");
  });

  it("urlbutton emits hyperlink", () => {
    const ub = buildBundle(
      "urlbutton",
      el({ type: "urlbutton", name: "Docs", hyperlink: "https://x.io" }),
      "e2",
    );
    expect(yamlOf(ub)).toMatch(/hyperlink: "https:\/\/x.io"/);
    expect(ub?.name).toBe("Docs.urlbutton");
  });

  it("invokebutton emits command_class and no invoke key", () => {
    const ib = buildBundle(
      "invokebutton",
      el({ type: "invokebutton", name: "Invoke", assembly: "MyDll", command_class: "MyNs.Run" }),
      "e3",
    );
    expect(yamlOf(ib)).toMatch(/command_class: "MyNs.Run"/);
    expect(yamlOf(ib)).not.toMatch(/\binvoke:/);
  });

  it("toggle is a .smartbutton driven by toggle_icon and an env var", () => {
    const tg = buildBundle("toggle", el({ type: "toggle", name: "Snap", title: "Snap" }), "e4");
    expect(tg?.name).toBe("Snap.smartbutton");
    const script = tg?.children.find((c) => c.name === "script.py");
    const text = script?.type === "file" ? (script.content ?? "") : "";
    expect(text).toMatch(/script\.toggle_icon/);
    expect(text).toMatch(/script\.set_envvar/);
    expect(text).not.toMatch(/__persistentengine__/);
  });

  it("panelbutton is forced to zero-doc", () => {
    const pb = buildBundle(
      "panelbutton",
      el({ type: "panelbutton", name: "PB", context: "" }),
      "e6",
    );
    expect(yamlOf(pb)).toMatch(/context: "zero-doc"/);
  });

  it("emits context exactly once", () => {
    const b = buildBundle(
      "pushbutton",
      el({ type: "pushbutton", name: "Ctx", context: "selection" }),
      "e7",
    );
    expect(yamlOf(b).match(/^context:/gm)).toHaveLength(1);
  });
});

describe("containers", () => {
  it("stack is 2-3 children", () => {
    expect(buildBundle("stack", el({ type: "stack", name: "S" }), "e5")?.name).toBe("S.stack");
    expect(TYPES.stack.minChildren).toBe(2);
    expect(TYPES.stack.maxChildren).toBe(3);
  });

  it("enforces nesting", () => {
    expect(rejectionReason("pulldown", "stack")).not.toBeNull();
    expect(rejectionReason("pulldown", "pushbutton")).toBeNull();
    expect(rejectionReason("stack", "pushbutton")).toBeNull();
    expect(rejectionReason("stack", "stack")).not.toBeNull();
    expect(rejectionReason("pushbutton", "pushbutton")).not.toBeNull();
    expect(rejectionReason("tab", "pushbutton")).not.toBeNull();
    expect(rejectionReason("panel", "combobox")).toBeNull();
  });
});

describe("full tree and validator", () => {
  function sampleLayout(): Layout {
    const layout = initialLayout();
    layout.tabs.tab1?.panels.push("panel2");
    layout.panels.panel2 = {
      name: "Second Panel",
      elements: ["el10", "el11", "el12"],
      tabId: "tab1",
    };
    layout.elements.el10 = el({
      type: "pushbutton",
      name: "Zebra",
      title: "Z: 2",
      tooltip: "tip #1",
      panelId: "panel2",
    });
    layout.elements.el11 = el({
      type: "urlbutton",
      name: "Site",
      title: "Site",
      hyperlink: "https://a.b",
      panelId: "panel2",
    });
    layout.elements.el12 = el({
      type: "stack",
      name: "Pair",
      children: ["el20", "el21"],
      panelId: "panel2",
    });
    layout.elements.el20 = el({ type: "pushbutton", name: "One", parentId: "el12" });
    layout.elements.el21 = el({ type: "toggle", name: "Two", parentId: "el12" });
    return layout;
  }

  it("builds the expected folders", () => {
    const tree = buildFolderStructure(sampleLayout());
    const names: string[] = [];
    const walk = (n: TreeNode) => {
      names.push(n.name);
      if (n.type === "folder") n.children.forEach(walk);
    };
    walk(tree);

    expect(names[0]).toBe("My Extension.extension");
    for (const name of [
      "extension.json",
      "INSTALL.txt",
      "My Tab.tab",
      "My Panel.panel",
      "Second Panel.panel",
      "Button 1.pushbutton",
      "Zebra.pushbutton",
      "Site.urlbutton",
      "Pair.stack",
      "One.pushbutton",
      "Two.smartbutton",
    ]) {
      expect(names).toContain(name);
    }

    const panel2 = findNode(tree, "Second Panel.panel");
    expect(panel2?.type === "folder" && yamlOf(panel2)).toMatch(/^layout:/m);
    const zebra = findNode(tree, "Zebra.pushbutton");
    const zebraYaml = zebra?.type === "folder" ? yamlOf(zebra) : "";
    expect(zebraYaml).toMatch(/title: "Z: 2"/);
    expect(zebraYaml).toMatch(/tooltip: "tip #1"/);
  });

  it("reports nothing for a sound extension", () => {
    expect(validate(sampleLayout())).toEqual([]);
  });

  it("reports an under-filled stack", () => {
    const layout = sampleLayout();
    layout.panels.panel2?.elements.push("el30");
    layout.elements.el30 = el({ type: "stack", name: "Lonely", children: [], panelId: "panel2" });
    expect(validate(layout).length).toBeGreaterThan(0);
  });

  it("reports a sanitised folder collision", () => {
    const layout = sampleLayout();
    layout.panels.panel2?.elements.push("el31");
    layout.elements.el31 = el({ type: "pushbutton", name: "zebra", panelId: "panel2" });
    expect(validate(layout).some((p) => /same folder/i.test(p))).toBe(true);
  });

  it("reports a linkbutton with no assembly", () => {
    const layout = sampleLayout();
    layout.panels.panel2?.elements.push("el32");
    layout.elements.el32 = el({ type: "linkbutton", name: "Broken", panelId: "panel2" });
    expect(validate(layout).length).toBeGreaterThan(0);
  });
});

describe("v1 -> v2 migration", () => {
  const v1 = () => ({
    version: "1.0",
    extensionName: "Old",
    tabs: { tab1: { name: "T", panels: ["panel1"] } },
    panels: { panel1: { name: "P", elements: ["b1", "b2", "b3"], tabId: "tab1" } },
    elements: {
      b1: { type: "togglebutton", name: "Tog", panelId: "panel1" },
      b2: { type: "linkbutton", name: "Lnk", url: "https://x.io", panelId: "panel1" },
      b3: { type: "invokebutton", name: "Inv", command: "MyNs.Cmd", panelId: "panel1" },
    },
    activeTabId: "tab1",
  });

  it("upgrades legacy types and keys", () => {
    const m = migrate(v1());
    expect(m.elements.b1?.type).toBe("toggle");
    expect(m.elements.b2?.type).toBe("urlbutton");
    expect(m.elements.b2?.hyperlink).toBe("https://x.io");
    expect(m.elements.b2).not.toHaveProperty("url");
    expect(m.elements.b3?.command_class).toBe("MyNs.Cmd");
    expect(m.elements.b3).not.toHaveProperty("command");
    expect(m.elements.b1?.iconDarkData).toBeNull();
    expect(m.nextIds.element).toBe(4);
  });

  it("derives finite nextIds from an empty layout", () => {
    const m = migrate({
      version: "1.0",
      extensionName: "E",
      tabs: { t1: { name: "T", panels: [] } },
      panels: {},
      elements: {},
      activeTabId: "t1",
    });
    expect(m.nextIds.element).toBe(1);
  });

  it("accepts v1 and rejects future versions", () => {
    expect(validateLoadedState(v1())).toBeNull();
    expect(
      validateLoadedState({
        version: "9.0",
        extensionName: "x",
        tabs: { a: 1 },
        panels: { a: 1 },
        elements: {},
      }),
    ).not.toBeNull();
  });
});
