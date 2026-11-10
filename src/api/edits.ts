// Edits to an extension spec, addressed by name: what edit_extension applies,
// so an agent can change one button without sending the whole spec (and its
// icons) back. Pure: it takes a spec and returns a new one, or says which
// edit is wrong and why. The result still goes through layoutFromSpec, which
// checks everything else (types, parameters, values, nesting).

import { TYPES } from "../domain/bundleTypes";
import {
  type BundleSpec,
  type ExtensionSpec,
  type PanelSpec,
  resolveType,
  type SpecIssue,
  type TabSpec,
} from "./spec";

export const EDIT_OPS = ["update", "add", "remove", "move"] as const;
export type EditOp = (typeof EDIT_OPS)[number];

/**
 * One edit. `path` names a place from the top: [] is the extension, [tab] a
 * tab, [tab, panel] a panel, [tab, panel, bundle, ...] a bundle, then the
 * bundles inside a stack, pulldown or split button.
 */
export interface Edit {
  op: EditOp;
  path: string[];
  /** update: the keys to set; null removes a key. */
  set?: Record<string, unknown>;
  /** add: the tab, panel or bundle to add, as in a spec. */
  item?: unknown;
  /** add, move: where it lands among its new siblings (default: last). */
  index?: number;
  /** move: the place it goes into (a tab for a panel, a panel or group for a bundle). */
  to?: string[];
}

export const MAX_EDITS = 200;

type Level = "extension" | "tab" | "panel" | "bundle";
type Child = TabSpec | PanelSpec | BundleSpec;

interface Place {
  level: Level;
  node: ExtensionSpec | Child;
  /** The list it sits in, and where; absent for the extension. */
  list?: Child[];
  index?: number;
  /** Every node from the extension down to this one. */
  chain: object[];
  /** A readable path, "Acme / Sheets / Docs". */
  label: string;
}

const CHILD_LEVEL: Record<Level, Level | null> = {
  extension: "tab",
  tab: "panel",
  panel: "bundle",
  bundle: "bundle",
};

const EDIT_KEYS: Record<EditOp, string[]> = {
  update: ["op", "path", "set"],
  add: ["op", "path", "item", "index"],
  remove: ["op", "path"],
  move: ["op", "path", "to", "index"],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The children list of a place, created for a group that has none yet. */
function childrenOf(place: Place, create: boolean): Child[] | null {
  const node = place.node as unknown as Record<string, unknown>;
  const key = place.level === "extension" ? "tabs" : place.level === "tab" ? "panels" : "items";
  if (Array.isArray(node[key])) return node[key] as Child[];
  if (place.level === "bundle") {
    // Only a stack, pulldown or split button holds bundles.
    const type = resolveType(node.type);
    if (!create || !type || !TYPES[type].container) return null;
  }
  if (create) {
    node[key] = [];
    return node[key] as Child[];
  }
  return null;
}

class EditError extends Error {
  constructor(
    readonly at: string,
    message: string,
  ) {
    super(message);
  }
}

const quote = (names: string[]) =>
  names.length ? names.map((n) => `"${n}"`).join(", ") : "nothing";

/** Find the place a path names; exact name first, then ignoring case. */
function resolve(spec: ExtensionSpec, path: unknown, at: string): Place {
  if (!Array.isArray(path) || path.some((p) => typeof p !== "string")) {
    throw new EditError(at, 'must be an array of names, e.g. ["My Tab", "My Panel", "My Button"]');
  }
  let place: Place = {
    level: "extension",
    node: spec,
    chain: [spec],
    label: `extension "${spec.name}"`,
  };
  for (const [i, name] of (path as string[]).entries()) {
    const list = childrenOf(place, false);
    const level = CHILD_LEVEL[place.level] as Level;
    const names = (list ?? []).map((c) => String(c?.name ?? ""));
    let index = names.indexOf(name);
    if (index < 0) {
      const matches = names.flatMap((n, j) => (n.toLowerCase() === name.toLowerCase() ? [j] : []));
      if (matches.length === 1) index = matches[0] ?? -1;
    }
    if (!list || index < 0) {
      const where = place.level === "extension" ? "the extension" : place.label;
      throw new EditError(
        `${at}[${i}]`,
        list
          ? `no ${level} named "${name}" in ${where}; it has ${quote(names)}`
          : `${where} holds no other bundles`,
      );
    }
    const node = list[index] as Child;
    place = {
      level,
      node,
      list,
      index,
      chain: [...place.chain, node],
      label: place.level === "extension" ? `"${name}"` : `${place.label} / "${name}"`,
    };
  }
  return place;
}

function indexFor(index: unknown, length: number, at: string): number {
  if (index === undefined) return length;
  if (!Number.isInteger(index) || (index as number) < 0) {
    throw new EditError(at, "must be a whole number, 0 or more");
  }
  return Math.min(index as number, length);
}

function applyOne(spec: ExtensionSpec, raw: unknown, at: string): string {
  if (!isObject(raw)) throw new EditError(at, "must be an object with an op and a path");
  const op = raw.op as EditOp;
  if (!EDIT_OPS.includes(op)) {
    throw new EditError(`${at}.op`, `must be one of ${EDIT_OPS.join(", ")}`);
  }
  for (const key of Object.keys(raw)) {
    if (!EDIT_KEYS[op].includes(key)) {
      throw new EditError(
        `${at}.${key}`,
        `is not a key of a "${op}" edit; it takes ${EDIT_KEYS[op].join(", ")}`,
      );
    }
  }
  const place = resolve(spec, raw.path, `${at}.path`);

  switch (op) {
    case "update": {
      if (!isObject(raw.set) || !Object.keys(raw.set).length) {
        throw new EditError(`${at}.set`, "must be an object of the keys to change");
      }
      const node = place.node as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(raw.set)) {
        if (place.level !== "bundle" && key !== "name") {
          throw new EditError(
            `${at}.set.${key}`,
            `a ${place.level} only has a name here; change what it holds with add, remove and move`,
          );
        }
        if (key === "items" || key === "tabs" || key === "panels") {
          throw new EditError(
            `${at}.set.${key}`,
            "change what a group holds with add, remove and move",
          );
        }
        if (value === null) delete node[key];
        else node[key] = structuredClone(value);
      }
      return `updated ${place.label}`;
    }
    case "add": {
      if (!isObject(raw.item))
        throw new EditError(`${at}.item`, "must be a tab, panel or bundle object");
      const list = childrenOf(place, true);
      if (!list) throw new EditError(`${at}.path`, `${place.label} holds no other bundles`);
      const item = structuredClone(raw.item) as unknown as Child;
      list.splice(indexFor(raw.index, list.length, `${at}.index`), 0, item);
      const kind = CHILD_LEVEL[place.level];
      return `added ${kind} "${String(item.name ?? "")}" to ${place.level === "extension" ? "the extension" : place.label}`;
    }
    case "remove": {
      if (!place.list || place.index === undefined) {
        throw new EditError(`${at}.path`, "names the extension itself; remove its tabs instead");
      }
      place.list.splice(place.index, 1);
      return `removed ${place.label}`;
    }
    case "move": {
      if (!place.list || place.index === undefined) {
        throw new EditError(`${at}.path`, "names the extension itself, which can't move");
      }
      const target = resolve(spec, raw.to, `${at}.to`);
      const expected = place.level === "tab" ? "extension" : place.level === "panel" ? "tab" : null;
      if (
        expected ? target.level !== expected : target.level !== "panel" && target.level !== "bundle"
      ) {
        throw new EditError(
          `${at}.to`,
          place.level === "bundle"
            ? "must name a panel or a stack, pulldown or split button"
            : place.level === "panel"
              ? 'must name a tab, like ["My Tab"]'
              : "must be [] (tabs sit in the extension)",
        );
      }
      if (target.chain.includes(place.node)) {
        throw new EditError(`${at}.to`, `is ${place.label} or inside it`);
      }
      const list = childrenOf(target, true);
      if (!list) throw new EditError(`${at}.to`, `${target.label} holds no other bundles`);
      const [node] = place.list.splice(place.index, 1);
      list.splice(indexFor(raw.index, list.length, `${at}.index`), 0, node as Child);
      return `moved ${place.label} to ${target.level === "extension" ? "the extension" : target.label}`;
    }
  }
}

export interface EditResult {
  /** The edited spec, or null when an edit is wrong (then nothing applies). */
  spec: ExtensionSpec | null;
  errors: SpecIssue[];
  /** One line per edit applied, for the reply. */
  done: string[];
}

/** Apply edits in order, all or none. */
export function applyEdits(spec: ExtensionSpec, edits: unknown): EditResult {
  if (!Array.isArray(edits) || edits.length === 0) {
    return {
      spec: null,
      errors: [{ path: "edits", message: "must be a non-empty array of edits" }],
      done: [],
    };
  }
  if (edits.length > MAX_EDITS) {
    return {
      spec: null,
      errors: [{ path: "edits", message: `may hold ${MAX_EDITS} edits at most` }],
      done: [],
    };
  }
  const draft = structuredClone(spec);
  const done: string[] = [];
  for (const [i, edit] of edits.entries()) {
    try {
      done.push(applyOne(draft, edit, `edits[${i}]`));
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      return { spec: null, errors: [{ path: error.at, message: error.message }], done: [] };
    }
  }
  return { spec: draft, errors: [], done };
}
