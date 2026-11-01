import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * Every spec runs once per viewport. The builder is a desktop tool, but it
 * must stay usable - nothing clipped, nothing overlapping, no sideways page
 * scroll - down to a tablet held upright and a phone.
 */
export const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-1400", width: 1400, height: 1050 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "small-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "phone-390", width: 390, height: 844 },
] as const;

/**
 * And once per theme. The default theme keeps the bare viewport names (and so
 * its visual baselines); every other theme runs the same specs under
 * "<viewport>-<theme>", with the theme saved in localStorage before the first
 * page load, exactly as a returning visitor would have it.
 */
export const THEMES = ["builder", "legacy-8bit"] as const;

function seededTheme(theme: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: `http://localhost:${PORT}`,
        localStorage: [
          { name: "pyrevit-extension-builder:prefs:v1", value: JSON.stringify({ theme }) },
        ],
      },
    ],
  };
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: THEMES.flatMap((theme) =>
    VIEWPORTS.map(({ name, width, height }) => ({
      name: theme === "builder" ? name : `${name}-${theme}`,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width, height },
        theme,
        storageState: seededTheme(theme),
      },
    })),
  ),
  webServer: [
    {
      command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // dist/ exists once the first server has built it; Playwright starts
      // the servers in order and waits for each URL before the next.
      command: "node e2e/serve-subpath.mjs 4175",
      url: "http://localhost:4175/extension-builder/",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
