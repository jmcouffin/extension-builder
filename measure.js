// Measures modal overflow. Not part of the site.
const puppeteer = require("puppeteer-core");

(async () => {
  const b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox"],
  });

  const cases = [
    { w: 1400, h: 1050, label: "desktop 1400x1050" },
    { w: 1280, h: 800, label: "laptop 1280x800" },
    { w: 1024, h: 768, label: "small 1024x768" },
  ];

  for (const c of cases) {
    const p = await b.newPage();
    await p.setViewport({ width: c.w, height: c.h });
    await p.goto("http://127.0.0.1:8777/index.html", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 700));

    const read = async (label, openAdvanced) => {
      // Open the modal on a .NET type: the worst case, every advanced field.
      await p.click(".panel .add-button[data-action='add-button']");
      await new Promise((r) => setTimeout(r, 250));
      await p.click('.button-type[data-type="linkbutton"]');
      await p.evaluate((v) => { document.getElementById("advancedDisclosure").open = v; }, openAdvanced);
      await new Promise((r) => setTimeout(r, 250));

      const m = await p.evaluate(() => {
        const content = document.querySelector(".modal-content");
        const grid = document.getElementById("buttonTypeGrid");
        const adv = document.getElementById("advancedDisclosure");
        return {
          viewportH: window.innerHeight,
          contentH: Math.round(content.getBoundingClientRect().height),
          overflowPx: content.scrollHeight - content.clientHeight,
          gridScrolls: grid.scrollHeight > grid.clientHeight,
          advScrolls: adv.scrollHeight > adv.clientHeight,
        };
      });
      const bar = m.overflowPx > 0 || m.gridScrolls || m.advScrolls;
      console.log(
        "  " + label.padEnd(22) +
        " h=" + String(m.contentH).padEnd(5) +
        " overflow=" + String(m.overflowPx).padEnd(5) +
        " gridScroll=" + String(m.gridScrolls).padEnd(6) +
        " advScroll=" + String(m.advScrolls).padEnd(6) +
        (bar ? " <-- SCROLLBAR" : " ok")
      );
      return !bar;
    };

    console.log("\n== " + c.label);
    let clean = true;
    clean = (await read("advanced collapsed", false)) && clean;
    await p.screenshot({ path: ".verify-out/modal-closed-" + c.w + ".png" });
    clean = (await read("advanced open", true)) && clean;
    await p.screenshot({ path: ".verify-out/modal-open-" + c.w + ".png" });
    if (!clean) console.log("  ^^ " + c.label + " still scrolls somewhere");

    await p.close();
  }

  // And the page itself: is the whole layout larger than it needs to be?
  const p = await b.newPage();
  await p.setViewport({ width: 1400, height: 1050 });
  await p.goto("http://127.0.0.1:8777/index.html", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 700));
  const page = await p.evaluate(() => {
    const out = {};
    ["header", "main", ".extension-name", ".ribbon-container", ".tabs-container"].forEach((sel) => {
      const el = sel === "header" ? document.querySelector("header") : document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out[sel] = { w: Math.round(r.width), h: Math.round(r.height), pad: cs.padding, margin: cs.margin };
      }
    });
    out.bodyH = document.body.scrollHeight;
    out.docH = document.documentElement.scrollHeight;
    return out;
  });
  console.log("\n== page box sizes @1400x1050");
  Object.keys(page).forEach((k) => {
    if (typeof page[k] === "number") console.log("  " + k + ": " + page[k]);
    else console.log("  " + k + ": " + JSON.stringify(page[k]));
  });
  await p.close();
  await b.close();
})();
