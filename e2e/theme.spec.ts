import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import JSZip from "jszip";
import { addStack, expect, openApp, test } from "./fixtures";

// Every token a theme must provide. The shadcn tokens are derived from these
// in src/theme/tokens.css, so a theme that sets these is complete.
const CONTRACT = [
  "--surface-app",
  "--surface-ribbon",
  "--surface-raised",
  "--surface-sunken",
  "--surface-hover",
  "--border-separator",
  "--border-subtle",
  "--text-primary",
  "--text-secondary",
  "--accent",
  "--accent-strong",
  "--accent-hover",
  "--on-accent",
  "--warn",
  "--danger",
  "--danger-fill",
  "--font-ui",
  "--font-mono",
  "--border-radius-sm",
  "--border-radius-md",
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--border",
  "--ring",
  "--modal",
  "--overlay",
];

const menu = (page: Page) => page.locator('[data-slot="dropdown-menu-content"]');

async function pickTheme(page: Page, id: string) {
  // A click on the trigger while the previous menu is still animating closed
  // is swallowed by Radix, so let it finish first; a person is never faster.
  await expect(menu(page)).toHaveCount(0);
  await page.locator("#themeSwitcher").click();
  await page.locator(`[data-theme-option="${id}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", id);
  await expect(menu(page)).toHaveCount(0);
}

async function tokens(page: Page) {
  return page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]));
  }, CONTRACT);
}

async function zipContents(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadZip").click();
  const zip = await JSZip.loadAsync(await readFile(await (await downloadPromise).path()));
  const out: Record<string, string> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    out[name] = file.dir ? "" : Buffer.from(await file.async("uint8array")).toString("base64");
  }
  return out;
}

test.describe("themes", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("the project opens in its theme", async ({ page, theme }) => {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("#themeSwitcher")).toBeVisible();
  });

  test("switching is instant, keeps the work, and survives a reload", async ({ page, theme }) => {
    const other = theme === "builder" ? "legacy-8bit" : "builder";
    await addStack(page);
    await page.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });

    await pickTheme(page, other);
    expect(await page.evaluate(() => "__sameDocument" in window), "the page reloaded").toBe(true);
    await expect(page.locator(".stack")).toHaveCount(1);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", other);
    await expect(page.locator(".stack")).toHaveCount(1);
  });

  test("?theme= opens a given theme", async ({ page }) => {
    await page.goto("/?theme=legacy-8bit");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "legacy-8bit");
    await page.goto("/?theme=builder");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "builder");
  });

  test("an unknown ?theme= falls back to the saved theme", async ({ page, theme }) => {
    await page.goto("/?theme=no-such-theme");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  });

  test("every theme provides the whole token contract", async ({ page }) => {
    const options = await page
      .locator("#themeSwitcher")
      .click()
      .then(() =>
        page
          .locator("[data-theme-option]")
          .evaluateAll((els) => els.map((e) => e.getAttribute("data-theme-option") ?? "")),
      );
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    expect(options.length).toBeGreaterThanOrEqual(2);

    const seen: Record<string, Record<string, string>> = {};
    for (const id of options) {
      await pickTheme(page, id);
      const values = await tokens(page);
      for (const [name, value] of Object.entries(values)) {
        expect(value, `${id} does not define ${name}`).not.toBe("");
      }
      seen[id] = values;
    }
    expect(seen["legacy-8bit"]?.["--surface-app"]).not.toBe(seen.builder?.["--surface-app"]);
    expect(seen["legacy-8bit"]?.["--font-ui"]).toContain("Pixelify Sans");
  });

  test("the logo follows the theme, in CSS alone", async ({ page }) => {
    const logo = page.getByRole("img", { name: "pyRevit Logo" });
    await pickTheme(page, "legacy-8bit");
    await expect(logo).toHaveCSS("content", /logo-[\w-]+\.png/);
    await pickTheme(page, "builder");
    await expect(logo).toHaveCSS("content", "normal");
  });

  test("every theme renders exactly the same markup", async ({ page }) => {
    await addStack(page);
    await page.locator("#previewDisclosure summary").click();
    const markup = () =>
      page.evaluate(() => {
        const root = document.getElementById("root")?.cloneNode(true) as HTMLElement;
        // The switcher names the active theme; that label is the one
        // intended difference.
        root.querySelector("#themeSwitcher")?.remove();
        // The preview's measured height is layout, and a theme may move it.
        root.querySelector(".preview-panel")?.removeAttribute("style");
        return root.outerHTML;
      });

    await pickTheme(page, "builder");
    const plain = await markup();
    await pickTheme(page, "legacy-8bit");
    expect(await markup()).toBe(plain);
  });

  test("switching theme keeps the layout", async ({ page }) => {
    await addStack(page);
    // Regions the page layout sizes: they must keep both place and size.
    const fixed = [".extension-name", ".ribbon-container", ".preview-panel"];
    // Boxes sized by their own text (a panel is as wide as its footer): a
    // wider typeface may widen them - by how much depends on the fonts the
    // machine has - but they must not move.
    const textSized = [".logo", ".panel"];
    const boxes = () =>
      page.evaluate(
        (sels) =>
          sels.map((sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return { sel, x: r?.x ?? -1, y: r?.y ?? -1, w: r?.width ?? -1 };
          }),
        [...fixed, ...textSized],
      );

    await pickTheme(page, "builder");
    const plain = await boxes();
    await pickTheme(page, "legacy-8bit");
    const themed = await boxes();
    plain.forEach((a, i) => {
      const b = themed[i];
      expect(Math.abs(a.x - (b?.x ?? 0)), `${a.sel} moved sideways`).toBeLessThanOrEqual(2);
      expect(Math.abs(a.y - (b?.y ?? 0)), `${a.sel} moved down`).toBeLessThanOrEqual(12);
      if (fixed.includes(a.sel)) {
        expect(Math.abs(a.w - (b?.w ?? 0)), `${a.sel} changed width`).toBeLessThanOrEqual(2);
      }
    });
  });

  test("the download is identical in every theme", async ({ page }) => {
    await addStack(page);
    await pickTheme(page, "builder");
    const plain = await zipContents(page);
    await pickTheme(page, "legacy-8bit");
    const themed = await zipContents(page);
    expect(Object.keys(themed).sort()).toEqual(Object.keys(plain).sort());
    for (const name of Object.keys(plain)) {
      expect(themed[name], `${name} differs between themes`).toBe(plain[name]);
    }
  });
});

test.describe("soundtrack", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("the control is always there; only a theme with music shows it", async ({ page }) => {
    await pickTheme(page, "builder");
    await expect(page.getByTestId("music-control")).toHaveCount(1);
    await expect(page.getByTestId("music-control")).toBeHidden();
    await pickTheme(page, "legacy-8bit");
    await expect(page.getByTestId("music-control")).toBeVisible();
  });

  test("the pixel font is not downloaded until a theme uses it", async ({ page, theme }) => {
    test.skip(theme !== "builder", "only a fresh default-theme visit can show this");
    const fonts: string[] = [];
    page.on("request", (r) => {
      if (/pixelify/.test(r.url())) fonts.push(r.url());
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    expect(fonts).toEqual([]);
    await pickTheme(page, "legacy-8bit");
    await expect.poll(() => fonts.length).toBeGreaterThan(0);
  });

  test("is off by default at half volume, and is not downloaded until played", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".mp3")) requested.push(r.url());
    });
    await pickTheme(page, "legacy-8bit");
    const control = page.getByTestId("music-control");
    await expect(control.getByRole("button", { name: "Play music" })).toBeVisible();
    await expect(control).toContainText("Music Off");
    await expect(control.getByRole("slider", { name: "Music volume" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    await page.waitForTimeout(300);
    expect(requested, "the track was fetched before anyone pressed play").toEqual([]);

    await control.getByRole("button", { name: "Play music" }).click();
    await expect(control).toContainText("Now Playing");
    expect(requested.length).toBeGreaterThan(0);

    await control.getByRole("button", { name: "Pause music" }).click();
    await expect(control).toContainText("Music Off");
  });

  test("remembers the volume, but never resumes playing on its own", async ({ page }) => {
    await pickTheme(page, "legacy-8bit");
    const control = page.getByTestId("music-control");
    const slider = control.getByRole("slider", { name: "Music volume" });
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuenow", "40");
    await control.getByRole("button", { name: "Play music" }).click();
    await expect(control).toContainText("Now Playing");

    await page.reload();
    await expect(page.getByTestId("music-control")).toContainText("Music Off");
    await expect(
      page.getByTestId("music-control").getByRole("slider", { name: "Music volume" }),
    ).toHaveAttribute("aria-valuenow", "40");
  });

  test("switching to a theme without music stops it", async ({ page }) => {
    await pickTheme(page, "legacy-8bit");
    await page.getByRole("button", { name: "Play music" }).click();
    await expect(page.getByTestId("music-control")).toContainText("Now Playing");
    await pickTheme(page, "builder");
    await expect(page.getByTestId("music-control")).toBeHidden();
    await pickTheme(page, "legacy-8bit");
    await expect(page.getByTestId("music-control")).toContainText("Music Off");
  });
});
