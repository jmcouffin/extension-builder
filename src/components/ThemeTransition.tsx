import { type CSSProperties, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme, WIPE_BLOCK_MS, WIPE_SPREAD_MS } from "../theme/store";
import { LOGO_COLORS } from "../theme/themes";

const BLOCK = 48;

interface Block {
  key: string;
  left: number;
  top: number;
  color: string;
  delay: number;
}

function blocksFor(width: number, height: number): Block[] {
  const cols = Math.ceil(width / BLOCK);
  const rows = Math.ceil(height / BLOCK);
  const span = Math.max(1, cols + rows - 2);
  const blocks: Block[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      blocks.push({
        key: `${r}-${c}`,
        left: c * BLOCK,
        top: r * BLOCK,
        // A fixed scatter, not Math.random: the same pattern every time, so
        // the logo's yellows and slates always land in the same mix.
        color: LOGO_COLORS[(r * 7 + c * 5 + ((r * c) % 3)) % LOGO_COLORS.length] as string,
        // A diagonal wave from the top-left corner.
        delay: Math.round(((r + c) / span) * WIPE_SPREAD_MS),
      });
    }
  }
  return blocks;
}

/**
 * The pixel wave that covers a theme switch. Rendered outside #root, so it is
 * never part of the app's markup, and it never takes a click.
 */
export function ThemeTransition() {
  const wipe = useTheme((s) => s.wipe);
  const blocks = useMemo(
    () => (wipe ? blocksFor(window.innerWidth, window.innerHeight) : []),
    [wipe],
  );
  if (!wipe) return null;

  return createPortal(
    <div
      key={wipe.key}
      className="theme-transition"
      data-testid="theme-transition"
      aria-hidden="true"
      style={{ "--wipe-block-ms": `${WIPE_BLOCK_MS}ms` } as CSSProperties}
    >
      {blocks.map((b) => (
        <span
          key={b.key}
          className="theme-transition-block"
          style={{
            left: b.left,
            top: b.top,
            width: BLOCK,
            height: BLOCK,
            backgroundColor: b.color,
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
