import { create } from "zustand";
import { readPref, writePref } from "../state/persistence";
import { DEFAULT_THEME, isThemeId, nextTheme, type ThemeId } from "./themes";

/** A running pixel transition. `key` restarts the animation on every switch. */
export interface Wipe {
  to: ThemeId;
  key: number;
}

interface ThemeState {
  themeId: ThemeId;
  wipe: Wipe | null;
  /** Apply a theme at once, with no transition. */
  setTheme(id: ThemeId): void;
}

/**
 * The transition is a wave of pixels in the logo's colours. Each block fades
 * in, holds and fades out (WIPE_BLOCK_MS), and the wave crosses the screen in
 * WIPE_SPREAD_MS. The spread is short enough that, for a moment, every block
 * is fully opaque at once: that moment is when the theme is swapped, so the
 * change itself is never seen.
 */
export const WIPE_BLOCK_MS = 720;
export const WIPE_SPREAD_MS = 180;
export const WIPE_SWAP_MS = 440;
export const WIPE_END_MS = WIPE_BLOCK_MS + WIPE_SPREAD_MS + 40;

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
  wipe: null,
  setTheme: (id) => {
    applyTheme(id);
    writePref("theme", id);
    set({ themeId: id });
  },
}));

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

let swapTimer: ReturnType<typeof setTimeout> | undefined;
let endTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Switch theme the way a person does: behind the pixel transition, unless
 * they asked their system for less motion, in which case it is instant.
 * A switch during a running transition finishes the previous one at once and
 * starts again, so a fast double press always lands on the last theme asked.
 */
export function switchTheme(id: ThemeId) {
  const state = useTheme.getState();
  const pending = state.wipe?.to;
  if (id === (pending ?? state.themeId)) return;

  clearTimeout(swapTimer);
  clearTimeout(endTimer);
  if (pending) state.setTheme(pending);

  if (prefersReducedMotion()) {
    useTheme.setState({ wipe: null });
    useTheme.getState().setTheme(id);
    return;
  }

  useTheme.setState({ wipe: { to: id, key: Date.now() } });
  swapTimer = setTimeout(() => useTheme.getState().setTheme(id), WIPE_SWAP_MS);
  endTimer = setTimeout(() => useTheme.setState({ wipe: null }), WIPE_END_MS);
}

/** The next (or, with -1, the previous) theme in the menu's order. */
export function cycleTheme(step = 1) {
  const { themeId, wipe } = useTheme.getState();
  switchTheme(nextTheme(wipe?.to ?? themeId, step));
}

export function startTheme() {
  const id = initialTheme();
  applyTheme(id);
  useTheme.setState({ themeId: id });
}
