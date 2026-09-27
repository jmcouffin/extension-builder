# pyRevit Extension Builder

A tool to create your pyRevit extension with no knowledge of programming.

Static site — plain HTML, CSS and JavaScript. No server, no build step, no
dependencies at runtime (JSZip comes from a CDN). Open `index.html` or serve
the folder with any static host.

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
node verify.js         # tree, YAML, sanitiser, validator, v1->v2 migration
node verify-dom.js     # every DOM/CSS reference resolves; no dead markup
npm i --no-save puppeteer-core jszip
node serve.js 8777 &
node verify-browser.js # drives the real page, builds a ZIP, inspects it
```

`verify-browser.js` asserts the generated archive contains no folder whose
suffix pyRevit does not know, that icons carry real image bytes, and that no
`__init__.py`, `entrypoint.py` or `.pyrevit` is emitted — none of which pyRevit
expects or produces.
