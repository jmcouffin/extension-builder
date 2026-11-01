import { switchTheme, useTheme, WIPE_END_MS, WIPE_SWAP_MS } from "./store";
import { LOGO_COLORS, nextTheme, THEMES } from "./themes";

describe("themes", () => {
  it("offers Revit Light, Revit Dark and Legacy 8-bit, in that order", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["builder", "revit-dark", "legacy-8bit"]);
    expect(THEMES[0]?.label).toBe("Revit Light");
  });

  it("cycles both ways and wraps round", () => {
    expect(nextTheme("builder")).toBe("revit-dark");
    expect(nextTheme("legacy-8bit")).toBe("builder");
    expect(nextTheme("builder", -1)).toBe("legacy-8bit");
  });

  it("paints the transition in the pyRevit logo's colours", () => {
    expect(LOGO_COLORS).toEqual(["#FFD633", "#2C3E50", "#FFCF10", "#34495E", "#F1C40F", "#0B1014"]);
  });
});

describe("switchTheme", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTheme.setState({ themeId: "builder", wipe: null });
  });
  afterEach(() => vi.useRealTimers());

  it("swaps the theme behind the wave, then ends the wave", () => {
    switchTheme("revit-dark");
    expect(useTheme.getState().wipe?.to).toBe("revit-dark");
    expect(useTheme.getState().themeId).toBe("builder");
    vi.advanceTimersByTime(WIPE_SWAP_MS);
    expect(useTheme.getState().themeId).toBe("revit-dark");
    expect(document.documentElement.dataset.theme).toBe("revit-dark");
    vi.advanceTimersByTime(WIPE_END_MS);
    expect(useTheme.getState().wipe).toBeNull();
  });

  it("lands on the last theme asked when pressed twice quickly", () => {
    switchTheme("revit-dark");
    switchTheme("legacy-8bit");
    expect(useTheme.getState().themeId).toBe("revit-dark");
    vi.advanceTimersByTime(WIPE_END_MS);
    expect(useTheme.getState().themeId).toBe("legacy-8bit");
    expect(useTheme.getState().wipe).toBeNull();
  });
});
