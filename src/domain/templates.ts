// Template generation for pyRevit extension files.
//
// Every bundle folder is produced by buildBundle(), which reads its shape from
// the bundle type table. Adding a type means adding one row to that table.

import { FIELDS, type FieldKey, getType, type TypeDef, type TypeId } from "./bundleTypes";
import type { Element } from "./model";

export interface FileNode {
  type: "file";
  name: string;
  content?: string;
  binary?: boolean;
  iconKey?: string;
  elementId?: string;
}

export interface FolderNode {
  type: "folder";
  name: string;
  postfix?: string;
  contentFile?: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

/**
 * Folder-name sanitiser.
 *
 * pyRevit derives a button's DisplayName from the folder basename including
 * spaces (ExtensionParser.cs:1037-1038) and its own bundled extensions use
 * spaces freely -- "Packages & Tags.panel", "pyRevit Bundles Creator.tab".
 * So spaces are KEPT. What we must remove:
 *   - characters Windows forbids in a folder name
 *   - a leading "." or "_", which pyRevit skips entirely (parser.py:60-65)
 *   - trailing dots and spaces, which Windows silently strips
 */
export function sanitizeFileName(name: unknown): string {
  let out = String(name ?? "");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control codes are illegal in Windows paths
  out = out.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/^[.\s]+/, "");
  out = out.replace(/[.\s]+$/, "");
  return out || "Untitled";
}

/**
 * Emit a YAML value. Strings are ALWAYS double-quoted, which removes the
 * entire class of bug where a title containing ": " or " #" silently
 * truncates. Booleans and numbers stay unquoted because pyRevit type-checks
 * them (is_beta, highlight).
 */
export function yamlValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  const escaped = String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/** key: value line, omitted entirely when the value is empty. */
export function yamlLine(key: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return `${key}: ${yamlValue(value)}\n`;
}

export function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return String(text)
    .replace(/\r\n|\r|\n/g, "\n")
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

/**
 * A textarea field (only `members` today) is a YAML block the user authored;
 * everything else is a quoted scalar.
 */
function yamlField(key: FieldKey, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (FIELDS[key].input === "textarea") return `${key}:\n${indent(String(value), 2)}\n`;
  return yamlLine(key, value);
}

/**
 * Build a bundle.yaml for one element.
 * Only keys pyRevit actually reads (BundleParser.cs:114-215) are emitted.
 */
export function buildYaml(element: Element, typeDef: TypeDef): string {
  let yaml = "";
  yaml += yamlLine("title", element.title || element.name);
  yaml += yamlLine("tooltip", element.tooltip);

  // context drives availability-class generation; without it the button is
  // always enabled (ExtensionParser.cs:1351-1370).
  const context = typeDef.forcedContext || element.context;
  if (typeDef.fields.includes("context") && context) yaml += yamlLine("context", context);

  const required = typeDef.required ?? [];
  for (const key of required) yaml += yamlField(key, element[key]);
  for (const key of typeDef.fields) {
    if (key === "context" || required.includes(key)) continue;
    yaml += yamlField(key, element[key]);
  }
  return yaml;
}

/**
 * A panel-level layout: list children in the order the user built them so
 * pyRevit does not re-sort them alphabetically (ExtensionParser.cs:679-738).
 * Empty when alphabetical order already matches, so we do not emit a
 * redundant key.
 */
export function buildLayoutYaml(childDisplayNames: string[]): string {
  if (childDisplayNames.length < 2) return "";
  const alpha = childDisplayNames.slice().sort();
  if (alpha.every((n, i) => n === childDisplayNames[i])) return "";
  // "[" starts a [title:...] directive in BundleParser.cs:317-334, hence quoting.
  return `layout:\n${childDisplayNames.map((name) => `  - ${yamlValue(name)}\n`).join("")}`;
}

export function buildExtensionJson(name: string, author?: string): string {
  const data: Record<string, string> = {
    type: "extension",
    name,
    description: "Generated with the pyRevit Extension Builder",
  };
  if (author) data.author = author;
  data.default_enabled = "True";
  return `${JSON.stringify(data, null, 4)}\n`;
}

export function buildInstallReadme(extensionName: string): string {
  return [
    `pyRevit Extension - ${extensionName}`,
    "=======================================",
    "",
    "INSTALL",
    "------",
    "1. Unzip this archive anywhere.",
    `2. Copy the '${extensionName}.extension' folder into:`,
    "",
    "     %APPDATA%\\pyRevit\\Extensions",
    "",
    "   (In Revit this is the folder behind pyRevit's 'Extensions' tab, or",
    "    the path shown in pyRevit settings under 'User Extensions'.)",
    "",
    "3. Reload pyRevit, or restart Revit. pyRevit caches bundle.yaml by",
    "   file timestamp, so edits are not picked up until a reload.",
    "",
    "FOLDER NAMING",
    "-------------",
    "The suffix on each folder is how pyRevit identifies the bundle type:",
    "",
    "  .extension  the extension root",
    "  .tab        a ribbon tab",
    "  .panel      a ribbon panel",
    "  .stack      2-3 buttons shown side by side (needs at least 2)",
    "  .pulldown   a drop-down list of commands",
    "",
    "A folder whose suffix pyRevit does not recognise is skipped silently,",
    "so do not rename these suffixes.",
    "",
    "COMMAND FILES",
    "-------------",
    "  script.py    the entry point. pyRevit picks the script engine from",
    "               the file extension (.py, .cs, .vb, .rb, .dyn, .gh, .ghx).",
    "  bundle.yaml  optional metadata; a missing file is fine.",
    "  icon.png     button icon (icon.dark.png for the dark theme).",
    "  on.png / off.png   the two states of a Toggle (a .smartbutton).",
    "  config.py    optional; runs on shift-click instead of script.py.",
    "",
    "  Add a lib/ folder to a bundle to make extra Python modules importable",
    "  from its script. bin/ works the same way for compiled assemblies.",
    "",
  ].join("\n");
}

export function commandScript(title: string, author: string): string {
  return `# -*- coding: utf-8 -*-
"""${title}

Created with the pyRevit Extension Builder.
"""
__title__ = "${title}"
__author__ = "${author}"

from pyrevit import revit, DB, UI, script, forms

output = script.get_output()
doc = revit.doc

# ---------------------------------------------------------------------------
# Your command goes here.
#
# Anything a pyRevit command changes in the model must run inside a
# transaction:
#
#     with revit.Transaction("My change"):
#         ...
#
# ---------------------------------------------------------------------------

if doc:
    output.print_md("# " + __title__)
    output.print_md("Document: **{}**".format(doc.Title))
    if doc.PathName:
        output.print_md("Path: " + doc.PathName)
    output.print_md("Active view: **{}**".format(doc.ActiveView.Name))
else:
    output.print_md("No document is open.")
`;
}

/**
 * The canonical pyRevit toggle: a .smartbutton with on.png/off.png, its state
 * held in an env var, and script.toggle_icon() swapping the icon. See
 * script.py:467 for toggle_icon and script.py:580/603 for the env vars.
 */
export function toggleScript(title: string, author: string): string {
  return `# -*- coding: utf-8 -*-
"""${title}

A toggle button: a pyRevit smartbutton with on.png / off.png icons whose
state survives between runs.

Created with the pyRevit Extension Builder.
"""
__title__ = "${title}"
__author__ = "${author}"

from pyrevit import revit, DB, UI, script, forms

# Env var name for this toggle's state. Change it to keep two toggles separate.
ENV_VAR = "${title}".replace(" ", "_").upper() + "_ENABLED"

# Flip the state and tell the button which icon to show.
enabled = not script.get_envvar(ENV_VAR)
script.set_envvar(ENV_VAR, enabled)
script.toggle_icon(enabled)

output = script.get_output()
output.print_md("# " + __title__)
output.print_md("State: **{}**".format("ON" if enabled else "OFF"))

# ---------------------------------------------------------------------------
# Do the actual work. Branch on \`enabled\`.
# ---------------------------------------------------------------------------
`;
}

export function defaultScript(element: Element, typeDef: TypeDef): string {
  const title = element.title || element.name || "Untitled";
  const author = element.author || "pyRevit Extension Builder";
  return typeDef.toggle ? toggleScript(title, author) : commandScript(title, author);
}

export function extensionFolder(extensionName: string, author = ""): FolderNode {
  const safe = sanitizeFileName(extensionName);
  return {
    type: "folder",
    name: `${safe}.extension`,
    children: [
      { type: "file", name: "extension.json", content: buildExtensionJson(safe, author) },
      { type: "file", name: "INSTALL.txt", content: buildInstallReadme(safe) },
    ],
  };
}

export function tabFolder(name: string): FolderNode {
  return { type: "folder", name: `${sanitizeFileName(name)}.tab`, children: [] };
}

export function panelFolder(name: string): FolderNode {
  return { type: "folder", name: `${sanitizeFileName(name)}.panel`, children: [] };
}

/**
 * Build the folder for one element bundle. Child ELEMENTS are not added
 * here; the tree walker recurses into them so the nesting rules live in
 * one place.
 */
export function buildBundle(
  typeId: TypeId,
  element: Element,
  elementId: string,
): FolderNode | null {
  const typeDef = getType(typeId);
  if (!typeDef) return null;

  const folder: FolderNode = {
    type: "folder",
    name: sanitizeFileName(element.name) + typeDef.postfix,
    postfix: typeDef.postfix,
    children: [],
  };

  const yaml = buildYaml(element, typeDef);
  if (yaml.trim()) folder.children.push({ type: "file", name: "bundle.yaml", content: yaml });

  if (typeDef.script) {
    folder.children.push({
      type: "file",
      name: "script.py",
      content: element.code || defaultScript(element, typeDef),
    });
  }

  // pyRevit looks for content.rfa / content_<year>.rfa / any *.rfa
  // (ExtensionParser.cs:1149-1225). The user drops their own in.
  if (typeDef.contentFile) folder.contentFile = typeDef.contentFile;

  // Only icons we can actually fill get emitted: pyRevit falls back to the
  // light icon when a dark variant is absent, and a toggle with on.png ==
  // off.png would just look broken.
  const addIcon = (iconName: string) => {
    folder.children.push({
      type: "file",
      name: iconName,
      binary: true,
      iconKey: iconName,
      elementId,
    });
  };
  for (const icon of typeDef.icons ?? []) addIcon(icon);
  if (element.iconDarkData) for (const icon of typeDef.darkIcons ?? []) addIcon(icon);
  if (typeDef.toggle && element.iconOnData) {
    addIcon("on.png");
    addIcon("off.png");
  }

  return folder;
}
