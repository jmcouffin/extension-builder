# pyRevit Extension Builder

A tool to create your pyRevit extension with no knowledge of programming.

React + TypeScript single-page app, built with Vite, styled with Tailwind v4 and
shadcn/ui, linted and formatted with Biome, tested with Vitest and Playwright,
managed with pnpm.

```sh
pnpm install
pnpm dev          # local dev server
pnpm lint         # biome check
pnpm typecheck    # tsc
pnpm test         # vitest unit + component tests
pnpm test:e2e     # playwright, every spec at six screen sizes in every theme
pnpm test:visual:record  # record local pixel baselines (see Checks)
pnpm test:visual  # compare against them
pnpm build        # production build into dist/
```

`pnpm exec playwright install chromium` once before the first e2e run.

`.mcp.json` registers three Playwright MCP servers for Claude Code (and any other
MCP client) so an agent can drive the app at a fixed size: `playwright-desktop`
(1920x1080), `playwright-laptop` (1280x800) and `playwright-mobile` (iPhone 15).
Each runs headless in an isolated profile, from the version pinned in
`package.json`.

## Deploying

`main` holds the source. Every push to `main` runs
`.github/workflows/deploy.yml`, which lints, type-checks, tests and builds, then
force-pushes the contents of `dist/` as a single commit to the **`build`**
branch. GitHub Pages serves the `build` branch root, and `public/CNAME` is copied
into every build, so the custom domain stays attached.

Vite fingerprints every asset filename (`index-<hash>.js`), so a fresh
`index.html` can never be paired with a stale CSS or JS file from the Pages cache
— the manual `?v=` token the static version needed is gone.

## Your work is kept

The ribbon you are building is saved to `localStorage` on every change, so a
reload does not lose it. **RESET** in the header discards it and returns to a
single empty tab, panel and command. This is separate from SAVE/LOAD LAYOUT,
which is the explicit file you keep.

The draft is written from a single store subscription
(`src/state/persistence.ts`), so no action can forget to persist.

## The folder preview

The generated tree sits in a collapsible panel **beside** the ribbon, not below
it. Closed, it takes ~20% of the width (at least 260px). Open, it widens to fit
its longest line, so file names and the folder/file count are readable without
scrolling sideways — up to half the workspace, so the ribbon always keeps at
least as much; a deeper tree than that scrolls inside the panel. The two columns
are `align-items: flex-start` so expanding a deep tree does not stretch the
toolbar. On phones the preview sits under the ribbon at full width. It is a native `<details>`, so it toggles and is keyboard accessible
without any JavaScript, and it starts collapsed — the ribbon is what you work in
and the tree is a reference. Whether it is open is remembered separately from the
draft (`pyrevit-extension-builder:prefs:v1`), because it is a view preference
rather than part of the extension. The summary shows the folder and file counts,
so the state is visible without expanding it. The tree scrolls inside its own
panel rather than growing the page.

## The ribbon

The canvas is laid out the way Revit's ribbon is: tabs along the top, panels
side by side with a vertical rule between them, and each panel's name along the
bottom. Item sizing follows the same rules:

| | size | label |
| --- | --- | --- |
| single command | fills the panel height, 48px icon | below the icon |
| stack of 2 or 3 | column of rows, top-aligned, 16px icon (one third) | beside the icon |
| pulldown / split | full-height large button, 48px icon | below the icon, with a chevron |

A stack is top-aligned rather than centred, so its first row's icon lands on the
same line as a full-height command's icon. The one-third
relationship is a single custom property on `.button`, so the two numbers cannot
drift apart. The ribbon's height is sized to its tallest item rather than fixed,
so there is no dead space under a stack's last row or a group's chevron.

A group shows no chevron overlapping its title: the chevron is a rotated CSS
border, sized to its own content, and anchored to the header's padded bottom
edge, so it sits under the label whether that label is one line or wraps to two.
It is a border, not a text glyph, because a literal `▼` was re-encoded into
mojibake on the way to disk.

Add affordances are inline, not floating. A stack's `+` is the last row of the
column, exactly where the next command will appear, sized like a real row, and
it is always visible: a hover-revealed one cannot be found, and it is the only
way to reach a stack's minimum of two. The tab strip's `+` sits at the
right-hand end instead, because it is a control for the whole strip rather than
part of the tab list. Both are keyboard reachable.

The tab strip is the *top of the ribbon*, so it lives inside the ribbon column
and stops where the ribbon stops — as a sibling of the folder preview it ran the
full width and read as belonging to the tree. It is grey chrome while the panel
area below is near-white, and the active tab is pulled up over the strip's rule
so it reads as dropping into the panels; there is no underline marking the
selection, because the interrupted rule already does that. The strip's top
corners are square: rounding them clipped its own background and let the darker
app background show through as a grey wedge at the top left.

Delete is a small red cross in the top-right of the thing it removes. It
appears on hover, and its tooltip names the command and its bundle type.

## Dragging

Everything on the ribbon can be dragged with [dnd-kit](https://dndkit.com):
commands, pulldowns and split buttons by the item itself, stacks by the dotted
grip above them (every pixel of a stack is one of its rows, so it needs its own
handle). Where you let go decides what happens:

- on the left or right half of an item, the bundle lands before or after it,
  shown as a blue bar; in a stack or an open group list the halves are top and
  bottom;
- on the middle half of a stack or a group, it goes inside, shown as an outline;
- on the empty part of a panel, or an open group list, it goes at the end.

The target turns red when the drop is illegal (a stack in a stack, a fourth row,
a duplicate name, a group inside its own command), and letting go there explains
why in a dialog and changes nothing. The rules are the same ones the modal uses
(`src/domain/rules.ts`), so the two paths cannot disagree. Movement has to pass
6px before a drag starts, so click (open a group), click-to-rename and
double-click (edit) still work on the same item. The keyboard works too: focus an
item, press Space, move with the arrow keys, press Space again.

## Dialogs

There is no `window.alert` or `window.confirm` anywhere. Every message and
question goes through `showAlert` / `showConfirm` (`src/state/dialogs.ts`),
rendered by one `DialogHost` as a shadcn `AlertDialog` above the bundle modal
(itself a shadcn `Dialog`). Escape cancels the dialog before it reaches the
modal underneath: `DialogHost` claims Escape on `window` in the capture phase,
because Radix only learns a new layer is on top after a re-render, and a key
pressed in that gap would close the modal instead. The e2e suite fails any test
in which a native dialog appears.

## Themes

The palette button at the left of the header switches the whole page between
themes instantly, with no reload and without touching the ribbon you are
building. The choice is saved per browser; `?theme=<id>` in the URL overrides
it, which is how a link can open the builder in a given theme. A tiny inline
script in `index.html` applies the saved theme before first paint, so a reload
never flashes the default.

| id | Theme | Source |
| --- | --- | --- |
| `builder` | Builder (default) | the current Revit-inspired grey ribbon |
| `legacy-8bit` | Legacy 8-bit | the original design, ported from commit `2a7e8dd` (the last before the Revit redesign in `283e834`) |

**A theme is CSS and nothing else.** Switching sets `data-theme` on `<html>`;
no component reads the active theme, so every theme renders byte-for-byte the
same markup (an e2e test compares it) and keeps the same layout (another
checks that nothing moves by more than a changed typeface accounts for). A theme
restyles colours, type, radii, borders and glows; heavier frames are drawn with
outlines and inset shadows so no box changes size.

**Themes never change what you download.** The exported ZIP is byte-for-byte
the same in every theme, and a test checks it.

### How a theme is built

The cascade has five layers, lowest first (`src/theme/tailwind.css`):
Tailwind's theme variables, a base layer, the app's stylesheet (`legacy`),
component utilities, and themes last. Tailwind's preflight is deliberately not
imported: the app's stylesheet was written against browser defaults, and
preflight would silently restyle it. shadcn parts carry `data-slot`, and only
those get the few resets they need.

A theme is one CSS file under `src/theme/themes/`, scoped to
`:root[data-theme="<id>"]`, plus a line in `src/theme/themes.ts` that is only
menu metadata (label, description, swatch). The file sets the app's design
tokens (`--surface-*`, `--text-*`, `--accent*`, `--danger*`, fonts, radii); the
shadcn tokens (`--background`, `--primary`, `--border`, `--ring`, …) are derived
from those in `src/theme/tokens.css`, so setting the app tokens themes every
shadcn component too. There is no `dark:` variant in the components: a dark
theme is a theme whose tokens are dark, and Tailwind's default `dark:` would
follow the OS setting instead of the user's choice.

Everything a theme swaps is swappable from CSS:

- **fonts**: `@import` a `@fontsource` package in the theme file and name it in
  `--font-ui`; the browser downloads it only once text uses it, so other themes
  never pay for it;
- **the logo**: the header mark is one `<img>` in every theme; a theme replaces
  the picture with `content: url(...)` on `.logo-mark` (supported by Chromium,
  Firefox and WebKit on images);
- **the soundtrack**: its control is in every theme's markup and
  `display: none` by default; a theme that wants it shows it. When a switch
  hides it, it stops playing — it notices it is no longer on screen, without
  knowing which theme is active.

The e2e matrix runs every spec in every theme listed in `playwright.config.ts`,
and a contract test fails if any theme leaves a token undefined.

### The legacy 8-bit theme

Neon magenta on deep purple, glowing yellow type and pixel-cut frames: the
palette and type of the builder's first design (commit `2a7e8dd`, before the
Revit redesign in `283e834`), on today's layout. Pixelify Sans (OFL, bundled via
`@fontsource`) stands in for the original Pixelcraft, which was loaded from a
font CDN under an unclear licence.

It shows the soundtrack the original shipped with ("The Return of the 8-bit
Era", `src/assets/themes/legacy-8bit/music.mp3`, restored from `2a7e8dd`; its
original file name follows Pixabay's naming, so confirm its licence if the
site's use changes) as a compact play button and volume slider in the header:
off on every visit, starting at 50% and remembered, and the file is only fetched
the first time someone presses play. Animations are switched off for anyone who
asks their system for reduced motion.

## Why the type table exists

`src/domain/bundleTypes.ts` is the single source of truth for every bundle type. Each row
carries the folder postfix, the files it emits, its nesting whitelist and its
`bundle.yaml` keys. Everything else — the modal picker, the folder tree, the
renderer, drag-and-drop rules, validation — reads from it.

This is deliberate. pyRevit identifies a bundle purely by the folder suffix, and
a suffix it does not recognise is **silently skipped**: the folder is simply
absent from the ribbon with no error anywhere
(`dev/pyRevitLoader/pyRevitExtensionParser/ExtensionParser.cs:1032-1035`).
Scattering that list across template, renderer and export code is how a type
ends up half-implemented, so there is now exactly one place it can go wrong,
and `src/domain/domain.test.ts` asserts it against pyRevit's own parser enum.

Supported types, all 13 element postfixes pyRevit understands:

| Builder type | Folder suffix | Notes |
| --- | --- | --- |
| Push Button | `.pushbutton` | `script.py` |
| Toggle | `.smartbutton` | a toggle *is* a smartbutton with `on.png` / `off.png`; there is no `.togglebutton` in pyRevit |
| Panel Button | `.panelbutton` | context is forced to `zero-doc` |
| URL Button | `.urlbutton` | needs `hyperlink:` |
| Content Button | `.content` | needs a `content.rfa` you add yourself |
| Pulldown | `.pulldown` | group |
| Split Button | `.splitbutton` | group |
| Split Push Button | `.splitpushbutton` | group |
| Combo Box | `.combobox` | items come from `members:`, not child folders |
| No Button | `.nobutton` | script with no ribbon button |
| Stack | `.stack` | 2–3 commands; fewer than 2 is skipped by pyRevit |
| Link Button | `.linkbutton` | needs `assembly:` + `command_class:` |
| Invoke Button | `.invokebutton` | needs `assembly:` + `command_class:` |

Nesting is enforced where you build it, not at export time: a pulldown only
offers leaf commands, a stack refuses a nested stack, and dropping something
illegal is rejected with the reason.

## The Advanced section

`context`, `hyperlink`, `assembly`, `command_class`, `availability_class`,
`members` and the dark-theme icon are behind a disclosure, because most
extensions do not need them. Two of them are load-bearing when present:

- **`context`** — without it pyRevit generates no availability class at all, so
  the button is enabled unconditionally.
- **`assembly` / `command_class`** — `.linkbutton` and `.invokebutton` bind
  straight to a compiled .NET class. Without them the button is created and does
  nothing.

## Before you download

The builder refuses to produce an archive that pyRevit would not load, and says
why: illegal nesting, an under-filled stack, a missing required key, two names
that sanitise to the same folder, a content button with no `.rfa`.

## Checks

`pnpm test` covers what `verify.js` used to: the postfix table against pyRevit's
parser enum, the sanitiser, YAML quoting, every bundle type's files, nesting
rules, the validator and the v1→v2 layout migration. It also covers the store
(add, move, reorder, delete, type change), the drop resolver and the dialogs.

`pnpm test:e2e` drives the built site in Chromium at 1920x1080, 1400x1050,
1280x800, 1024x768, 768x1024 and 390x844. Every test fails on a page error, a
console error, a failed request or a native dialog. Across all sizes it checks:

- **layout**: no sideways page scroll, header actions inside the viewport and
  apart, ribbon and folder preview not overlapping, tab strip flush with the
  ribbon, items inside their panel, a stack's first row level with a
  full-height command's icon;
- **modal**: every bundle type fits the screen with Advanced open and closed,
  with no scrollbar from 1024x768 up; validation errors appear in app dialogs;
- **ribbon**: tabs, panels, rename, delete guards, stack confirm, draft restore
  and RESET;
- **drag and drop**: reorder in a panel and in a stack, into and out of a stack,
  into a pulldown and back out of its open list, across panels, illegal and
  over-full drops refused with a reason, click and double-click still working;
- **export**: the ZIP holds only folder suffixes pyRevit knows, real PNG icons,
  no `__init__.py` / `entrypoint.py` / `.pyrevit`; broken extensions are refused
  with a list; save and load of a layout file round-trips.

Every one of those runs twice: once per theme (`builder` keeps the bare project
names, other themes run as `<size>-<theme>`), with the theme seeded into
`localStorage` before the first page load. `theme.spec.ts` adds instant
switching, persistence, `?theme=`, the token contract, the identical download
and the soundtrack behaviour.

`pnpm test:visual` compares full-page screenshots of six states (default,
populated, modal, modal with Advanced, dialog, group editor) at every size in
every theme. No pixel may differ, and colour may drift by at most a hair
(`threshold: 0.02`; Playwright's default of 0.2 is wide enough to pass a brown
ribbon for a purple one).

The baselines are **not committed** (`e2e/*-snapshots/` is gitignored): font
rendering differs by OS and machine, so a baseline only means something on the
machine that recorded it. It is a before/after check for a change you are about
to make:

1. on the code you trust, `pnpm test:visual:record` (records every baseline);
2. make the change, then `pnpm test:visual`;
3. review any diffs in `test-results/` and, if they are intended, record again.

A baseline that does not exist yet is recorded on first run, and that run
reports it as a failure; the next run compares against it. CI skips `@visual`.

CI runs the unit tests and `pnpm test:e2e` before publishing, and uploads the
Playwright report when a test fails.
