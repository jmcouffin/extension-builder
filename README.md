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

## The ribbon

The canvas is laid out the way Revit's ribbon is: tabs along the top, panels
side by side with a vertical rule between them, and each panel's name along the
bottom. Item sizing follows the same rules:

| | size | label |
| --- | --- | --- |
| single command | fills the panel height, 48px icon | below the icon |
| stack of 2 or 3 | centred column of rows, 16px icon (one third) | beside the icon |
| pulldown / split | full-height large button | below the icon, with a caret |

A stack is centred rather than stretched, which is why a 2-stack sits in the
middle of its panel. The one-third relationship is a single custom property on
`.button`, so the two numbers cannot drift apart.

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

`verify-contrast.js` walks every rendered text — including text drawn by
`::after` and `::placeholder`, which a naive check misses entirely — resolves
its effective foreground against the composited background of its ancestors,
and compares to WCAG AA. It runs the page at rest and on hover, with the modal
open and closed. It is strict on purpose: the first version of it missed three
real failures.
