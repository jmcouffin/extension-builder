/**
 * The themes the switcher offers. This is menu metadata only: what a theme
 * looks like lives entirely in its CSS file (src/theme/themes/<id>.css,
 * scoped to :root[data-theme="<id>"]). No component reads the active theme,
 * so every theme renders exactly the same markup.
 */
export type ThemeId = "builder" | "legacy-8bit";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  /** Three colours for the switcher's preview chip: surface, accent, text. */
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: "builder",
    label: "Builder",
    description: "The current look: Revit's grey ribbon chrome with a deep blue accent.",
    swatch: ["#b9bec3", "#0f6cbd", "#14181b"],
  },
  {
    id: "legacy-8bit",
    label: "Legacy 8-bit",
    description: "The original builder: neon magenta on purple, pixel type and a soundtrack.",
    swatch: ["#320452", "#ff00c8", "#ffd000"],
  },
];

export const DEFAULT_THEME: ThemeId = "builder";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeDef);
}
