// Rigorous WCAG text-contrast audit of the live page. Not part of the site.
//
// The first version of this was too lenient: it only looked at direct text
// nodes, so it never saw text drawn by ::before/::after (the postfix badges,
// the delete cross), it skipped anything under 50% opacity, it ignored
// ::placeholder, and it never opened the modal's collapsed state. All of those
// are real text a user reads, so all of them are checked here.
const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Same expectations WCAG gives: 4.5:1 for body text, 3:1 for large text
// (>=24px, or >=18.66px bold).
const MIN_BODY = 4.5;
const MIN_LARGE = 3.0;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1050 });
  await page.goto("http://127.0.0.1:8777/index.html", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 900));

  const setName = (v) =>
    page.$eval("#buttonName", (e, val) => {
      e.value = val;
    }, v);

  // Build a page that exercises every control type.
  await page.click(".panel .add-button[data-action='add-stack']");
  await new Promise((r) => setTimeout(r, 250));
  await page.click(".panel .add-button[data-action='add-group']");
  await new Promise((r) => setTimeout(r, 250));
  await setName("My Tools");
  await page.click("#createButton");
  await new Promise((r) => setTimeout(r, 350));
  for (const n of ["Snap Grids", "Walls Report"]) {
    await page.click(".panel .add-button[data-action='add-button']");
    await new Promise((r) => setTimeout(r, 250));
    await setName(n);
    await page.click("#createButton");
    await new Promise((r) => setTimeout(r, 300));
  }

  const AUDIT = () => {
    /* These run inside the page, so they cannot close over Node scope. */
    const MIN_BODY = 4.5;
    const MIN_LARGE = 3.0;

    /* ---------- colour maths, in the page ---------- */
    const parse = (c) => {
      if (!c) return null;
      const m = String(c).match(/[\d.]+/g);
      if (!m) return null;
      return {
        r: +m[0], g: +m[1], b: +m[2],
        a: m.length > 3 ? +m[3] : 1,
      };
    };
    const blend = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    };
    const hex = (c) =>
      "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

    // Effective background: walk up compositing every non-transparent layer.
    const bgOf = (el) => {
      const layers = [];
      let n = el;
      while (n && n.nodeType === 1) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a === 1) break;
        }
        n = n.parentElement;
      }
      if (!layers.length) layers.push({ r: 255, g: 255, b: 255, a: 1 });
      // bottom-most first
      let out = layers[layers.length - 1];
      for (let i = layers.length - 2; i >= 0; i--) {
        out = blend(layers[i], out);
      }
      // Fold in ancestor opacity, which also dims the text.
      return out;
    };

    // Effective opacity of an element's text.
    const opacityOf = (el) => {
      let o = 1;
      let n = el;
      while (n && n.nodeType === 1) {
        o *= parseFloat(getComputedStyle(n).opacity) || 0;
        if (getComputedStyle(n).position === "fixed") break;
        n = n.parentElement;
      }
      return o;
    };

    const sel = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) return s + "#" + el.id;
      if (el.className && typeof el.className === "string") {
        return s + "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
      }
      return s;
    };

    const rows = [];
    const push = (o) => rows.push(o);

    const needs = (px, weight) => (px >= 24 || (px >= 18.66 && weight >= 700) ? MIN_LARGE : MIN_BODY);

    /* ---------- 1. real text nodes ---------- */
    document.querySelectorAll("body, body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;

      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();
      if (!text) return;

      const fgRaw = parse(cs.color);
      if (!fgRaw) return;
      const bg = bgOf(el);
      const o = opacityOf(el);
      // Fully transparent is not rendered, so contrast does not apply. Partial
      // opacity is a real case and is measured as composited.
      if (o === 0) return;
      const fg = o < 1 ? blend({ ...fgRaw, a: fgRaw.a * o }, bg) : fgRaw;
      const px = parseFloat(cs.fontSize);
      const weight = +cs.fontWeight;
      const ratioOut = ratio(fg, bg);

      push({
        kind: "text",
        what: '["' + text.slice(0, 24) + '"]',
        where: sel(el),
        fg: hex(fg), bg: hex(bg), px: +px.toFixed(1), opacity: +o.toFixed(2),
        ratio: +ratioOut.toFixed(2), need: needs(px, weight),
        pass: ratioOut >= needs(px, weight),
      });

      /* ---------- 2. ::placeholder ---------- */
      if (
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
        el.placeholder &&
        cs.webkitTextFillColor !== "rgba(0, 0, 0, 0)"
      ) {
        const pc = parse(cs.webkitTextFillColor) || parse(cs.color);
        const pfg = o < 1 ? blend({ ...pc, a: pc.a * o }, bg) : pc;
        const pr = ratio(pfg, bg);
        push({
          kind: "placeholder",
          what: '["' + el.placeholder.slice(0, 20) + '"]',
          where: sel(el),
          fg: hex(pfg), bg: hex(bg), px: +px.toFixed(1), opacity: +o.toFixed(2),
          ratio: +pr.toFixed(2), need: needs(px, weight),
          pass: pr >= needs(px, weight),
        });
      }
    });

    /* ---------- 3. text drawn by pseudo-elements ---------- */
    const sheetRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) walk(rule.cssRules);
          else if (rule.selectorText && rule.style && rule.style.content) {
            sheetRules.push(rule);
          }
        }
      };
      walk(rules);
    }

    for (const rule of sheetRules) {
      const pseudoMatch = rule.selectorText.match(/::?(before|after|placeholder|file-selector-button|webkit-file-upload-button)\b/i);
      if (!pseudoMatch) continue;
      const content = rule.style.content;
      if (!content || content === "none" || content === "normal") continue;
      const glyph = content.replace(/^["']|["']$/g, "").replace(/\\[0-9a-f]+/gi, "?").replace(/\\00d7/i, "x");
      if (!glyph || glyph === "" || /^\\[0-9a-f]+$/i.test(glyph)) {
        if (!glyph) continue;
      }

      const baseSel = rule.selectorText
        .replace(/::?(before|after|placeholder|file-selector-button|webkit-file-upload-button)[^:]*$/i, "")
        .trim();
      if (!baseSel) continue;

      let hosts = [];
      try {
        hosts = Array.from(document.querySelectorAll(baseSel));
      } catch {
        continue;
      }

      for (const host of hosts) {
        const cs = getComputedStyle(host);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = host.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;

        const bg = bgOf(host);
        const o = opacityOf(host);
        if (o === 0) continue; // not rendered
        const fgRaw = parse(rule.style.color) || parse(cs.color);
        if (!fgRaw) continue;
        const fg = o < 1 ? blend({ ...fgRaw, a: fgRaw.a * o }, bg) : fgRaw;
        const px = parseFloat(rule.style.fontSize || cs.fontSize);
        const cr = ratio(fg, bg);
        const need = needs(px, 400);

        push({
          kind: "pseudo",
          what: '::' + pseudoMatch[1].toLowerCase() + ' "' + glyph.slice(0, 14) + '"',
          where: sel(host),
          fg: hex(fg), bg: hex(bg), px: +px.toFixed(1), opacity: +o.toFixed(2),
          ratio: +cr.toFixed(2), need: need,
          pass: cr >= need,
        });
      }
    }

    return rows;
  };

  const report = (rows, label) => {
    const fails = rows.filter((r) => !r.pass);
    const tiny = rows.filter((r) => r.px < 9);
    console.log("\n== " + label);
    console.log("  checked " + rows.length + " text renderings (" +
      [...new Set(rows.map((r) => r.kind))].join(", ") + ")");
    console.log("  worst 8 ratios:");
    rows
      .slice()
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 8)
      .forEach((r) =>
        console.log(
          "    " + String(r.ratio.toFixed(2)).padStart(5) + " need " + r.need +
          "  " + String(r.px).padStart(4) + "px a=" + r.opacity +
          "  " + r.fg + " on " + r.bg + "  " + r.where + "  " + r.what
        )
      );
    if (tiny.length) {
      console.log("  under 9px (" + tiny.length + "): " +
        [...new Set(tiny.map((r) => r.where + " " + r.px + "px"))].join(" | "));
    }
    if (fails.length) {
      console.log("  FAILS (" + fails.length + "):");
      fails.forEach((r) =>
        console.log(
          "    " + r.ratio.toFixed(2) + " need " + r.need + "  " + String(r.px) + "px a=" + r.opacity +
          "  " + r.fg + " on " + r.bg + "  [" + r.kind + "] " + r.where + " " + r.what
        )
      );
    } else {
      console.log("  no AA failures");
    }
    return fails;
  };

  let fails = report(await page.evaluate(AUDIT), "page, ribbon at rest");

  // Hover states: reveal the delete buttons and the badge, then re-audit.
  await page.hover("#ribbonContainer .button");
  await new Promise((r) => setTimeout(r, 250));
  fails = fails.concat(report(await page.evaluate(AUDIT), "page, hovering an item (delete + badge visible)"));

  // Modal, collapsed advanced.
  await page.click(".panel .add-button[data-action='add-button']");
  await new Promise((r) => setTimeout(r, 300));
  fails = fails.concat(report(await page.evaluate(AUDIT), "modal, advanced collapsed"));

  // Modal, advanced open - the busiest state.
  await page.click('.button-type[data-type="combobox"]');
  await page.evaluate(() => {
    document.getElementById("advancedDisclosure").open = true;
  });
  await new Promise((r) => setTimeout(r, 300));
  fails = fails.concat(report(await page.evaluate(AUDIT), "modal, combobox + advanced open"));

  await page.screenshot({ path: ".verify-out/contrast-modal.png" });
  await page.click(".cancel-button");
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: ".verify-out/contrast-page.png", fullPage: true });

  await browser.close();
  console.log("\n" + (fails.length === 0 ? "ALL TEXT PASSES AA" : fails.length + " FAILURE(S)"));
  process.exit(fails.length === 0 ? 0 : 1);
})();
