// Drives the real page in Chrome: clicks through every bundle type and checks
// the generated tree. Not part of the site.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://127.0.0.1:8777/index.html";

const REAL_POSTFIXES = new Set([
  ".extension", // the extension root (ExtensionParser.cs:327)
  ".tab", ".panel", ".pushbutton", ".pulldown", ".splitbutton", ".splitpushbutton",
  ".stack", ".smartbutton", ".panelbutton", ".linkbutton", ".invokebutton",
  ".urlbutton", ".content", ".nobutton", ".combobox",
]);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--window-size=1400,1000"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console.error: " + m.text());
  });
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));

  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  const window_bundleIsContainer = (t) =>
    page.evaluate((id) => !!window.BundleTypes.get(id).container, t);

  let failures = 0;
  const ok = (c, m) => { if (!c) { failures++; console.log("  FAIL " + m); } };
  const section = (n) => console.log("\n== " + n);
  section("page booted with no errors");
  ok(errors.length === 0, "startup errors: " + errors.join(" | "));
  ok(await page.$("#ribbonContainer .panel") !== null, "a panel rendered");
  ok(await page.$(".tab") !== null, "a tab rendered");
  ok(await page.$("#ribbonContainer .button") !== null, "the default button rendered");
  ok(await page.$("#ribbonContainer .delete-button, #ribbonContainer .element-delete-button") !== null,
     "default button has a delete control");

  section("no autoplay");
  const playing = await page.evaluate(() => {
    const a = document.querySelector("audio");
    return { playing: !!(a && !a.paused), hasAudio: !!a, status: document.getElementById("statusText").textContent };
  });
  ok(!playing.hasAudio || !playing.playing, "audio is not playing on load");
  ok(playing.status === "Music Off", "status reads 'Music Off', got: " + playing.status);

  section("default folder preview");
  const preview = await page.$eval("#folderPreview", (e) => e.textContent);
  ok(/My Extension\.extension/.test(preview), "preview shows the extension folder");
  ok(/My Tab\.tab/.test(preview), "preview shows the tab");
  ok(/Button 1\.pushbutton/.test(preview), "preview shows the button");
  console.log(preview.split("\n").map((l) => "    " + l).join("\n"));

  section("type picker is generated from the table");
  // The picker is built when the modal opens, for the current container.
  await page.click("#ribbonContainer .panel .add-button[data-action='add-button']");
  await new Promise((r) => setTimeout(r, 200));
  const tiles = await page.$$eval("#buttonTypeGrid .button-type", (els) =>
    els.map((e) => ({ type: e.dataset.type, postfix: e.querySelector(".type-postfix").textContent }))
  );
  console.log("  " + tiles.map((t) => t.type + "->" + t.postfix).join("  "));
  ok(tiles.length === 9, "picker offers all 9 non-container types, got " + tiles.length);
  tiles.forEach((t) => {
    ok(REAL_POSTFIXES.has(t.postfix), t.type + " tile shows non-pyRevit postfix " + t.postfix);
  });
  ok(!tiles.some((t) => t.type === "stack"), "containers are not in the command picker");
  ok(tiles.some((t) => t.type === "urlbutton"), "urlbutton is offered");
  ok(tiles.some((t) => t.type === "linkbutton"), "linkbutton is reachable (not filtered out)");
  ok(tiles.some((t) => t.type === "invokebutton"), "invokebutton is reachable");
  ok(tiles.some((t) => t.type === "nobutton"), "nobutton is reachable");
  const groups = await page.$$eval("#buttonTypeGrid .type-group h4", (e) => e.map((x) => x.textContent));
  console.log("  groups: " + groups.join(" | "));
  ok(groups.indexOf(".NET") !== -1, ".NET types are in their own group");
  await page.click(".cancel-button");
  await new Promise((r) => setTimeout(r, 150));

  section("URL Button: advanced fields appear and are required");
  await page.click("#ribbonContainer .panel .add-button[data-action='add-button']");
  await new Promise((r) => setTimeout(r, 200));
  const hasModal = await page.$eval("#buttonModal", (e) => e.style.display);
  ok(hasModal === "block", "modal opened");
  await page.click('.button-type[data-type="urlbutton"]');
  await new Promise((r) => setTimeout(r, 120));
  const urlState = await page.evaluate(() => {
    const g = document.querySelector('.advanced-field[data-field="hyperlink"]');
    const c = document.querySelector('.advanced-field[data-field="context"]');
    const a = document.querySelector('.advanced-field[data-field="assembly"]');
    return {
      open: document.getElementById("advancedDisclosure").open,
      hyperlink: g ? getComputedStyle(g).display : null,
      context: c ? getComputedStyle(c).display : null,
      assembly: a ? getComputedStyle(a).display : null,
    };
  });
  ok(urlState.hyperlink === "block", "hyperlink field shown for URL Button");
  ok(urlState.context === "block", "context field shown for URL Button");
  ok(urlState.assembly === "none", "assembly field hidden for URL Button");
  ok(urlState.open === false, "advanced stays collapsed until needed");

  // Required field must block submission.
  page.on("dialog", async (d) => { await d.accept(); });
  await page.click("#createButton");
  await new Promise((r) => setTimeout(r, 250));
  const stillOpen = await page.$eval("#buttonModal", (e) => e.style.display);
  ok(stillOpen === "block", "missing hyperlink blocks creation");

  await page.$eval("#adv_hyperlink", (e) => { e.value = "https://pyrevitlabs.io"; });
  await page.$eval("#buttonName", (e) => { e.value = "Docs Link"; });
  await page.click("#createButton");
  await new Promise((r) => setTimeout(r, 350));
  ok(await page.$eval("#buttonModal", (e) => e.style.display) === "none", "modal closed after valid input");
  const hasUrlBtn = await page.$('.button[data-type="urlbutton"]');
  ok(!!hasUrlBtn, "URL button appears in the ribbon");

  section("POST -> tab, panel, stack all render");
  await page.click("#addTab");
  await new Promise((r) => setTimeout(r, 250));
  let tabs = await page.$$eval(".tab", (els) => els.length);
  ok(tabs === 2, "second tab created");
  ok(await page.$$eval(".tab.active", (e) => e.length) === 1, "exactly one active tab");
  ok(await page.$("#ribbonContainer .panel") !== null, "the new tab auto-activated and shows its panel");
  ok(await page.$("#ribbonContainer .panel .button") !== null, "the new tab's panel has a seeded command");

  await page.click("#addPanel");
  await new Promise((r) => setTimeout(r, 250));
  ok(await page.$$eval("#ribbonContainer .panel", (e) => e.length) === 2, "second panel added");

  await page.click(".panel .add-button[data-action='add-stack']");
  await new Promise((r) => setTimeout(r, 300));
  const stackInfo = await page.evaluate(() => ({
    stacks: document.querySelectorAll("#ribbonContainer .stack").length,
    invalid: document.querySelectorAll("#ribbonContainer .stack-invalid").length,
    children: document.querySelectorAll("#ribbonContainer .stack .button").length,
    inState: Object.keys(window.appState.elements).filter(
      (k) => window.appState.elements[k].type === "stack"
    ).length,
  }));
  console.log("  " + JSON.stringify(stackInfo));
  ok(stackInfo.stacks === 1, "stack created in the DOM");
  ok(stackInfo.inState === 1, "stack created in state");
  ok(stackInfo.children === 2, "stack seeded with 2 commands");
  ok(stackInfo.invalid === 0, "2-command stack is not flagged invalid");

  section("a group only accepts leaf commands (real nesting whitelist)");
  await page.click(".panel .add-button[data-action='add-group']");
  await new Promise((r) => setTimeout(r, 250));
  const groupPicker = await page.$$eval("#buttonTypeGrid .button-type", (els) => els.map((e) => e.dataset.type));
  console.log("  container types offered by +GROUP: " + groupPicker.join(", "));
  ok(groupPicker.length > 0, "+GROUP offers container types");
  ok(groupPicker.every((t) => window_bundleIsContainer(t)), "+GROUP offers only containers");
  ok(groupPicker.indexOf("pulldown") !== -1, "pulldown is creatable");
  ok(groupPicker.indexOf("stack") !== -1, "stack is offered as a group too");
  ok(groupPicker.indexOf("combobox") === -1,
     "combobox is not a container (its content comes from members:), so not here");
  const codeHidden = await page.$eval("#buttonCodeGroup", (e) => getComputedStyle(e).display);
  ok(codeHidden === "none", "script box hidden for a container");
  await page.$eval("#buttonName", (e) => { e.value = "My Tools"; });
  await page.click("#createButton");
  await new Promise((r) => setTimeout(r, 350));
  ok(await page.$("#ribbonContainer .group") !== null, "group created");
  ok(await page.$eval("#buttonCodeGroup", (e) => getComputedStyle(e).display) === "none",
     "script box hidden for a container after create");

  // Open the group's editor, then add a command from inside it. That is the
  // picker scoped to the group, which is where the whitelist bites.
  await page.click("#ribbonContainer .group .group-header");
  await new Promise((r) => setTimeout(r, 250));
  ok(await page.$eval("#pulldownContentContainer", (e) => e.style.display) === "block", "group editor opened");
  const editorHtml = await page.$eval("#pulldownContentContainer", (e) => e.innerHTML.slice(0, 300));
  const addBtn = await page.$("#pulldownContentContainer .group-editor-add");
  ok(!!addBtn, "group editor has an add button; html=" + editorHtml);
  if (!addBtn) throw new Error("no group-add button; html=" + editorHtml);
  await addBtn.click();
  await new Promise((r) => setTimeout(r, 250));
  const groupTypes = await page.$$eval("#buttonTypeGrid .button-type", (els) => els.map((e) => e.dataset.type));
  console.log("  offered inside a group: " + groupTypes.join(", "));
  ok(!groupTypes.includes("stack"), "stack is not offered inside a group");
  ok(!groupTypes.includes("pulldown"), "nested pulldown is not offered");
  ok(!groupTypes.includes("splitbutton"), "nested split button is not offered");
  ok(!groupTypes.includes("combobox"), "combobox is not offered inside a group");
  ok(groupTypes.includes("pushbutton"), "pushbutton is offered");
  ok(groupTypes.includes("toggle"), "toggle is offered");
  await page.click(".cancel-button");
  await new Promise((r) => setTimeout(r, 150));

  section("full download: build the ZIP in-page and inspect it");
  const outDir = path.join(__dirname, ".verify-out");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const extracted = await page.evaluate(async () => {
    // Intercept the object URL so we can read the blob back out.
    const realCreate = URL.createObjectURL;
    let captured = null;
    URL.createObjectURL = function (blob) { captured = blob; return realCreate.call(URL, blob); };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { /* suppress the download */ };

    document.getElementById("downloadZip").click();
    for (let i = 0; i < 100 && !captured; i++) await new Promise((r) => setTimeout(r, 50));
    HTMLAnchorElement.prototype.click = realClick;
    URL.createObjectURL = realCreate;
    if (!captured) return { error: "no blob produced" };

    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve({ b64: fr.result.split(",")[1], size: captured.size });
      fr.readAsDataURL(captured);
    });
  });

  ok(!extracted.error, extracted.error || "");
  if (extracted.b64) {
    const zipPath = path.join(outDir, "out.zip");
    const buf = Buffer.from(extracted.b64, "base64");
    fs.writeFileSync(zipPath, buf);

    // Decode the archive with the stub and check the icons really carry bytes.
    const JSZip = require("jszip");
    const zip = await JSZip.loadAsync(buf);
    const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    const icons = paths.filter((p) => /icon\.png$/.test(p));
    console.log("  zip: " + paths.length + " files, " + icons.length + " icons");
    ok(icons.length >= 5, "every button bundle has an icon, got " + icons.length);
    for (const p of icons) {
      const data = await zip.files[p].async("base64");
      const isPng = Buffer.from(data, "base64").slice(1, 4).toString() === "PNG";
      ok(isPng, p + " is not a real PNG");
      ok(data.length > 100, p + " is only " + data.length + " bytes - probably the blank placeholder");
    }

    // No FOLDER may carry a postfix pyRevit does not know.
    const dirs = Object.keys(zip.files).filter((p) => zip.files[p].dir);
    const bad = dirs.filter((p) => {
      const name = p.split("/").filter(Boolean).pop();
      if (name.indexOf(".") === -1) return false; // the .extension root itself
      const ext = name.slice(name.indexOf("."));
      return !REAL_POSTFIXES.has(ext);
    });
    ok(bad.length === 0, "folders with unrecognised postfix: " + bad.join(", "));
    console.log("  folders: " + dirs.length + ", all postfixes recognised");

    const allPaths = Object.keys(zip.files);
    ok(!allPaths.some((p) => /__init__\.py$|entrypoint|\.pyrevit$/i.test(p)),
       "no __init__.py / entrypoint.py / .pyrevit emitted");
    ok(allPaths.some((p) => /INSTALL\.txt$/.test(p)), "INSTALL.txt shipped in the archive");
  }

  section("validator blocks an under-filled stack");
  const trimmed = await page.evaluate(() => {
    const st = window.appState;
    const stackId = Object.keys(st.elements).find(
      (k) => st.elements[k].type === "stack"
    );
    if (!stackId) return null;
    st.elements[stackId].children = st.elements[stackId].children.slice(0, 1);
    window.UIElements.renderPanels();
    return st.elements[stackId].children.length;
  });
  ok(trimmed === 1, "test trimmed the stack to 1 command");
  await new Promise((r) => setTimeout(r, 250));
  ok(await page.$("#ribbonContainer .stack-invalid") !== null, "1-command stack flagged in the UI");
  const probs = await page.evaluate(() => window.FolderStructure.validate());
  ok(probs.some((p) => /at least 2/.test(p)), "validator reports the stack: " + JSON.stringify(probs));

  section("v1 layout migrates on load");
  const migration = await page.evaluate(() => {
    const v1 = {
      version: "1.0",
      extensionName: "Legacy Ext",
      tabs: { tab1: { name: "Old Tab", panels: ["panel1"] } },
      panels: { panel1: { name: "Old Panel", elements: ["b1", "b2", "b3"], tabId: "tab1" } },
      elements: {
        b1: { type: "togglebutton", name: "Old Toggle", title: "", tooltip: "", code: "", panelId: "panel1" },
        b2: { type: "linkbutton", name: "Old Link", title: "", tooltip: "", url: "https://legacy.io", panelId: "panel1" },
        b3: { type: "invokebutton", name: "Old Invoke", title: "", tooltip: "", command: "Ns.Cmd", panelId: "panel1" },
      },
      activeTabId: "tab1",
    };
    window.SaveLoad.applyLoadedState(window.SaveLoad.migrate(v1));
    return {
      types: Object.keys(window.appState.elements).map((k) => window.appState.elements[k].type),
      hyperlink: window.appState.elements.b2.hyperlink,
      commandClass: window.appState.elements.b3.command_class,
      nextIds: window.appState.nextIds,
      extName: document.getElementById("extensionName").value,
      panelCount: document.querySelectorAll("#ribbonContainer .panel").length,
    };
  });
  ok(migration.types.join(",") === "toggle,urlbutton,invokebutton", "types remapped: " + migration.types.join(","));
  ok(migration.hyperlink === "https://legacy.io", "url became hyperlink");
  ok(migration.commandClass === "Ns.Cmd", "command became command_class");
  ok(migration.nextIds.element === 4, "nextIds: " + migration.nextIds.element);
  ok(migration.extName === "Legacy Ext", "extension name restored");
  ok(migration.panelCount === 1, "UI re-rendered for the loaded layout");
  await new Promise((r) => setTimeout(r, 200));

  const afterLoad = await page.evaluate(() => window.FolderStructure.validate());
  ok(
    afterLoad.every((p) => !/Legacy/.test(p)),
    "no stale-Legacy problems: " + JSON.stringify(afterLoad)
  );
  console.log("  post-migration validator (expected: link/invoke need .NET fields): " + JSON.stringify(afterLoad));

  section("no modal needs a scrollbar, at any size");
  // The worst case is a .NET type with Advanced open: every field visible.
  for (const vp of [
    { w: 1400, h: 1050 },
    { w: 1280, h: 800 },
    { w: 1024, h: 768 },
  ]) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await new Promise((r) => setTimeout(r, 200));
    for (const open of [false, true]) {
      await page.click(".panel .add-button[data-action='add-button']");
      await new Promise((r) => setTimeout(r, 200));
      await page.click('.button-type[data-type="linkbutton"]');
      await page.evaluate((v) => {
        document.getElementById("advancedDisclosure").open = v;
      }, open);
      await new Promise((r) => setTimeout(r, 200));
      const m = await page.evaluate(() => {
        const c = document.querySelector(".modal-content");
        const grid = document.getElementById("buttonTypeGrid");
        const adv = document.getElementById("advancedDisclosure");
        return {
          overflow: c.scrollHeight - c.clientHeight,
          grid: grid.scrollHeight - grid.clientHeight,
          adv: adv.scrollHeight - adv.clientHeight,
          h: Math.round(c.getBoundingClientRect().height),
        };
      });
      const label = vp.w + "x" + vp.h + (open ? " advanced-open" : " advanced-closed");
      ok(m.overflow <= 0, label + ": modal overflows by " + m.overflow + "px");
      ok(m.grid <= 0, label + ": type picker scrolls by " + m.grid + "px");
      ok(m.adv <= 0, label + ": advanced section scrolls by " + m.adv + "px");
    }
    await page.click(".cancel-button");
    await new Promise((r) => setTimeout(r, 150));
  }
  await page.setViewport({ width: 1400, height: 1050 });
  await new Promise((r) => setTimeout(r, 200));

  section("no errors accumulated during the whole run");
  ok(errors.length === 0, "runtime errors: " + errors.join(" | "));

  await page.screenshot({ path: path.join(outDir, "builder.png"), fullPage: true });
  console.log("\nscreenshot: " + path.join(outDir, "builder.png"));

  await browser.close();
  console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
