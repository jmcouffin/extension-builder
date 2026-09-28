# pyRevit Extension Builder

A tool to create your pyRevit extension with no knowledge of programming.

Static site — plain HTML, CSS and JavaScript. No server, no build step, no
dependencies at runtime (JSZip comes from a CDN). Open `index.html` or serve
the folder with any static host.

## Your work is kept

The ribbon you are building is saved to `localStorage` on every change, so a
reload does not lose it. **RESET** in the header discards it and returns to a
single empty tab, panel and command. This is separate from SAVE/LOAD LAYOUT,
which is the explicit file you keep.

The draft is written from `FolderStructure.updateFolderPreview()` because every
mutation already passes through it — one hook rather than a dozen call sites
that would eventually miss one.

## The folder preview

The generated tree sits in a collapsible panel **beside** the ribbon, not below
it: the ribbon takes ~80% of the width and the preview ~20%, and the two columns
are `align-items: flex-start` so expanding a deep tree does not stretch the
toolbar. It is a native `<details>`, so it toggles and is keyboard accessible
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
same line as a full-height command's icon; the geometry is asserted in
`verify-browser.js` (`firstIcon` within 1px of `solo`). The one-third
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
app background show through as a grey wedge at the top left. `verify-browser.js`
asserts the strip is flush with the ribbon's right edge, does not overlap the
preview, that the `+` is inset at the far end, that the active tab matches the
panel surface while reaching the rule an unfocused tab stops short of, and that
no app-background grey appears in the strip's corners.

Delete is a small red cross in the top-right of the thing it removes. It
appears on hover, and its tooltip names the command and its bundle type.

## Why the type table exists

`bundle-types.js` is the single source of truth for every bundle type. Each row
carries the folder postfix, the files it emits, its nesting whitelist and its
`bundle.yaml` keys. Everything else — the modal picker, the folder tree, the
renderer, drag-and-drop rules, validation — reads from it.

This is deliberate. pyRevit identifies a bundle purely by the folder suffix, and
a suffix it does not recognise is **silently skipped**: the folder is simply
absent from the ribbon with no error anywhere
(`dev/pyRevitLoader/pyRevitExtensionParser/ExtensionParser.cs:1032-1035`).
Scattering that list across template, renderer and export code is how a type
ends up half-implemented, so there is now exactly one place it can go wrong,
and `verify.js` asserts it against pyRevit's own parser enum.

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

Not required to run the site.

```sh
node verify.js           # tree, YAML, sanitiser, validator, v1->v2 migration
node verify-dom.js       # every DOM/CSS reference resolves; no dead markup
npm i --no-save puppeteer-core jszip
node serve.js 8777 &
node verify-browser.js   # drives the real page, builds a ZIP, inspects it
node verify-contrast.js  # WCAG contrast of every rendered text, incl. ::after
node measure.js          # modal overflow and page box sizes, per viewport
```

`verify-browser.js` asserts the generated archive contains no folder whose
suffix pyRevit does not know, that icons carry real image bytes, and that no
`__init__.py`, `entrypoint.py` or `.pyrevit` is emitted — none of which pyRevit
expects or produces. It also asserts the modal, its type picker and the Advanced
section need no scrollbar at 1400x1050, 1280x800 or 1024x768, with Advanced
either collapsed or open, and that a draft survives a reload while RESET does
not.

`verify-dom.js` also asserts that every local asset in `index.html` is
cache-busted with a single shared `?v=` token. This matters more than it looks:
GitHub Pages serves these files with `Cache-Control: max-age=600`, so without a
version query a browser can pair a **fresh** `index.html` with a **stale**
`styles.css` or `ui-elements.js` and the published site renders differently from
the working copy for no visible reason. **Bump the token whenever you change a
local CSS or JS file** — the check fails loudly if you forget.

`verify-contrast.js` walks every rendered text — including text drawn by
`::after` and `::placeholder`, which a naive check misses entirely — resolves
its effective foreground against the composited background of its ancestors,
and compares to WCAG AA. It runs the page at rest and on hover, with the modal
open and closed. It is strict on purpose: the first version of it missed three
real failures.
