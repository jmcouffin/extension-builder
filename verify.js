// Headless check of the generated tree. Not part of the site.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = __dirname;
const sandbox = {
  console,
  setTimeout,
  document: {
    getElementById: (id) => ({ value: "My Extension" }),
  },
  fetch: () => Promise.resolve({ ok: false }),
  FileReader: function () {},
};
sandbox.window = sandbox;

vm.createContext(sandbox);

["bundle-types.js", "template.js", "state.js", "folder-structure.js"].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
});

const BT = sandbox.BundleTypes;
const T = sandbox.templates;
const FS = sandbox.FolderStructure;
const state = sandbox.appState;

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log("  FAIL " + msg);
  }
};
const section = (name) => console.log("\n== " + name);

// ---------------------------------------------------------------------------
section("postfix table matches pyRevit's FromExtension");
const REAL = new Set([
  ".tab", ".panel", ".pushbutton", ".pulldown", ".splitbutton",
  ".splitpushbutton", ".stack", ".smartbutton", ".panelbutton", ".linkbutton",
  ".invokebutton", ".urlbutton", ".content", ".nobutton", ".combobox",
]);
Object.keys(BT.types).forEach((id) => {
  const p = BT.types[id].postfix;
  ok(REAL.has(p), id + " -> " + p + " is not a real pyRevit postfix");
});
ok(!Object.values(BT.types).some((d) => d.postfix === ".toggle"), ".toggle must not exist");

// Every element postfix pyRevit understands must be reachable from the table.
const ELEMENT_POSTFIXES = [
  ".pushbutton", ".pulldown", ".splitbutton", ".splitpushbutton", ".stack",
  ".smartbutton", ".panelbutton", ".linkbutton", ".invokebutton", ".urlbutton",
  ".content", ".nobutton", ".combobox",
];
const covered = new Set(Object.values(BT.types).map((d) => d.postfix));
ELEMENT_POSTFIXES.forEach((p) => {
  ok(covered.has(p), "no type produces " + p);
});
console.log(
  "  types: " + Object.keys(BT.types).length +
  " covering " + covered.size + "/" + ELEMENT_POSTFIXES.length + " element postfixes"
);

// ---------------------------------------------------------------------------
section("sanitiser keeps spaces, strips what Windows/pyRevit reject");
ok(T.sanitizeFileName("Packages & Tags") === "Packages & Tags", "keeps & and spaces");
ok(T.sanitizeFileName("My  Button") === "My Button", "collapses spaces");
ok(T.sanitizeFileName('a<b>c:d"e/f\\g|h?i*j') === "a b c d e f g h i j", "strips illegal");
ok(T.sanitizeFileName(".hidden") === "hidden", "strips leading dot");
ok(T.sanitizeFileName("trailing.  ") === "trailing", "strips trailing dot/space");
ok(T.sanitizeFileName("") === "Untitled", "empty falls back");
ok(T.sanitizeFileName("keep-dash_and_us") === "keep-dash_and_us", "keeps - and _");

// ---------------------------------------------------------------------------
section("YAML quoting");
ok(T.yamlValue("Button 1") === '"Button 1"', "quotes simple string");
ok(T.yamlValue("Rev: v2") === '"Rev: v2"', "quotes colon");
ok(T.yamlValue("A # B") === '"A # B"', "quotes hash");
ok(T.yamlValue('say "hi"') === '"say \\"hi\\""', "escapes quotes");
ok(T.yamlValue("a\nb") === '"a\\nb"', "escapes newline");
ok(T.yamlValue(true) === "true", "boolean stays unquoted");
ok(T.yamlValue(false) === "false", "false stays unquoted");
ok(T.yamlValue(2024) === "2024", "number stays unquoted");

// ---------------------------------------------------------------------------
section("linkbutton/invokebutton use assembly+command_class, not url/invoke");
const lb = T.buildBundle("linkbutton", {
  type: "linkbutton", name: "My Link", title: "L", tooltip: "",
  assembly: "MyDll", command_class: "MyNs.MyCmd", availability_class: "MyNs.MyCmdAvail",
}, "e1");
const lbYaml = lb.children.find((c) => c.name === "bundle.yaml").content;
ok(/assembly: "MyDll"/.test(lbYaml), "linkbutton emits assembly");
ok(/command_class: "MyNs.MyCmd"/.test(lbYaml), "linkbutton emits command_class");
ok(!/hyperlink/.test(lbYaml), "linkbutton does NOT emit hyperlink");
ok(!/\binvoke:/.test(lbYaml), "no bogus invoke key");
ok(lb.name === "My Link.linkbutton", "linkbutton postfix: " + lb.name);

const ub = T.buildBundle("urlbutton", {
  type: "urlbutton", name: "Docs", title: "Docs", tooltip: "", hyperlink: "https://x.io",
}, "e2");
const ubYaml = ub.children.find((c) => c.name === "bundle.yaml").content;
ok(/hyperlink: "https:\/\/x.io"/.test(ubYaml), "urlbutton emits hyperlink");
ok(ub.name === "Docs.urlbutton", "urlbutton postfix: " + ub.name);

const ib = T.buildBundle("invokebutton", {
  type: "invokebutton", name: "Invoke", title: "", tooltip: "",
  assembly: "MyDll", command_class: "MyNs.Run",
}, "e3");
const ibYaml = ib.children.find((c) => c.name === "bundle.yaml").content;
ok(/command_class: "MyNs.Run"/.test(ibYaml), "invokebutton emits command_class");
ok(!/\binvoke:/.test(ibYaml), "invokebutton has no invoke key");

// ---------------------------------------------------------------------------
section("toggle is a .smartbutton with on/off icons, not .togglebutton");
const tg = T.buildBundle("toggle", { type: "toggle", name: "Snap", title: "Snap", tooltip: "" }, "e4");
ok(tg.name === "Snap.smartbutton", "toggle postfix: " + tg.name);
const tgScript = tg.children.find((c) => c.name === "script.py").content;
ok(tgScript.match(/script\.toggle_icon/), "uses script.toggle_icon");
ok(tgScript.match(/script\.set_envvar/), "persists state in an env var");
ok(!/toggle_state = not toggle_state/.test(tgScript), "no fake module-global toggle");
ok(!/__persistentengine__/.test(tgScript), "no bogus persistent engine claim");

// ---------------------------------------------------------------------------
section("containers");
const stack = T.buildBundle("stack", { type: "stack", name: "S" }, "e5");
ok(stack.name === "S.stack", "stack postfix");
ok(BT.get("stack").minChildren === 2, "stack min 2 (StackBuilder.cs:80)");
ok(BT.get("stack").maxChildren === 3, "stack max 3");

ok(BT.rejectionReason("pulldown", "stack") !== null, "pulldown rejects stack");
ok(BT.rejectionReason("pulldown", "pushbutton") === null, "pulldown accepts pushbutton");
ok(BT.rejectionReason("stack", "pushbutton") === null, "stack accepts pushbutton");
ok(BT.rejectionReason("stack", "stack") !== null, "stack rejects nested stack");
ok(BT.rejectionReason("pushbutton", "pushbutton") !== null, "leaf rejects children");
ok(BT.rejectionReason("tab", "pushbutton") !== null, "tab rejects non-panels");
ok(BT.rejectionReason("panel", "combobox") === null, "panel accepts combobox");

// ---------------------------------------------------------------------------
section("panelbutton is forced to zero-doc");
const pb = T.buildBundle("panelbutton", { type: "panelbutton", name: "PB", title: "", tooltip: "", context: "" }, "e6");
const pbYaml = pb.children.find((c) => c.name === "bundle.yaml").content;
ok(/context: "zero-doc"/.test(pbYaml), "panelbutton forced zero-doc: " + pbYaml.trim());

// ---------------------------------------------------------------------------
section("full tree from state");
state.tabs.tab1.panels.push("panel2");
state.panels.panel2 = { name: "Second Panel", elements: [], tabId: "tab1" };
state.panels.panel2.elements.push("el10", "el11", "el12");
state.elements.el10 = { type: "pushbutton", name: "Zebra", title: "Z: 2", tooltip: "tip #1", code: "", panelId: "panel2" };
state.elements.el11 = { type: "urlbutton", name: "Site", title: "Site", tooltip: "", hyperlink: "https://a.b", panelId: "panel2" };
state.elements.el12 = { type: "stack", name: "Pair", title: "", tooltip: "", children: ["el20", "el21"], panelId: "panel2" };
state.elements.el20 = { type: "pushbutton", name: "One", title: "", tooltip: "", code: "", parentId: "el12" };
state.elements.el21 = { type: "toggle", name: "Two", title: "", tooltip: "", code: "", parentId: "el12" };

const tree = FS.buildFolderStructure("My Extension");
const names = [];
(function walk(n) { names.push(n.name); (n.children || []).forEach(walk); })(tree);

ok(names[0] === "My Extension.extension", "root: " + names[0]);
ok(names.indexOf("extension.json") !== -1, "has extension.json");
ok(names.indexOf("INSTALL.txt") !== -1, "has INSTALL.txt");
ok(names.indexOf("My Tab.tab") !== -1, "tab keeps spaces");
ok(names.indexOf("My Panel.panel") !== -1, "panel");
ok(names.indexOf("Second Panel.panel") !== -1, "second panel");
ok(names.indexOf("Button 1.pushbutton") !== -1, "leaf button");
ok(names.indexOf("Zebra.pushbutton") !== -1, "button with title 'Z: 2'");
ok(names.indexOf("Site.urlbutton") !== -1, "url button");
ok(names.indexOf("Pair.stack") !== -1, "stack");
ok(names.indexOf("One.pushbutton") !== -1, "stack child 1");
ok(names.indexOf("Two.smartbutton") !== -1, "stack child 2 (toggle -> smartbutton)");

const findNode = (root, name) => {
  if (root.name === name) return root;
  for (const c of root.children || []) {
    const r = findNode(c, name);
    if (r) return r;
  }
  return null;
};

const panel2 = findNode(tree, "Second Panel.panel");
ok(!!panel2, "found second panel");
const layout = panel2.children.find((c) => c.name === "bundle.yaml");
ok(!!layout, "panel with reordered children gets bundle.yaml");
console.log("  panel2 bundle.yaml:\n" + layout.content.split("\n").map((l) => "    " + l).join("\n"));
const zebra = findNode(tree, "Zebra.pushbutton");
const zebraYaml = zebra.children.find((c) => c.name === "bundle.yaml").content;
console.log("  Zebra bundle.yaml:\n" + zebraYaml.split("\n").map((l) => "    " + l).join("\n"));
ok(/title: "Z: 2"/.test(zebraYaml), "colon in title is quoted safely");
ok(/tooltip: "tip #1"/.test(zebraYaml), "tooltip emitted");

// ---------------------------------------------------------------------------
section("validator");
ok(FS.validate().length === 0, "valid extension reports no problems: " + JSON.stringify(FS.validate()));

// empty stack -> must be caught
state.panels.panel2.elements.push("el30");
state.elements.el30 = { type: "stack", name: "Lonely", title: "", tooltip: "", children: [], panelId: "panel2" };
let probs = FS.validate();
ok(probs.length > 0, "0-child stack is reported");
console.log("  " + JSON.stringify(probs));
delete state.elements.el30;
state.panels.panel2.elements.pop();

// folder collision -> must be caught
state.panels.panel2.elements.push("el31");
state.elements.el31 = { type: "pushbutton", name: "zebra", title: "", tooltip: "", code: "", panelId: "panel2" };
probs = FS.validate();
ok(probs.some((p) => /same folder/i.test(p)), "sanitised collision reported: " + JSON.stringify(probs));
delete state.elements.el31;
state.panels.panel2.elements.pop();

// linkbutton missing required -> reported at build, bundle absent
state.panels.panel2.elements.push("el32");
state.elements.el32 = { type: "linkbutton", name: "Broken", title: "", tooltip: "", panelId: "panel2" };
probs = FS.validate();
ok(probs.length > 0, "linkbutton without assembly is reported");
console.log("  " + JSON.stringify(probs));
delete state.elements.el32;
state.panels.panel2.elements.pop();

ok(FS.validate().length === 0, "back to clean: " + JSON.stringify(FS.validate()));

// ---------------------------------------------------------------------------
section("v1 -> v2 migration");
const SL = (function () {
  const s = { version: "1.0" };
  return s;
})();
vm.runInContext(fs.readFileSync(path.join(dir, "save-load.js"), "utf8"), sandbox, { filename: "save-load.js" });
const SaveLoad = sandbox.SaveLoad;
const v1 = {
  version: "1.0",
  extensionName: "Old",
  tabs: { tab1: { name: "T", panels: ["panel1"] } },
  panels: { panel1: { name: "P", elements: ["b1", "b2", "b3"], tabId: "tab1" } },
  elements: {
    b1: { type: "togglebutton", name: "Tog", title: "", tooltip: "", code: "", panelId: "panel1" },
    b2: { type: "linkbutton", name: "Lnk", title: "", tooltip: "", url: "https://x.io", panelId: "panel1" },
    b3: { type: "invokebutton", name: "Inv", title: "", tooltip: "", command: "MyNs.Cmd", panelId: "panel1" },
  },
  activeTabId: "tab1",
};
const m = SaveLoad.migrate(v1);
ok(m.elements.b1.type === "toggle", "togglebutton -> toggle");
ok(m.elements.b2.type === "urlbutton", "linkbutton+url -> urlbutton");
ok(m.elements.b2.hyperlink === "https://x.io", "url moved to hyperlink");
ok(m.elements.b2.url === undefined, "url removed");
ok(m.elements.b3.command_class === "MyNs.Cmd", "command -> command_class");
ok(m.elements.b3.command === undefined, "command removed");
ok(m.elements.b1.iconDarkData === null, "iconDarkData back-filled");
ok(m.nextIds.element === 4, "nextIds derived: " + m.nextIds.element);

const empty = { version: "1.0", extensionName: "E", tabs: { t1: { name: "T", panels: [] } }, panels: {}, elements: {}, activeTabId: "t1" };
const me = SaveLoad.migrate(empty);
ok(Number.isFinite(me.nextIds.element), "no -Infinity with empty elements: " + me.nextIds.element);
ok(me.nextIds.element === 1, "empty starts at 1: " + me.nextIds.element);
ok(SaveLoad.validateLoadedState({ version: "9.0", extensionName: "x", tabs: { a: 1 }, panels: { a: 1 }, elements: {} }) !== null, "future version rejected");
ok(SaveLoad.validateLoadedState(v1) === null, "v1 accepted");

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
