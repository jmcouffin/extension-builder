import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cycleTheme, switchTheme, useTheme } from "../theme/store";
import { getTheme, isThemeId, THEMES, type ThemePreview } from "../theme/themes";

/** The key that cycles themes; with Shift it goes back. */
export const THEME_KEY = "t";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * T cycles through the themes, Shift+T goes back. A bare letter rather than a
 * chord: every Ctrl/Alt chord on T is taken by a browser or an OS somewhere
 * (Ctrl+Shift+T reopens a tab, Alt+Shift+T focuses Chrome's toolbar, Ctrl+Alt
 * is AltGr on a French keyboard). It never fires while typing in a field.
 */
export function useThemeShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== THEME_KEY || isTypingTarget(e.target)) return;
      e.preventDefault();
      cycleTheme(e.shiftKey ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** A thumbnail of the builder in a theme: title bar, ribbon, palette, canvas. */
export function ThemeThumb({ preview, size }: { preview: ThemePreview; size: "chip" | "card" }) {
  const p = preview;
  return (
    <span
      className={`theme-thumb theme-thumb-${size}`}
      aria-hidden="true"
      style={{ borderColor: p.line, backgroundColor: p.frame }}
    >
      <span className="theme-thumb-title" style={{ borderColor: p.line }} />
      <span
        className="theme-thumb-ribbon"
        style={{ backgroundColor: p.ribbon, borderColor: p.line }}
      >
        <span style={{ backgroundColor: p.iconFill, borderColor: p.icon }} />
        <span style={{ backgroundColor: p.iconFill, borderColor: p.icon }} />
        <span style={{ backgroundColor: p.accent, borderColor: p.accent }} />
      </span>
      <span className="theme-thumb-body" style={{ backgroundColor: p.canvas }}>
        <span style={{ backgroundColor: p.frame, borderColor: p.line }} />
      </span>
    </span>
  );
}

/**
 * The shortcut hint, then the menu. The menu shows each theme as a small
 * window; picking one switches behind the pixel transition, like the key does.
 */
export function ThemeSwitcher() {
  const themeId = useTheme((s) => s.themeId);
  const current = getTheme(themeId);

  return (
    <div className="theme-switch">
      <span className="theme-hint" title="Press T for the next theme, Shift+T for the previous one">
        <kbd>T</kbd>
        <span className="theme-hint-text">next theme</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="theme-chip"
            id="themeSwitcher"
            aria-label={`Theme: ${current.label}. Change theme`}
          >
            <ThemeThumb preview={current.preview} size="chip" />
            <span className="theme-chip-label">{current.label}</span>
            <ChevronDownIcon aria-hidden="true" className="theme-chip-caret" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="theme-menu" data-testid="theme-menu">
          <DropdownMenuLabel className="theme-menu-label">
            <span>Theme</span>
            <span className="theme-menu-key">
              <kbd>T</kbd> next · <kbd>Shift</kbd>
              <kbd>T</kbd> back
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={themeId}
            onValueChange={(value) => {
              if (isThemeId(value)) switchTheme(value);
            }}
          >
            {THEMES.map((theme) => (
              <DropdownMenuRadioItem
                key={theme.id}
                value={theme.id}
                className="theme-option"
                data-theme-option={theme.id}
                indicator={false}
              >
                <ThemeThumb preview={theme.preview} size="card" />
                <span className="theme-option-text">
                  <span className="theme-option-name">{theme.label}</span>
                  <span className="theme-option-desc">{theme.description}</span>
                </span>
                {theme.id === themeId && (
                  <CheckIcon className="theme-option-check" aria-label="In use" />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
