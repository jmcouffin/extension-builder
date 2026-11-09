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

## For language models

The builder has an API for AI assistants, with no server: a JSON format, files
that describe it, a link that opens a description in the builder, and tools for
an agent running in the user's browser. Everything lives in `src/api/`.

| Piece | Where | What it is |
| --- | --- | --- |
| The extension spec | `src/api/spec.ts` | Nested JSON: `name` → `tabs` → `panels` → `items`, each bundle a `type`, a `name` and its parameters by their keys in the type table. `layoutFromSpec` reads one (never throws; says what is wrong at a JSON path such as `tabs[0].panels[1].items[2].hyperlink`), and `specFromLayout` writes one. |
| `/llms.txt` | `src/api/llms.ts` | How a model uses the builder, the format, an example, every type and parameter ([llmstxt.org](https://llmstxt.org)). |
| `/api/extension.schema.json` | `src/api/schema.ts` | The spec's JSON Schema (draft 2020-12), one `$defs` entry per bundle type. |
| `/api/example.json` | `src/api/spec.ts` | `EXAMPLE_SPEC`, the example llms.txt shows. |
| Import link | `src/api/importLink.ts` | `/#spec=<URL-encoded JSON>` (or base64url) opens the spec in the builder; `/?spec_url=<https URL>` fetches a hosted one. The spec is then taken out of the URL. Work in progress is replaced only after a confirm, as one undo step. Load also accepts a spec file. |
| WebMCP tools | `src/api/agentTools.ts`, `webmcp.ts` | `get_extension_schema`, `get_extension`, `validate_extension`, `set_extension`, `download_extension`, registered on `document.modelContext` (or `navigator.modelContext`) when the browser has WebMCP, and always on `window.pyrevitBuilder` for agents that script the page. |

The three published files are generated at build time from the type table (a
Vite plugin in `vite.config.ts`, served by the dev server too), so they always
match what the builder accepts. Unlike the builder's UI, a spec gets no start
values, so an assistant never ships a placeholder hyperlink by accident.

A required parameter left empty (a URL Button's hyperlink, a Link Button's
assembly) doesn't block the download, in the UI or for an agent: the extension
downloads, and the reply says which buttons won't work and what pyRevit will do
with them. The status bar counts them meanwhile, and Properties marks the row.

## Deploying

`main` holds the source. Every push to `main` runs
`.github/workflows/deploy.yml`, which lints, type-checks, tests and builds, then
publishes `dist/` to the root of the **`build`** branch. GitHub Pages serves the
`build` branch root, and `public/CNAME` is copied into every build, so the
custom domain stays attached.

**Pull request previews.** A pull request from a branch of this repository is
built the same way and published to `pr-<number>/` on the same branch, so it is
served at `https://builder.pyrevitlabs.io/pr-<number>/`; the workflow links it
in a comment on the pull request and updates that comment on every push.
Closing the pull request removes the folder
(`.github/workflows/preview-cleanup.yml`). A pull request from a fork gets no
preview: its token cannot write to the repository.

All three (site, preview, cleanup) go through `scripts/publish-pages.sh`, which
assembles the whole site (root plus every preview) and force-pushes it as a
single commit, so the branch never grows and stale hashed assets never pile up.
They share one concurrency group, so two runs never write the branch at once.
The app loads from a sub-path because Vite builds with relative asset paths
(`base: "./"`), which `e2e/subpath.spec.ts` checks.

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

## The Revit frame

The builder is laid out as Revit's own window, so what you build sits where
you will later find it:

| Revit | Here |
| --- | --- |
| Title bar and Quick Access Toolbar | logo, Load, Save, Undo, Redo, Reset, Download, the window title, the theme switch |
| Options Bar | the extension name |
| Ribbon, panels, panel title bars | the toolbar you are building |
| Green **Modify \| &lt;type&gt;** tab | appears when a bundle is selected (click it to open): Duplicate, Move to, Delete; Move Left/Right; Wrap in Stack, Wrap in Pulldown, Ungroup |
| Properties palette | the selected bundle, and the only editor: Type Selector, every parameter of its type in Revit's groups (Identity Data, Data, Constraints, Engine, Graphics, Other, Folder), Properties help and Apply |
| Project Browser | the folder tree the ZIP will contain; a bundle row selects that bundle |
| Drawing area and view tabs | the selected button on a light and a dark ribbon, its `bundle.yaml` and `script.py` |
| Status bar | what a click does, and whether the extension is ready to download |

A click on a ribbon item (or keyboard focus) selects it, as in Revit; a click
on empty ribbon clears the selection, and Properties then shows the extension
itself. Selection is not part of undo history. Properties applies a value when
you leave the cell or press Enter, Escape puts it back, and Apply is enabled
while a value is being edited. Every group starts open and every required
parameter is starred, and marked in red while it is empty.

**There is no edit dialog.** A panel's BUTTON, STACK and GROUP, a stack's empty
row and a pulldown's ADD COMMAND create the bundle on the spot ("Button 2", a
Pulldown holding one command, a two-row stack) and select it; its type is then
changed in the Type Selector (a command to any command, a group or stack to any
group) and everything else in Properties. A double-click on an item puts the
cursor in its Name. The script is edited in the drawing area's script.py tab
(the starter follows the title and author until you edit it; clearing an edit
brings it back), and a combo box's members in place in Properties.

**The Modify tab** holds what Properties and drag-and-drop don't do:

| Panel | Command | What it does |
| --- | --- | --- |
| Modify | Duplicate | copies the bundle, with its parameters, icons, script and children, right after itself as "&lt;name&gt; copy", and selects the copy; refused in a full stack |
| | Move to | lists every panel, stack and group of the extension, tab by tab; picking one sends the bundle there and opens that tab. Where its name is taken it takes the first free one ("Button 1 1"), and the menu says so; a place pyRevit would not load (a stack in a pulldown, a fourth row in a stack) is greyed with the reason |
| | Delete | asks, then deletes the bundle and what it holds |
| Arrange | Move Left / Right | one slot along its panel, stack or group; for touch screens, where dragging is awkward |
| Group | Wrap in Stack | puts a bundle that sits in a panel in a new stack, with a second command, as pyRevit skips a one-row stack |
| | Wrap in Pulldown | puts a command in a new pulldown in its place, in a panel or a stack |
| | Ungroup | puts a stack's or group's commands in its place and removes it; a command whose name is taken there gets the first free one |

A command that can't run on the selection is greyed, with the reason as its
tooltip. Each one is a single undo step.

The one colour that is not Revit's is the pyRevit logo's yellow, and it only
marks what you are building: the selection ring, drop markers, focus and the
Download button.

The Project Browser can be folded to its title bar; whether it is open is a
view preference (`pyrevit-extension-builder:prefs:v1`), kept apart from the
draft. Its tree scrolls inside the palette, never the page. On phones the frame
stacks: ribbon, Properties, Project Browser, drawing area; Properties comes first
because it is where a bundle is edited.

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
why in a dialog and changes nothing. The rules are the same ones the Type
Selector and the add buttons use (`src/domain/rules.ts`), so the paths cannot disagree. Movement has to pass
6px before a drag starts, so click (open a group), click-to-rename and
double-click (edit in Properties) still work on the same item. The keyboard works too: focus an
item, press Space, move with the arrow keys, press Space again.

## Dialogs

There is no `window.alert` or `window.confirm` anywhere. Every message and
question goes through `showAlert` / `showConfirm` (`src/state/dialogs.ts`),
rendered by one `DialogHost` as a shadcn `AlertDialog`, styled like Revit's own
dialogs. `DialogHost` claims Escape on `window` in the capture phase, so Escape
always closes the dialog on top (Saved Layouts can sit under a confirm). The
e2e suite fails any test in which a native dialog appears.

## Themes

**T** cycles through the themes and **Shift+T** goes back (never while you are
typing in a field); the hint sits in the title bar, beside a menu that shows
each theme as a small window. A switch runs behind a short wave of pixels in
the pyRevit logo's yellows and slates; with the system set to reduce motion it
is instant. Nothing reloads and the ribbon you are building is untouched. The
choice is saved per browser; `?theme=<id>` in the URL overrides it, which is
how a link can open the builder in a given theme. A tiny inline script in
`index.html` applies the saved theme before first paint, so a reload never
flashes the default.

| id | Theme | Source |
| --- | --- | --- |
| `builder` | Revit Light (default) | Revit's light interface, `src/theme/frame.css` |
| `revit-dark` | Revit Dark | Revit 2024+ dark interface; the ribbon shows each button's dark icon, as pyRevit does |
| `pyrevit` | pyRevit | the logo's palette: its slates for the chrome, its yellows for the active tab, panel titles and selection |
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

The cascade has seven layers, lowest first (`src/theme/tailwind.css`):
Tailwind's theme variables, a base layer, the app's stylesheet (`legacy`),
components, utilities, the Revit frame (`frame`: the shared layout and the
Revit Light paint), and themes last. Tailwind's preflight is deliberately not
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
`bundle.yaml` keys. Everything else — the Type Selector, Properties, the folder tree, the
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
| URL Button | `.urlbutton` | needs `hyperlink:`; starts at `https://pyrevitlabs.io` |
| Content Button | `.content` | `content:` names the family (`content.rfa`), which you add yourself |
| Pulldown | `.pulldown` | group |
| Split Button | `.splitbutton` | group |
| Split Push Button | `.splitpushbutton` | group |
| Combo Box | `.combobox` | items come from `members:` (starts with two sample items), not child folders |
| No Button | `.nobutton` | script with no ribbon button |
| Stack | `.stack` | 2–3 commands; fewer than 2 is skipped by pyRevit |
| Link Button | `.linkbutton` | needs `assembly:` + `command_class:` (start as samples to replace) |
| Invoke Button | `.invokebutton` | needs `assembly:` (a sample to replace); `command_class:` is optional |

Nesting is enforced where you build it, not at export time: a pulldown only
offers leaf commands, a stack refuses a nested stack, and dropping something
illegal is rejected with the reason.

## Parameters

Every `bundle.yaml` key pyRevit's parser reads that a builder user can set
(`BundleParser.cs`, `ParseTopLevelNode` and `ParseEngine`) is a parameter in
the type table, attached to the types whose loader uses it, and appears in
Properties for those types:

| Group | Parameters | Types |
| --- | --- | --- |
| Identity Data | Name, Title, Tooltip, `author`, `help_url` (F1) | all buttons and groups |
| Data | `hyperlink`; `assembly`, `command_class`, `availability_class`; `content`, `content_alt`; `members` | URL; Link / Invoke; Content; Combo Box |
| Constraints | `context` (forced to `zero-doc` on Panel Button), `min_revit_version`, `max_revit_version` | script buttons, URL, Content, groups; versions on all |
| Engine | `engine: clean`, `full_frame`, `persistent` | Push Button, Toggle, Panel Button, No Button |
| Graphics | icon, dark icon, on icon (Toggle), script, `large_icon` | per type |
| Other | `highlight` (new / updated), `is_beta` | all buttons and groups |

Required keys start filled, so a new bundle is always well-formed:
`hyperlink` with `https://pyrevitlabs.io`, `content` with `content.rfa`,
`members` with two sample items, and `assembly` / `command_class` with
`MyAddin` / `MyAddin.MyCommand`. Those two are placeholders: the status bar
counts them as "sample values to replace" until they are changed, without
blocking the download. A yes/no parameter is written only when it is on, a
Revit version as a bare number, and the engine options as an `engine:` block.

Left out on purpose: `templates`, `modules` (C# script references; the builder
writes Python), `layout` (written for you from the order you build),
`inherit_icon` (its default, on, is what you want), localized titles, and the
panel- and tab-level keys (`background`, `collapsed`).

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
- **properties**: creating never opens a dialog and selects what it made;
  every bundle type shows every parameter of the type table with required
  ones starred and filled and groups open; required values start working or
  as counted samples; an emptied required value still downloads, saying which button won't work and why; yes/no,
  version, engine, author and highlight reach `bundle.yaml` and the ZIP; the
  script is edited in the drawing area; members in place; a stack becomes a
  pulldown;
- **ribbon**: tabs, panels, rename, delete guards, stack confirm, draft restore
  and RESET;
- **modify**: Duplicate copies and selects; Move to sends a bundle to another
  tab, renamed there, in one undo, and greys a place pyRevit would not load
  with the reason; Wrap in Stack adds the second row; Wrap in Pulldown then
  Ungroup puts the button back;
- **drag and drop**: reorder in a panel and in a stack, into and out of a stack,
  into a pulldown and back out of its open list, across panels, illegal and
  over-full drops refused with a reason, click and double-click still working;
- **import**: a `#spec=` link opens its extension and leaves the URL; a broken
  spec is refused with the JSON path of each error; work in progress is
  replaced only after a confirm, and Undo brings it back; Load opens a spec
  file; `/llms.txt`, the schema and the example are served, and the link in
  llms.txt opens as it is;
- **webmcp**: the five tools register on a fake `document.modelContext` with
  their schemas; `set_extension` builds the example in the ribbon,
  `get_extension` reads it back unchanged, `download_extension` downloads it, a
  broken spec is refused, and `window.pyrevitBuilder` works without WebMCP;
- **export**: the ZIP holds only folder suffixes pyRevit knows, real PNG icons,
  no `__init__.py` / `entrypoint.py` / `.pyrevit`; broken extensions are refused
  with a list; save and load of a layout file round-trips.

Every one of those runs four times: once per theme (`builder` keeps the bare project
names, other themes run as `<size>-<theme>`), with the theme seeded into
`localStorage` before the first page load, and with reduced motion so a
switch is instant. `theme.spec.ts` adds switching, persistence, `?theme=`, the
token contract, the identical download, the soundtrack, the T / Shift+T
shortcut and the pixel transition (in the logo's colours, and absent with
reduced motion). `frame.spec.ts` covers selection, the Properties palette, the
Type Selector, the Modify tab, the Project Browser and the ribbon preview.

`pnpm test:visual` compares full-page screenshots of five states (default,
populated, Properties of a URL button, dialog, group editor) at every size in
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
