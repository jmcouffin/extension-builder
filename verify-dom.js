// Static check: every id/class the JS reaches for must exist in index.html.
const fs = require("fs");
const path = require("path");
const dir = __dirname;

const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const files = [
  "app.js", "audio.js", "bundle-types.js", "drag-drop.js", "event-handlers.js",
  "folder-structure.js", "modal-handlers.js", "save-load.js", "template.js",
  "ui-elements.js",
];

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  FAIL " + m); } };

const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const htmlClasses = new Set(
  [...html.matchAll(/\sclass="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean)
);

console.log("== getElementById references");
const seenIds = new Map();
files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of src.matchAll(/getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    if (!seenIds.has(m[1])) seenIds.set(m[1], new Set());
    seenIds.get(m[1]).add(f);
  }
});
[...seenIds.keys()].sort().forEach((id) => {
  ok(htmlIds.has(id), '"' + id + '" (' + [...seenIds.get(id)].join(",") + ") is not in index.html");
});
console.log("  " + seenIds.size + " distinct ids referenced, all present: " + !failures);

console.log("== ids created by JS but referenced by id");
const jsCreated = new Set();
files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of src.matchAll(/\.id\s*=\s*[`"']([^`"']+)[`"']/g)) jsCreated.add(m[1]);
});
const requiredByCode = new Set();
files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of src.matchAll(/getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) requiredByCode.add(m[1]);
});
[...requiredByCode].forEach((id) => {
  ok(
    htmlIds.has(id) || jsCreated.has(id),
    '"' + id + '" is neither in HTML nor assigned anywhere in JS'
  );
});

console.log("== CSS classes selected from JS exist in CSS");
const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
const cssClasses = new Set(
  [...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1])
);
// Classes JS assigns via className / classList, and container classes it matches.
const jsClasses = new Set();
files.forEach((f) => {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*["']([a-zA-Z][\w-]*)["']/g)) {
    jsClasses.add(m[1]);
  }
  for (const m of src.matchAll(/className\s*=\s*["'`]\s*([a-zA-Z][\w-]*)/g)) {
    jsClasses.add(m[1]);
  }
  // Only real selector usage counts, not string literals like ".extension".
  for (const m of src.matchAll(/(?:querySelectorAll|querySelector|closest|matches)\(\s*["''`]([^"''`]+)["''`]/g)) {
    for (const c of m[1].match(/\.([a-zA-Z][\w-]*)/g) || []) jsClasses.add(c.slice(1));
  }
});
// Classes that are behavioural-only, or styled through a descendant/element
// selector rather than their own class.
const IGNORED = new Set([
  "selected", "dragging", "drag-over", "no-select", "active", "stack-edit-mode",
  "name", "type", "field", "placeholder", "unknown", "body", "icon", "help",
  "tab-name", // styled as ".tab input"
]);
[...jsClasses].sort().forEach((c) => {
  if (IGNORED.has(c)) return;
  ok(cssClasses.has(c) || htmlClasses.has(c), "class ." + c + " is used by JS but styled nowhere");
});

console.log("== index.html does not autoplay audio");
ok(!/audio\.play\(\)/.test(html), "no inline autoplay in HTML");
ok(/id="audioBtn"/.test(html), "audio button present");
ok(fs.existsSync(path.join(dir, "audio.js")), "audio.js exists");
ok(/id="statusText"/.test(html), "status text present");

console.log("== removed markup is gone");
ok(!/loading-overlay/.test(html), "loading overlay removed");
ok(!/data-type="pushbutton"/.test(html), "static type tiles removed from HTML");
ok(!/id="buttonUrl"/.test(html), "hardcoded URL field removed");
ok(!/id="buttonCommand"/.test(html), "hardcoded command field removed");
ok(/id="advancedDisclosure"/.test(html), "advanced disclosure present");
ok(/id="buttonTypeGrid"/.test(html), "type grid host present");
ok(/id="advancedFields"/.test(html), "advanced fields host present");

console.log("== every script tag resolves");
[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].forEach((m) => {
  const src = m[1];
  if (/^https?:/.test(src)) { console.log("  (cdn) " + src); return; }
  ok(fs.existsSync(path.join(dir, src)), "script " + src + " does not exist");
});

console.log("== no legacy references remain");
const legacy = {
  "togglebutton": "the dead .togglebutton type",
  "pulldown: true": "bogus yaml key",
  "invoke:": "bogus yaml key",
  "tabI": "the addNewTab crash",
  "generateLinkButtonYaml": "removed generator",
  "generateInvokeButtonYaml": "removed generator",
  "initializeButtonEvents": "removed renderer hook",
  "showPulldownContent": "renamed to openGroupEditor",
};
Object.keys(legacy).forEach((needle) => {
  // The migration table and its comment legitimately name the old type.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("\\b" + escaped + "\\b", "i");
  const hits = files.filter((f) => {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (f === "bundle-types.js" || f === "save-load.js") {
      return false; // LEGACY map + migration are the only legitimate mentions
    }
    return re.test(src);
  });
  ok(hits.length === 0, '"' + needle + '" (' + legacy[needle] + ") still in " + hits.join(","));
});

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
