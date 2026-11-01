/**
 * The themes the switcher offers. This is menu metadata only: what a theme
 * looks like lives entirely in its CSS (src/theme/frame.css for the default,
 * src/theme/themes/<id>.css for the others, scoped to
 * :root[data-theme="<id>"]). No component reads the active theme, so every
 * theme renders exactly the same markup.
 *
 * "builder" keeps its id so a visitor's saved choice still means the same
 * thing; it is the Revit light interface.
 */
export type ThemeId = "builder" | "revit-dark" | "legacy-8bit";

/** The colours of a theme's thumbnail in the menu: a tiny window. */
export interface ThemePreview {
  frame: string;
  ribbon: string;
  line: string;
  icon: string;
  iconFill: string;
  accent: string;
  canvas: string;
}

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  preview: ThemePreview;
}

export const THEMES: ThemeDef[] = [
  {
    id: "builder",
    label: "Revit Light",
    description: "Revit's light interface, with pyRevit yellow for what you build.",
    preview: {
      frame: "#eef0f2",
      ribbon: "#ffffff",
      line: "#b8bfc8",
      icon: "#2f6fb3",
      iconFill: "#dceaf7",
      accent: "#f1c40f",
      canvas: "#ffffff",
    },
  },
  {
    id: "revit-dark",
    label: "Revit Dark",
    description: "Revit's dark interface, from Revit 2024 on.",
    preview: {
      frame: "#2a2f36",
      ribbon: "#3a414b",
      line: "#5a6472",
      icon: "#8ec0ff",
      iconFill: "#2d4c6b",
      accent: "#f1c40f",
      canvas: "#1e2329",
    },
  },
  {
    id: "legacy-8bit",
    label: "Legacy 8-bit",
    description: "The original builder: neon magenta, pixel type and a soundtrack.",
    preview: {
      frame: "#320452",
      ribbon: "#381153",
      line: "#ff00c8",
      icon: "#ffd000",
      iconFill: "#7c297c",
      accent: "#ffd000",
      canvas: "#240238",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "builder";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeDef);
}

/** The theme `step` places after `id` in the menu's order, wrapping round. */
export function nextTheme(id: ThemeId, step = 1): ThemeId {
  const i = THEMES.findIndex((t) => t.id === id);
  const n = THEMES.length;
  return (THEMES[(((i + step) % n) + n) % n] as ThemeDef).id;
}

/**
 * The colours of the pyRevit logo (src/assets/logo.svg): its three yellows
 * and three slate blues. The theme transition is painted in these.
 */
export const LOGO_COLORS = ["#FFD633", "#2C3E50", "#FFCF10", "#34495E", "#F1C40F", "#0B1014"];
