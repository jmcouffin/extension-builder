// Validation and migration of a saved layout, shared by the file loader and
// the localStorage draft so a draft can never introduce a shape the file
// loader would reject.

import { isTypeId, LAYOUT_VERSION, TYPES } from "./bundleTypes";
import type { Element, Layout, NextIds } from "./model";

export const FILE_VERSION = "2.0";

export function snapshot(layout: Layout) {
  return {
    version: FILE_VERSION,
    extensionName: layout.extensionName,
    tabs: layout.tabs,
    panels: layout.panels,
    elements: layout.elements,
    activeTabId: layout.activeTabId,
    nextIds: layout.nextIds,
  };
}

function majorOf(version: unknown): number {
  return Number.parseInt(String(version ?? "1.0").split(".")[0] ?? "", 10);
}

export function validateLoadedState(state: unknown): string | null {
  if (!state || typeof state !== "object") return "That file is not an extension layout.";
  const s = state as Record<string, unknown>;
  for (const key of ["tabs", "panels", "elements", "extensionName"]) {
    if (!Object.hasOwn(s, key)) return `Missing '${key}' in that file.`;
  }
  if (!s.tabs || typeof s.tabs !== "object" || !Object.keys(s.tabs).length) {
    return "That layout has no tabs.";
  }
  if (!s.panels || typeof s.panels !== "object" || !Object.keys(s.panels).length) {
    return "That layout has no panels.";
  }
  if (!s.elements || typeof s.elements !== "object") {
    return "That layout has an invalid element list.";
  }
  const major = majorOf(s.version);
  if (!(major === 1 || major === LAYOUT_VERSION)) {
    return `That layout is version ${String(s.version)}, which this builder cannot read. Rebuild it here instead.`;
  }
  return null;
}

type LooseElement = Omit<Element, "type"> & { url?: string; command?: string; type: string };

/**
 * Bring a loaded layout up to the current shape.
 *
 * v1 -> v2 changes that matter:
 *   togglebutton  -> toggle          (.togglebutton is not a pyRevit postfix)
 *   linkbutton+url-> urlbutton       (hyperlink: belongs to .urlbutton)
 *   invokebutton  -> keeps its type, but `command` becomes `command_class`
 *   iconData      -> split into iconData / iconDarkData / iconOnData
 *   context, panelId/parentId normalisation
 */
// biome-ignore lint/suspicious/noExplicitAny: input is untrusted JSON, validated above
export function migrate(state: any): Layout {
  const version = state.version || "1.0";
  const major = majorOf(version);
  const elements: Record<string, LooseElement> = { ...(state.elements || {}) };
  const notes: string[] = [];

  for (const [id, el] of Object.entries(elements)) {
    if (!el || typeof el !== "object") {
      delete elements[id];
      continue;
    }

    if (major === 1) {
      if (el.type === "togglebutton") {
        el.type = "toggle";
        notes.push(`"${el.name}": Toggle Button -> Toggle`);
      }

      // linkbutton with only a URL was never a link button; pyRevit needs
      // assembly + command_class for .linkbutton, and hyperlink: for .urlbutton.
      if (el.type === "linkbutton") {
        if (el.url && !el.assembly) {
          el.type = "urlbutton";
          el.hyperlink = el.url;
          delete el.url;
          notes.push(`"${el.name}": Link Button -> URL Button`);
        } else {
          el.command_class = el.command_class || el.command || "";
          delete el.command;
        }
      }

      if (el.type === "invokebutton") {
        el.command_class = el.command_class || el.command || "";
        delete el.command;
      }
    }

    if (!Object.hasOwn(el, "iconDarkData")) el.iconDarkData = null;
    if (!Object.hasOwn(el, "iconOnData")) el.iconOnData = null;
    if (el.iconData === undefined) el.iconData = null;

    // Ownership must be exactly one of panelId / parentId.
    const parent = el.parentId ? elements[el.parentId] : undefined;
    if (parent && isTypeId(parent.type) && !TYPES[parent.type].container) delete el.parentId;
    if (el.panelId && el.parentId) delete el.panelId;

    if (!isTypeId(el.type)) {
      notes.push(`"${el.name || id}": unknown type "${el.type}" was dropped`);
      delete elements[id];
    }
  }

  if (notes.length) console.info(`Layout upgraded from v${version}:`, notes);

  const tabs = state.tabs || {};
  const out: Layout = {
    extensionName: state.extensionName || "Loaded Extension",
    tabs,
    panels: state.panels || {},
    elements: elements as unknown as Record<string, Element>,
    activeTabId:
      state.activeTabId && tabs[state.activeTabId] ? state.activeTabId : Object.keys(tabs)[0],
    nextIds: { tab: 1, panel: 1, element: 1 },
  };
  out.nextIds = rebuildNextIds(out);
  return out;
}

/**
 * Derive nextIds from the ids actually present.
 *
 * v1 layouts were not consistent about id prefixes ("button1", "b1",
 * "element7"), so we take the trailing number rather than assuming a prefix.
 */
export function rebuildNextIds(state: Pick<Layout, "tabs" | "panels" | "elements">): NextIds {
  const next: NextIds = { tab: 1, panel: 1, element: 1 };
  const bump = (ids: string[], key: keyof NextIds) => {
    for (const id of ids) {
      const match = String(id).match(/(\d+)\s*$/);
      if (!match?.[1]) continue;
      const n = Number.parseInt(match[1], 10);
      if (n >= next[key]) next[key] = n + 1;
    }
  };
  bump(Object.keys(state.tabs), "tab");
  bump(Object.keys(state.panels), "panel");
  bump(Object.keys(state.elements), "element");
  return next;
}

export function parseLayout(text: string): Layout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const problem = validateLoadedState(parsed);
  if (problem) throw new Error(problem);
  return migrate(parsed);
}
