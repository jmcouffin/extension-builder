import { PaletteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "../theme/store";
import { getTheme, isThemeId, THEMES } from "../theme/themes";

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span className="theme-swatch inline-flex overflow-hidden rounded-sm border border-border">
      {colors.map((c) => (
        <span key={c} className="block h-3 w-2" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

/** Switches the whole page's theme instantly; the choice is remembered. */
export function ThemeSwitcher() {
  const themeId = useTheme((s) => s.themeId);
  const setTheme = useTheme((s) => s.setTheme);
  const current = getTheme(themeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="toolbar"
          size="toolbar"
          id="themeSwitcher"
          aria-label={`Theme: ${current.label}. Change theme`}
        >
          <PaletteIcon aria-hidden="true" />
          <span className="toolbar-action-label">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-menu w-72" data-testid="theme-menu">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={themeId}
          onValueChange={(value) => {
            if (isThemeId(value)) setTheme(value);
          }}
        >
          {THEMES.map((theme) => (
            <DropdownMenuRadioItem
              key={theme.id}
              value={theme.id}
              className="items-start gap-2 py-2"
              data-theme-option={theme.id}
            >
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  <Swatch colors={theme.swatch} />
                  {theme.label}
                </span>
                <span className="text-xs text-muted-foreground">{theme.description}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
