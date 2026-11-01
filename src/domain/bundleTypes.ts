// Single source of truth for every bundle type the builder can produce.
//
// Every folder postfix below is transcribed from pyRevit's own parser:
//   dev/pyRevitLoader/pyRevitExtensionParser/ExtensionParser.cs:2465-2486
//     CommandComponentTypeExtensions.FromExtension
// Anything NOT in that switch is silently skipped at ExtensionParser.cs:1032-1035,
// so a type added here without a matching postfix is a type that never appears in Revit.
//
// Nesting rules are transcribed from:
//   pyrevitlib/pyrevit/extensions/components.py  (allowed_sub_cmps whitelists)
//   dev/pyRevitLoader/pyRevitAssemblyBuilder/UIManager/Builders/StackBuilder.cs:80,107-138
//     (.stack needs >= 2 visible children; Revit caps a stack at 3)
//   dev/.../ExtensionParser.cs:1037-1038
//     (DisplayName = folder basename incl. spaces, Name = same with spaces removed)

export const LAYOUT_VERSION = 2;

export type FieldKey =
  | "author"
  | "help_url"
  | "hyperlink"
  | "assembly"
  | "command_class"
  | "availability_class"
  | "content"
  | "content_alt"
  | "members"
  | "context"
  | "min_revit_version"
  | "max_revit_version"
  | "engine_clean"
  | "engine_full_frame"
  | "engine_persistent"
  | "large_icon"
  | "highlight"
  | "beta";

/** Where a parameter sits in the Properties palette, in Revit's group names. */
export type FieldGroup = "Identity Data" | "Data" | "Constraints" | "Engine" | "Graphics" | "Other";

export const GROUP_ORDER: FieldGroup[] = [
  "Identity Data",
  "Data",
  "Constraints",
  "Engine",
  "Graphics",
  "Other",
];

export interface FieldDef {
  label: string;
  group: FieldGroup;
  input: "select" | "url" | "text" | "textarea" | "bool" | "year";
  /** The bundle.yaml key, when it is not the field key itself. */
  yamlKey?: string;
  /** Written under `engine:` rather than at the top level. */
  engine?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  rows?: number;
  help: string;
}

const YEARS = ["2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"];

// Every key is one pyRevit's parser reads
// (dev/pyRevitLoader/pyRevitExtensionParser/BundleParser.cs, ParseTopLevelNode
// and ParseEngine); what it does is from the loader that consumes it.
export const FIELDS: Record<FieldKey, FieldDef> = {
  author: {
    label: "Author",
    group: "Identity Data",
    input: "text",
    placeholder: "Your name",
    help: "Shown in the button's tooltip, and written as __author__ in its script.",
  },
  help_url: {
    label: "Help URL",
    group: "Identity Data",
    input: "url",
    placeholder: "https://",
    help: "Opened when the user presses F1 over the button.",
  },
  hyperlink: {
    label: "Hyperlink",
    group: "Data",
    input: "url",
    placeholder: "https://pyrevitlabs.io",
    help: "The page a URL Button opens in the browser.",
  },
  assembly: {
    label: "Assembly",
    group: "Data",
    input: "text",
    placeholder: "MyAddin",
    help: "The compiled .NET assembly (no .dll), resolved from this bundle's bin/ or Revit's add-ins.",
  },
  command_class: {
    label: "Command Class",
    group: "Data",
    input: "text",
    placeholder: "MyAddin.MyCommand",
    help: "Namespace-qualified IExternalCommand class to run.",
  },
  availability_class: {
    label: "Availability Class",
    group: "Data",
    input: "text",
    placeholder: "MyAddin.MyAvailability",
    help: "IExternalCommandAvailability class deciding when the button is enabled.",
  },
  content: {
    label: "Family File",
    group: "Data",
    input: "text",
    placeholder: "content.rfa",
    help: "The .rfa family the button loads. Add the file to the bundle folder after unzipping.",
  },
  content_alt: {
    label: "Ctrl+Click Family",
    group: "Data",
    input: "text",
    placeholder: "other.rfa",
    help: "An alternative family loaded on Ctrl+Click.",
  },
  members: {
    label: "Members",
    group: "Data",
    input: "textarea",
    rows: 5,
    placeholder: "- id: first\n  text: First Item",
    help: "The combo box's items, as a YAML list; each needs an id and a text.",
  },
  context: {
    label: "Context",
    group: "Constraints",
    input: "select",
    options: [
      { value: "", label: "(none - always enabled)" },
      { value: "zero-doc", label: "zero-doc (no document open)" },
      { value: "selection", label: "selection (needs a selection)" },
      { value: "doc-project", label: "doc-project" },
      { value: "doc-family", label: "doc-family" },
      { value: "active-floor-plan", label: "active-floor-plan" },
      { value: "active-3d-view", label: "active-3d-view" },
      { value: "active-detail-view", label: "active-detail-view" },
      { value: "active-drafting-view", label: "active-drafting-view" },
    ],
    help: "When the button is enabled. With none, it always is.",
  },
  min_revit_version: {
    label: "Min Revit Version",
    group: "Constraints",
    input: "year",
    options: [{ value: "", label: "(any)" }, ...YEARS.map((y) => ({ value: y, label: y }))],
    help: "Older Revit versions skip this button.",
  },
  max_revit_version: {
    label: "Max Revit Version",
    group: "Constraints",
    input: "year",
    options: [{ value: "", label: "(any)" }, ...YEARS.map((y) => ({ value: y, label: y }))],
    help: "Newer Revit versions skip this button.",
  },
  engine_clean: {
    label: "Clean Engine",
    group: "Engine",
    input: "bool",
    yamlKey: "clean",
    engine: true,
    help: "Run in a fresh engine every time instead of a cached one.",
  },
  engine_full_frame: {
    label: "Full Frame",
    group: "Engine",
    input: "bool",
    yamlKey: "full_frame",
    engine: true,
    help: "IronPython full-frame mode, needed by some libraries.",
  },
  engine_persistent: {
    label: "Persistent",
    group: "Engine",
    input: "bool",
    yamlKey: "persistent",
    engine: true,
    help: "Keep the engine alive after the script ends, for scripts that leave windows open.",
  },
  large_icon: {
    label: "Large Icon",
    group: "Graphics",
    input: "bool",
    help: "Use the large icon size where Revit would use the medium one, in stacks and lists.",
  },
  highlight: {
    label: "Highlight",
    group: "Other",
    input: "select",
    options: [
      { value: "", label: "(none)" },
      { value: "new", label: "new" },
      { value: "updated", label: "updated" },
    ],
    help: "Revit's orange dot marking a new or updated button.",
  },
  beta: {
    label: "Beta",
    group: "Other",
    input: "bool",
    yamlKey: "is_beta",
    help: "Hidden unless the user turns on beta tools in pyRevit's settings.",
  },
};

export const FIELD_KEYS = Object.keys(FIELDS) as FieldKey[];

export type TypeId =
  | "pushbutton"
  | "toggle"
  | "panelbutton"
  | "urlbutton"
  | "content"
  | "linkbutton"
  | "invokebutton"
  | "stack"
  | "pulldown"
  | "splitbutton"
  | "splitpushbutton"
  | "combobox"
  | "nobutton";

export type ContainerKey = TypeId | "panel" | "tab" | "extension";

export interface TypeDef {
  postfix: string;
  label: string;
  glyph: string;
  group: string;
  container: boolean;
  accepts: TypeId[];
  fields: FieldKey[];
  script?: boolean;
  icons?: string[];
  darkIcons?: string[];
  toggle?: boolean;
  forcedContext?: string;
  required?: FieldKey[];
  /** Values a new bundle of this type starts with, so a required key is never left blank. */
  defaults?: Partial<Record<FieldKey, string>>;
  contentFile?: string;
  advanced?: boolean;
  help?: string;
  minChildren?: number;
  maxChildren?: number;
}

/** What every button carries: who made it, its help, its Revit range, its badges. */
const COMMON: FieldKey[] = [
  "author",
  "help_url",
  "min_revit_version",
  "max_revit_version",
  "highlight",
  "beta",
];

/** The engine options of a Python script bundle. */
const ENGINE: FieldKey[] = ["engine_clean", "engine_full_frame", "engine_persistent"];

/** Sample values that make the bundle well-formed but must be replaced. */
export const SAMPLE_ASSEMBLY = "MyAddin";
export const SAMPLE_COMMAND_CLASS = "MyAddin.MyCommand";
export const SAMPLE_MEMBERS = "- id: option_a\n  text: Option A\n- id: option_b\n  text: Option B";

const LEAVES_FOR_GROUP: TypeId[] = [
  "pushbutton",
  "toggle",
  "panelbutton",
  "urlbutton",
  "content",
  "linkbutton",
  "invokebutton",
  "nobutton",
];

// pyRevit collects every icon-like file in the bundle folder and sorts light
// before dark (ExtensionParser.cs:2226-2240, GetIconTypePriority), so a
// missing dark variant simply falls back to the light one. We therefore never
// emit a dark file unless the user actually uploaded one.
export const TYPES: Record<TypeId, TypeDef> = {
  pushbutton: {
    postfix: ".pushbutton",
    label: "Push Button",
    glyph: "P",
    group: "Commands",
    script: true,
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    fields: ["context", ...ENGINE, "large_icon", ...COMMON],
  },
  toggle: {
    // A pyRevit toggle IS a smartbutton with on/off icons. There is no
    // .togglebutton postfix -- see PyRevitConsts.cs BundleToggleButtonPostfix,
    // which is dead code with no case in FromExtension.
    postfix: ".smartbutton",
    label: "Toggle",
    glyph: "T",
    group: "Commands",
    script: true,
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    toggle: true,
    fields: ["context", ...ENGINE, "large_icon", ...COMMON],
  },
  panelbutton: {
    postfix: ".panelbutton",
    label: "Panel Button",
    glyph: "P",
    group: "Commands",
    script: true,
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    // pyRevit forces these to zero-doc (genericcomps.py:633-635)
    forcedContext: "zero-doc",
    fields: ["context", ...ENGINE, ...COMMON],
  },
  urlbutton: {
    postfix: ".urlbutton",
    label: "URL Button",
    glyph: "U",
    group: "Links",
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    // URLButton logs "does not specify target url" and the button opens
    // nothing without it (pyrevitlib/pyrevit/extensions/components.py).
    required: ["hyperlink"],
    defaults: { hyperlink: "https://pyrevitlabs.io" },
    fields: ["hyperlink", "context", "large_icon", ...COMMON],
  },
  content: {
    postfix: ".content",
    label: "Content Button",
    glyph: "R",
    group: "Links",
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    contentFile: "content.rfa",
    required: ["content"],
    defaults: { content: "content.rfa" },
    help: "Needs a content.rfa family in this folder.",
    fields: ["content", "content_alt", "context", "large_icon", ...COMMON],
  },
  linkbutton: {
    postfix: ".linkbutton",
    label: "Link Button",
    glyph: "L",
    group: ".NET",
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    // LinkButton is built with needs_commandclass=True, and LinkButtonBuilder
    // returns no button without both (components.py, LinkButtonBuilder.cs).
    required: ["assembly", "command_class"],
    defaults: { assembly: SAMPLE_ASSEMBLY, command_class: SAMPLE_COMMAND_CLASS },
    advanced: true,
    fields: ["assembly", "command_class", "availability_class", "large_icon", ...COMMON],
    help: "Binds to a .NET class. For a web link, use URL Button.",
  },
  invokebutton: {
    postfix: ".invokebutton",
    label: "Invoke Button",
    glyph: "I",
    group: ".NET",
    container: false,
    accepts: [],
    icons: ["icon.png"],
    darkIcons: ["icon.dark.png"],
    // Only the assembly is needed: with no command_class pyRevit invokes the
    // assembly itself (CommandTypeGenerator.BuildCommandArguments).
    required: ["assembly"],
    defaults: { assembly: SAMPLE_ASSEMBLY },
    advanced: true,
    fields: ["assembly", "command_class", "availability_class", "large_icon", ...COMMON],
    help: "Runs a .NET assembly; the command class is optional.",
  },
  stack: {
    postfix: ".stack",
    label: "Stack",
    glyph: "S",
    group: "Groups",
    container: true,
    // StackBuilder.cs:107-138 renders exactly these and nothing else.
    accepts: [
      "pushbutton",
      "toggle",
      "urlbutton",
      "content",
      "linkbutton",
      "invokebutton",
      "pulldown",
      "splitbutton",
      "splitpushbutton",
    ],
    minChildren: 2, // StackBuilder.cs:80 - a 1-child stack silently vanishes
    maxChildren: 3, // AddStackedItems takes 2 or 3
    fields: [],
  },
  pulldown: {
    postfix: ".pulldown",
    label: "Pulldown",
    glyph: "D",
    group: "Groups",
    container: true,
    // GenericUICommandGroup.allowed_sub_cmps = [GenericUICommand, NoScriptButton]
    //   -> leaves only. No nested groups, no stacks.
    accepts: LEAVES_FOR_GROUP,
    fields: ["context", "large_icon", ...COMMON],
  },
  splitbutton: {
    postfix: ".splitbutton",
    label: "Split Button",
    glyph: "X",
    group: "Groups",
    container: true,
    accepts: LEAVES_FOR_GROUP,
    fields: ["context", "large_icon", ...COMMON],
  },
  splitpushbutton: {
    postfix: ".splitpushbutton",
    label: "Split Push Button",
    glyph: "X",
    group: "Groups",
    container: true,
    accepts: LEAVES_FOR_GROUP,
    fields: ["context", "large_icon", ...COMMON],
  },
  combobox: {
    postfix: ".combobox",
    label: "Combo Box",
    glyph: "C",
    group: "Groups",
    container: false,
    // ComboBoxBuilder has no child handling at all; content comes from members:
    accepts: [],
    icons: [],
    required: ["members"],
    defaults: { members: SAMPLE_MEMBERS },
    fields: ["members", ...COMMON],
  },
  nobutton: {
    postfix: ".nobutton",
    label: "No Button",
    glyph: "N",
    group: "Advanced",
    container: false,
    accepts: [],
    icons: [],
    advanced: true,
    fields: ["author", ...ENGINE, "min_revit_version", "max_revit_version"],
    help: "A script bundle with no ribbon button.",
  },
};

// Order of the Type Selector.
export const ORDER: TypeId[] = [
  "pushbutton",
  "toggle",
  "panelbutton",
  "urlbutton",
  "content",
  "pulldown",
  "splitbutton",
  "splitpushbutton",
  "stack",
  "combobox",
  "linkbutton",
  "invokebutton",
  "nobutton",
];

// Legacy id -> current id, used by layout migrations.
export const LEGACY: Record<string, TypeId> = {
  togglebutton: "toggle",
};

// Every postfix pyRevit's CommandComponentTypeExtensions.FromExtension knows.
// A type whose postfix is missing here would be skipped silently on load.
export const KNOWN_POSTFIXES = [
  ".tab",
  ".panel",
  ".pushbutton",
  ".pulldown",
  ".splitbutton",
  ".splitpushbutton",
  ".stack",
  ".smartbutton",
  ".panelbutton",
  ".linkbutton",
  ".invokebutton",
  ".urlbutton",
  ".content",
  ".nobutton",
  ".combobox",
] as const;

/**
 * Fill a type's defaults into the fields that are still empty. Values the
 * user typed are never replaced.
 */
export function withDefaults<T extends Partial<Record<FieldKey, string | undefined>>>(
  type: TypeId,
  values: T,
): T {
  const defaults = TYPES[type].defaults ?? {};
  const out = { ...values };
  for (const [key, value] of Object.entries(defaults) as [FieldKey, string][]) {
    if (!out[key]) (out as Record<FieldKey, string>)[key] = value;
  }
  return out;
}

export function isTypeId(id: unknown): id is TypeId {
  return typeof id === "string" && Object.hasOwn(TYPES, id);
}

export function getType(id: string): TypeDef | null {
  return isTypeId(id) ? TYPES[id] : null;
}

export function isRealPostfix(postfix: string): boolean {
  return (KNOWN_POSTFIXES as readonly string[]).includes(postfix);
}

/** Child types legal inside `container`, honouring the nesting whitelist. */
export function accepts(container: ContainerKey): TypeId[] {
  if (container === "panel") return ORDER.filter((id) => TYPES[id].postfix !== ".nobutton");
  const def = getType(container);
  return def ? def.accepts.slice() : [];
}

/**
 * Why a child type is illegal in a container, or null when it is fine.
 * Returns a human-readable reason so the UI never has to guess.
 */
export function rejectionReason(container: ContainerKey, childType: string): string | null {
  const child = getType(childType);
  if (!child) return "Unknown bundle type.";
  if (container === "panel") return null;
  if (container === "tab") return "A tab can only contain panels.";
  if (container === "extension") return "An extension can only contain tabs.";

  const def = getType(container);
  if (!def) return "Unknown container.";
  if (!def.container) return `${def.label} is a command, not a container.`;
  if (!def.accepts.includes(childType as TypeId)) {
    const allowed = def.accepts.map((id) => TYPES[id].label).join(", ");
    return `${def.label} cannot contain ${child.label}. Allowed: ${allowed}.`;
  }
  return null;
}

export function idForPostfix(postfix: string): TypeId | null {
  return ORDER.find((id) => TYPES[id].postfix === postfix) ?? null;
}
