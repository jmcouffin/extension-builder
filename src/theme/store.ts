import { create } from "zustand";
import { readPref, writePref } from "../state/persistence";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

interface ThemeState {
  themeId: ThemeId;
  setTheme(id: ThemeId): void;
}

/**
 * `?theme=` wins over the saved choice, so a link can open the builder in a
 * given theme. The inline script in index.html applies the same rule before
 * first paint; this store takes over from there.
 */
export function initialTheme(): ThemeId {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("theme");
    if (isThemeId(fromUrl)) return fromUrl;
  } catch {
    // no location in some test environments
  }
  const saved = readPref<unknown>("theme", DEFAULT_THEME);
  return isThemeId(saved) ? saved : DEFAULT_THEME;
}

/** The only thing a theme switch does: point the stylesheet at another theme. */
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export const useTheme = create<ThemeState>((set) => ({
  themeId: DEFAULT_THEME,
  setTheme: (id) => {
    applyTheme(id);
    writePref("theme", id);
    set({ themeId: id });
  },
}));

export function startTheme() {
  const id = initialTheme();
  applyTheme(id);
  useTheme.setState({ themeId: id });
}
