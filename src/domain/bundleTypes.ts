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
  | "context"
  | "hyperlink"
  | "assembly"
  | "command_class"
  | "availability_class"
  | "members";

export interface FieldDef {
  label: string;
  input: "select" | "url" | "text" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
  rows?: number;
  help?: string;
}

// `yamlKey` is the key pyRevit actually reads (BundleParser.cs:114-215).
export const FIELDS: Record<FieldKey, FieldDef> = {
  context: {
    label: "Context",
    input: "select",
    options: [
      { value: "", label: "(none - always enabled)" },
      { value: "zero-doc", label: "zero-doc (enabled with no document)" },
      { value: "selection", label: "selection (needs a selection)" },
      { value: "doc-project", label: "doc-project" },
      { value: "doc-family", label: "doc-family" },
      { value: "active-floor-plan", label: "active-floor-plan" },
      { value: "active-3d-view", label: "active-3d-view" },
      { value: "active-detail-view", label: "active-detail-view" },
      { value: "active-drafting-view", label: "active-drafting-view" },
    ],
    help: "No availability class is generated, so the button is always enabled.",
  },
  hyperlink: {
    label: "Hyperlink",
    input: "url",
    placeholder: "https://pyrevitlabs.io",
    help: "Opens in a browser. The only key a .urlbutton needs.",
  },
  assembly: {
    label: "Assembly",
    input: "text",
    placeholder: "MyCommands",
    help: "Compiled DLL name (no .dll), resolved from this bundle's bin/.",
  },
  command_class: {
    label: "Command Class",
    input: "text",
    placeholder: "MyCommand",
    help: "Namespace-qualified class implementing the command.",
  },
  availability_class: {
    label: "Availability Class",
    input: "text",
    placeholder: "MyCommandAvail",
    optional: true,
    help: "IExternalCommand deciding whether the button is enabled.",
  },
  members: {
    label: "ComboBox Members",
    input: "textarea",
    rows: 4,
    placeholder: "- id: first\n  text: First Item\n  group: Group A",
    help: "YAML list; each item needs an id and a text.",
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
  contentFile?: string;
  advanced?: boolean;
  help?: string;
  minChildren?: number;
  maxChildren?: number;
}

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
    fields: ["context"],
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
    fields: ["context"],
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
    fields: ["context"],
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
    required: ["hyperlink"],
    fields: ["hyperlink", "context"],
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
    help: "Needs a content.rfa family in this folder.",
    fields: ["context"],
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
    required: ["assembly", "command_class"],
    advanced: true,
    fields: ["assembly", "command_class", "availability_class"],
    help: "Binds to a .NET class. For links, use URL Button.",
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
    required: ["assembly", "command_class"],
    advanced: true,
    fields: ["assembly", "command_class", "availability_class"],
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
    fields: ["context"],
  },
  splitbutton: {
    postfix: ".splitbutton",
    label: "Split Button",
    glyph: "X",
    group: "Groups",
    container: true,
    accepts: LEAVES_FOR_GROUP,
    fields: ["context"],
  },
  splitpushbutton: {
    postfix: ".splitpushbutton",
    label: "Split Push Button",
    glyph: "X",
    group: "Groups",
    container: true,
    accepts: LEAVES_FOR_GROUP,
    fields: ["context"],
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
    fields: ["members"],
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
    fields: [],
    help: "A script bundle with no ribbon button.",
  },
};

// Order used by the modal picker.
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
