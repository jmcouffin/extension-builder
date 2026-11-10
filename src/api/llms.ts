// /llms.txt: how a language model uses the builder, generated from the type
// table at build time so it always lists what the builder really accepts.
// Format: https://llmstxt.org (an H1, a quote, then plain Markdown sections).

import { FIELDS, type FieldKey, ORDER, TYPES } from "../domain/bundleTypes";
import { EXAMPLE_SPEC, SCHEMA_PATH, SPEC_VERSION, specKeysOf } from "./spec";

export const SITE = "https://builder.pyrevitlabs.io";

function valuesOf(key: FieldKey): string {
  const def = FIELDS[key];
  if (def.input === "bool") return "true/false";
  if (def.input === "year") {
    const years = (def.options ?? []).map((o) => o.value).filter(Boolean);
    return `a year, ${years[0]}-${years.at(-1)}`;
  }
  if (def.input === "select") {
    return (def.options ?? []).map((o) => (o.value ? `"${o.value}"` : '""')).join(", ");
  }
  if (key === "members") return 'a YAML list, or [{"id": "...", "text": "..."}]';
  if (def.input === "url") return "a URL";
  return "text";
}

function typesTable(): string {
  const rows = ORDER.map((id) => {
    const def = TYPES[id];
    const required = new Set(def.required ?? []);
    const keys = specKeysOf(id)
      .filter((k) => k !== "items")
      .map((k) => (required.has(k as FieldKey) ? `**${k}**` : k));
    const holds = def.container ? def.accepts.join(", ") : "";
    return `| \`${id}\` | ${def.postfix} | ${def.label}: ${def.help ?? ""} | ${holds} | ${keys.join(", ")} |`;
  });
  return [
    "| type | folder | what it is | items it holds | parameters (**required**) |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function parameterList(): string {
  return (Object.keys(FIELDS) as FieldKey[])
    .map((key) => {
      const def = FIELDS[key];
      const yaml =
        def.yamlKey && def.yamlKey !== key
          ? ` (bundle.yaml: ${def.engine ? "engine." : ""}${def.yamlKey})`
          : "";
      return `- \`${key}\`${yaml}: ${def.help} Values: ${valuesOf(key)}.`;
    })
    .join("\n");
}

export function llmsTxt(site = SITE): string {
  const link = `${site}/#spec=${encodeURIComponent(JSON.stringify({ name: "Hello", tabs: [{ name: "Hello", panels: [{ name: "Tools", items: [{ type: "pushbutton", name: "Say Hi", script: 'print("Hi")' }] }] }] }))}`;
  return `# pyRevit Extension Builder

> Design a pyRevit extension (Revit ribbon tabs, panels and buttons with their Python scripts) and download it as a ZIP ready to drop in pyRevit's extensions folder. Static site, no account, no server: everything happens in the browser.

pyRevit is the open-source Revit add-in framework (https://pyrevitlabs.io). An extension is a folder: \`<name>.extension/<tab>.tab/<panel>.panel/<button>.<type>/\`, each button folder holding a \`bundle.yaml\` of parameters, a \`script.py\` and icons. This builder writes those folders for you from a JSON description: the **extension spec**.

## How a language model uses it

1. **Write a spec** (format below; JSON Schema: ${site}/${SCHEMA_PATH}).
2. **Hand it to the user**, in one of three ways:
   - **An import link** (best for small and medium specs): \`${site}/#spec=\` followed by the spec's JSON, URL-encoded (JavaScript's \`encodeURIComponent\`). Opening it loads the extension in the builder, where the user checks it and clicks Download. Example: ${link}
   - **A link to a hosted file**: \`${site}/?spec_url=<https URL of the JSON>\` (the host must allow cross-origin reads, as GitHub raw files and gists do).
   - **A file**: give the JSON as \`<name>.json\`; the user opens it with the builder's Load button.
3. **Or act in the page yourself**, when you run in the user's browser:
   - with WebMCP, the page registers tools on \`document.modelContext\`: \`get_extension_schema\`, \`get_extension\`, \`validate_extension\`, \`edit_extension\`, \`set_extension\` and \`download_extension\`. Each write is one undo step;
   - by script, the same tools are on \`window.pyrevitBuilder\`: \`await pyrevitBuilder.call("edit_extension", { edits })\`, or \`getExtension()\`, \`edit(edits)\`, \`setExtension(spec)\`, \`validate(spec)\`, \`download()\`, \`schema()\`.
   For a small change, \`edit_extension\` addresses a tab, panel or bundle by its names and changes only that, e.g. \`{"edits": [{"op": "update", "path": ["Acme", "Sheets", "Help", "Docs"], "set": {"tooltip": "Read the docs"}}]}\`; ops are \`update\` (\`set\`, where null removes a key), \`add\` (\`item\`, \`index\`), \`remove\` and \`move\` (\`to\`, \`index\`), all applied or none. To rewrite most of it, edit the spec from \`get_extension\` and write it whole with \`set_extension\`.
   Edit by reading the extension, changing the JSON, and writing it back.

The builder checks a spec at two levels, and says what to fix:
- **errors**: the spec is malformed (wrong shape, unknown type or parameter, bad value, a bundle where pyRevit doesn't allow it), with the JSON path of each, e.g. \`tabs[0].panels[1].items[2].type: Pulldown cannot contain Stack\`. It is not opened at all.
- **problems**: it opens, but pyRevit would skip part of it (a one-row stack, two names making the same folder), so download is refused until they are fixed.
- **warnings** don't block anything, and say why: a button whose required parameter is empty (it downloads, and the reply names the buttons that won't work and what pyRevit will do with them), sample values still in place, a family file to add after unzipping.

A spec that brings its own \`script\` is opened only after the user has seen which buttons run custom Python.

## The extension spec (version ${SPEC_VERSION})

\`\`\`json
${JSON.stringify(EXAMPLE_SPEC, null, 2)}
\`\`\`

- \`name\`, then \`tabs\` → \`panels\` → \`items\`, each list in ribbon order.
- Every bundle has a \`type\` and a \`name\` (its folder name: unique among its siblings, ignoring case). \`title\` is the text under the icon (\`\\n\` breaks the line; default: the name); \`tooltip\` shows on hover.
- Fill every required parameter (in bold below): nothing is filled in for you, and a button without one won't work in Revit.
- \`script\` is the Python of \`script.py\` (pyRevit runs IronPython by default; \`from pyrevit import revit, DB, forms, script\`). Leave it out for a starter script.
- \`icon\`, \`icon_dark\`, \`icon_on\` are PNG data URLs (\`data:image/png;base64,...\`, ideally 96x96). Leave them out for the pyRevit icon.
- A stack holds 2 or 3 bundles; pyRevit drops a stack with one. A pulldown or split button holds commands, not stacks or other groups. A \`nobutton\` only goes in a pulldown or split button, never directly in a panel.
- A \`content\` button loads a Revit family: the user puts the \`.rfa\` file named in \`content\` into its folder after unzipping.
- Only the parameters listed for a type are accepted. Yes/no parameters are \`true\`/\`false\`; versions are numbers.

## Bundle types

${typesTable()}

## Parameters

${parameterList()}

## Links

- JSON Schema of the spec: ${site}/${SCHEMA_PATH}
- The example above as a file: ${site}/api/example.json
- Source and docs: https://github.com/jmcouffin/extension-builder
- pyRevit: https://github.com/pyrevitlabs/pyRevit
`;
}
