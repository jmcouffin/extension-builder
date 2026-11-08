// The extension spec: a plain, nested JSON description of a pyRevit
// extension, for people and language models to write by hand. It is the one
// public format of the builder: the import link, the JSON Schema, llms.txt
// and the in-page agent tools all speak it, and it converts to and from the
// builder's internal layout without loss (icons included when asked).

import {
  FIELD_KEYS,
  FIELDS,
  type FieldKey,
  idForPostfix,
  isTypeId,
  rejectionReason,
  TYPES,
  type TypeId,
  withDefaults,
} from "../domain/bundleTypes";
import type { Element, Layout } from "../domain/model";
import { sanitizeFileName } from "../domain/templates";
import { sampleValues, validate } from "../domain/tree";

export const SPEC_VERSION = 1;

/** Where the schema is published, relative to the site root. */
export const SCHEMA_PATH = "api/extension.schema.json";

/** A combo box member, as pyRevit's `members:` list takes it. */
export interface MemberSpec {
  id: string;
  text: string;
  icon?: string;
  tooltip?: string;
  group?: string;
}

/**
 * One bundle. `type` is a type id (or its folder postfix, like "smartbutton");
 * every other key is a parameter of that type, by its key in the type table.
 */
export interface BundleSpec {
  type: string;
  name: string;
  title?: string;
  tooltip?: string;
  /** script.py, for a type that runs one. Empty or absent: the starter script. */
  script?: string;
  /** PNG data URLs ("data:image/png;base64,..."). Absent: the pyRevit icon. */
  icon?: string;
  icon_dark?: string;
  /** A toggle's "on" icon. */
  icon_on?: string;
  /** The bundles inside a stack, pulldown or split button. */
  items?: BundleSpec[];
  /** Combo box members: a YAML list, or the same as objects. */
  members?: string | MemberSpec[];
  [parameter: string]: unknown;
}

export interface PanelSpec {
  name: string;
  items: BundleSpec[];
}

export interface TabSpec {
  name: string;
  panels: PanelSpec[];
}

export interface ExtensionSpec {
  $schema?: string;
  version?: number;
  name: string;
  tabs: TabSpec[];
}

/** A problem with a spec, at a JSON path like "tabs[0].panels[1].items[2].hyperlink". */
export interface SpecIssue {
  path: string;
  message: string;
}

export interface SpecResult {
  /** The layout, when the spec could be read; it may still have `problems`. */
  layout: Layout | null;
  /** The spec is malformed: wrong shape, unknown type or parameter, bad value, illegal nesting. */
  errors: SpecIssue[];
  /** The layout reads, but pyRevit would skip or break part of it; download is refused. */
  problems: string[];
  /** Fine to download, but worth a look: sample values still in place. */
  warnings: string[];
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/** The type a spec's `type` names: an id ("toggle") or a postfix ("smartbutton", ".smartbutton"). */
export function resolveType(type: unknown): TypeId | null {
  if (typeof type !== "string") return null;
  const t = type.trim().toLowerCase();
  if (isTypeId(t)) return t;
  return idForPostfix(t.startsWith(".") ? t : `.${t}`);
}

/** The parameters a bundle of `type` can carry in a spec, beyond name/title/tooltip. */
export function specKeysOf(type: TypeId): string[] {
  const def = TYPES[type];
  const keys: string[] = [...def.fields];
  if (def.script) keys.push("script");
  if (def.icons?.length) keys.push("icon");
  if (def.darkIcons?.length) keys.push("icon_dark");
  if (def.toggle) keys.push("icon_on");
  if (def.container) keys.push("items");
  return keys;
}

function membersYaml(members: MemberSpec[]): string {
  const quote = (v: string) => (/^[\w .,()/-]*$/.test(v) && v.trim() === v ? v : JSON.stringify(v));
  return members
    .map((m) =>
      Object.entries(m)
        .filter(([, v]) => typeof v === "string" && v !== "")
        .map(([k, v], i) => `${i === 0 ? "- " : "  "}${k}: ${quote(String(v))}`)
        .join("\n"),
    )
    .join("\n");
}

/** A spec value as the layout stores it, or an error message. */
function fieldValue(key: FieldKey, value: unknown): { value?: string; error?: string } {
  const def = FIELDS[key];
  if (value === undefined || value === null) return {};
  switch (def.input) {
    case "bool":
      if (typeof value !== "boolean") return { error: "must be true or false" };
      return value ? { value: "true" } : {};
    case "year": {
      const year = typeof value === "number" ? String(value) : String(value).trim();
      if (year === "") return {};
      const allowed = (def.options ?? []).map((o) => o.value).filter(Boolean);
      if (!allowed.includes(year)) return { error: `must be one of ${allowed.join(", ")}` };
      return { value: year };
    }
    case "select": {
      if (typeof value !== "string") return { error: "must be a string" };
      const allowed = (def.options ?? []).map((o) => o.value);
      if (!allowed.includes(value)) {
        return { error: `must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}` };
      }
      return value ? { value } : {};
    }
    default:
      if (key === "members" && Array.isArray(value)) {
        const bad = value.findIndex(
          (m) =>
            !m || typeof m !== "object" || typeof m.id !== "string" || typeof m.text !== "string",
        );
        if (bad >= 0) return { error: `item ${bad} needs an "id" and a "text"` };
        return { value: membersYaml(value as MemberSpec[]) };
      }
      if (typeof value !== "string") return { error: "must be a string" };
      return value === "" ? {} : { value };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Read a spec into a layout. Never throws: anything wrong comes back in
 * `errors` (the spec itself) or `problems` (what pyRevit would refuse), with
 * enough said to fix it.
 */
export function layoutFromSpec(input: unknown): SpecResult {
  const errors: SpecIssue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const fail = (): SpecResult => ({ layout: null, errors, problems: [], warnings: [] });

  let spec = input;
  if (typeof spec === "string") {
    try {
      spec = JSON.parse(spec);
    } catch {
      err("", "is not valid JSON");
      return fail();
    }
  }
  if (!isObject(spec)) {
    err("", "must be an object with a name and tabs");
    return fail();
  }
  if (spec.version !== undefined && spec.version !== SPEC_VERSION) {
    err("version", `must be ${SPEC_VERSION}`);
  }
  if (typeof spec.name !== "string" || !spec.name.trim()) err("name", "must be a non-empty string");
  if (!Array.isArray(spec.tabs) || spec.tabs.length === 0) {
    err("tabs", "must be a non-empty array of tabs");
    return fail();
  }
  for (const key of Object.keys(spec)) {
    if (!["$schema", "version", "name", "tabs"].includes(key))
      err(key, "is not a key of an extension");
  }

  const layout: Layout = {
    extensionName: typeof spec.name === "string" ? spec.name.trim() : "",
    tabs: {},
    panels: {},
    elements: {},
    activeTabId: "tab1",
    nextIds: { tab: 1, panel: 1, element: 1 },
  };

  /** Two siblings whose folders would collide. */
  const checkNames = (names: { name: string; path: string }[]) => {
    const seen = new Map<string, string>();
    for (const { name, path } of names) {
      const key = sanitizeFileName(name).toLowerCase();
      const other = seen.get(key);
      if (other)
        err(`${path}.name`, `"${name}" makes the same folder as ${other}; names must differ`);
      else seen.set(key, path);
    }
  };

  const readBundle = (raw: unknown, path: string, container: string, owner: Partial<Element>) => {
    if (!isObject(raw)) {
      err(path, "must be an object with a type and a name");
      return null;
    }
    const type = resolveType(raw.type);
    if (!type) {
      err(
        `${path}.type`,
        `unknown type ${JSON.stringify(raw.type)}; use one of ${Object.keys(TYPES).join(", ")}`,
      );
      return null;
    }
    const rejected = rejectionReason(container as TypeId | "panel", type);
    if (rejected) err(`${path}.type`, rejected);
    if (typeof raw.name !== "string" || !raw.name.trim())
      err(`${path}.name`, "must be a non-empty string");

    const def = TYPES[type];
    const allowed = specKeysOf(type);
    const element: Element = {
      type,
      name: typeof raw.name === "string" ? raw.name.trim() : "",
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      iconDarkData: null,
      iconOnData: null,
      ...owner,
    };

    for (const [key, value] of Object.entries(raw)) {
      if (key === "type" || key === "name") continue;
      const at = `${path}.${key}`;
      if (key === "title" || key === "tooltip" || key === "script") {
        if (key === "script" && !def.script) err(at, `a ${def.label} has no script`);
        else if (typeof value !== "string") err(at, "must be a string");
        else element[key === "script" ? "code" : key] = value;
        continue;
      }
      if (key === "icon" || key === "icon_dark" || key === "icon_on") {
        if (!allowed.includes(key)) err(at, `a ${def.label} has no ${key}`);
        else if (typeof value !== "string" || !PNG_DATA_URL.test(value)) {
          err(at, 'must be a PNG data URL: "data:image/png;base64,..."');
        } else
          element[
            key === "icon" ? "iconData" : key === "icon_dark" ? "iconDarkData" : "iconOnData"
          ] = value;
        continue;
      }
      if (key === "items") continue;
      if (!(FIELD_KEYS as string[]).includes(key) || !allowed.includes(key)) {
        const params = allowed.filter((k) => !["items"].includes(k));
        err(
          at,
          `is not a parameter of a ${def.label}; it takes: name, title, tooltip${params.length ? `, ${params.join(", ")}` : ""}`,
        );
        continue;
      }
      const { value: stored, error } = fieldValue(key as FieldKey, value);
      if (error) err(at, error);
      else if (stored !== undefined) element[key as FieldKey] = stored;
    }

    // Required keys left out get the same start values as in the builder.
    Object.assign(element, withDefaults(type, element));
    if (def.forcedContext) element.context = def.forcedContext;

    const id = `element${layout.nextIds.element++}`;
    layout.elements[id] = element;

    if (def.container) {
      const items = raw.items ?? [];
      if (!Array.isArray(items)) err(`${path}.items`, "must be an array of bundles");
      else {
        const children: string[] = [];
        items.forEach((child, i) => {
          const childId = readBundle(child, `${path}.items[${i}]`, type, { parentId: id });
          if (childId) children.push(childId);
        });
        if (def.maxChildren && children.length > def.maxChildren) {
          err(`${path}.items`, `a ${def.label} holds at most ${def.maxChildren}`);
        }
        checkNames(
          children.map((c, i) => ({
            name: layout.elements[c]?.name ?? "",
            path: `${path}.items[${i}]`,
          })),
        );
        element.children = children;
      }
    } else if (raw.items !== undefined) {
      err(`${path}.items`, `a ${def.label} holds no other bundles`);
    }
    return id;
  };

  for (const [t, rawTab] of (spec.tabs as unknown[]).entries()) {
    const tabPath = `tabs[${t}]`;
    if (!isObject(rawTab)) {
      err(tabPath, "must be an object with a name and panels");
      continue;
    }
    if (typeof rawTab.name !== "string" || !rawTab.name.trim())
      err(`${tabPath}.name`, "must be a non-empty string");
    for (const key of Object.keys(rawTab)) {
      if (key !== "name" && key !== "panels")
        err(`${tabPath}.${key}`, "is not a key of a tab; it takes name and panels");
    }
    const tabId = `tab${layout.nextIds.tab++}`;
    const tab = { name: String(rawTab.name ?? "").trim(), panels: [] as string[] };
    layout.tabs[tabId] = tab;
    if (!Array.isArray(rawTab.panels) || rawTab.panels.length === 0) {
      err(`${tabPath}.panels`, "must be a non-empty array of panels");
      continue;
    }
    for (const [p, rawPanel] of (rawTab.panels as unknown[]).entries()) {
      const panelPath = `${tabPath}.panels[${p}]`;
      if (!isObject(rawPanel)) {
        err(panelPath, "must be an object with a name and items");
        continue;
      }
      if (typeof rawPanel.name !== "string" || !rawPanel.name.trim())
        err(`${panelPath}.name`, "must be a non-empty string");
      for (const key of Object.keys(rawPanel)) {
        if (key !== "name" && key !== "items")
          err(`${panelPath}.${key}`, "is not a key of a panel; it takes name and items");
      }
      const panelId = `panel${layout.nextIds.panel++}`;
      const panel = { name: String(rawPanel.name ?? "").trim(), elements: [] as string[], tabId };
      layout.panels[panelId] = panel;
      tab.panels.push(panelId);
      const items = rawPanel.items ?? [];
      if (!Array.isArray(items)) {
        err(`${panelPath}.items`, "must be an array of bundles");
        continue;
      }
      items.forEach((raw, i) => {
        const id = readBundle(raw, `${panelPath}.items[${i}]`, "panel", { panelId });
        if (id) panel.elements.push(id);
      });
      checkNames(
        panel.elements.map((id, i) => ({
          name: layout.elements[id]?.name ?? "",
          path: `${panelPath}.items[${i}]`,
        })),
      );
    }
    checkNames(
      tab.panels.map((id, i) => ({
        name: layout.panels[id]?.name ?? "",
        path: `${tabPath}.panels[${i}]`,
      })),
    );
  }
  checkNames(Object.values(layout.tabs).map((tab, i) => ({ name: tab.name, path: `tabs[${i}]` })));

  if (errors.length) return fail();
  return { layout, errors, problems: validate(layout), warnings: sampleValues(layout) };
}

export interface SpecOptions {
  /** Include icon data URLs (large). Default true. */
  icons?: boolean;
  /** Add "$schema" pointing at this URL. */
  schemaUrl?: string;
}

/** The spec of a layout: what an agent reads back, or a person saves to share. */
export function specFromLayout(
  layout: Pick<Layout, "extensionName" | "tabs" | "panels" | "elements">,
  options: SpecOptions = {},
): ExtensionSpec {
  const icons = options.icons ?? true;
  const bundle = (id: string): BundleSpec | null => {
    const el = layout.elements[id];
    if (!el) return null;
    const def = TYPES[el.type];
    const out: BundleSpec = { type: el.type, name: el.name };
    if (el.title) out.title = el.title;
    if (el.tooltip) out.tooltip = el.tooltip;
    for (const key of def.fields) {
      const value = el[key];
      if (!value || (key === "context" && def.forcedContext)) continue;
      const input = FIELDS[key].input;
      (out as Record<string, unknown>)[key] =
        input === "bool" ? value === "true" : input === "year" ? Number(value) : value;
    }
    if (def.script && el.code) out.script = el.code;
    if (icons) {
      if (el.iconData) out.icon = el.iconData;
      if (el.iconDarkData && def.darkIcons?.length) out.icon_dark = el.iconDarkData;
      if (el.iconOnData && def.toggle) out.icon_on = el.iconOnData;
    }
    if (def.container)
      out.items = (el.children ?? []).map(bundle).filter((b): b is BundleSpec => !!b);
    return out;
  };
  const spec: ExtensionSpec = {
    version: SPEC_VERSION,
    name: layout.extensionName,
    tabs: Object.values(layout.tabs).map((tab) => ({
      name: tab.name,
      panels: tab.panels
        .map((pid) => layout.panels[pid])
        .filter((p) => !!p)
        .map((panel) => ({
          name: panel.name,
          items: panel.elements.map(bundle).filter((b): b is BundleSpec => !!b),
        })),
    })),
  };
  return options.schemaUrl ? { $schema: options.schemaUrl, ...spec } : spec;
}

/** One line per issue, for a dialog or a tool result. */
export function describeIssues(result: Pick<SpecResult, "errors" | "problems">): string[] {
  return [
    ...result.errors.map((e) => (e.path ? `${e.path} ${e.message}` : `The spec ${e.message}`)),
    ...result.problems,
  ];
}

/** True when a parsed JSON value looks like a spec rather than a saved layout file. */
export function looksLikeSpec(value: unknown): boolean {
  return isObject(value) && Array.isArray(value.tabs);
}

/** A small, complete spec: the one llms.txt and the schema show. */
export const EXAMPLE_SPEC: ExtensionSpec = {
  version: SPEC_VERSION,
  name: "Acme Tools",
  tabs: [
    {
      name: "Acme",
      panels: [
        {
          name: "Sheets",
          items: [
            {
              type: "pushbutton",
              name: "Renumber",
              title: "Renumber\nSheets",
              tooltip: "Renumber the selected sheets in order.",
              author: "Acme BIM",
              context: "selection",
              script: "from pyrevit import revit\nprint(len(revit.get_selection()))",
            },
            {
              type: "stack",
              name: "Help",
              items: [
                { type: "urlbutton", name: "Docs", hyperlink: "https://pyrevitlabs.io" },
                { type: "toggle", name: "Auto Save", tooltip: "Turn auto save on or off." },
              ],
            },
            {
              type: "pulldown",
              name: "Export",
              items: [
                { type: "pushbutton", name: "To PDF", min_revit_version: 2024 },
                { type: "pushbutton", name: "To DWG", engine_clean: true },
              ],
            },
          ],
        },
      ],
    },
  ],
};
