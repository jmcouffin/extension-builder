// The agent tools: what an AI agent in the user's browser may do with the
// builder. Transport-free and the one source of truth: webmcp.ts hands them to
// WebMCP (navigator/document.modelContext) and to window.pyrevitBuilder for
// agents that drive the page by script. Every tool speaks the extension spec
// (spec.ts), and every result is plain JSON.
//
// An agent reads the extension with get_extension, then either changes part
// of it by name with edit_extension, or writes a new one whole with
// set_extension. Every write is one undo step in the builder, so the user can
// always take it back.
//
// Browsers don't check arguments against inputSchema (the WebMCP draft only
// asks that they parse to an object, and Chromium hands execute anything), so
// every tool checks its own; inputSchema is guidance for the agent. That is
// why the spec-taking tools carry a short one pointing to
// get_extension_schema, rather than the whole schema twice.

import type { Layout } from "../domain/model";
import { brokenButtons, downloadWarnings, validate } from "../domain/tree";
import { buildZip, downloadBlob } from "../domain/zip";
import { loadDefaultIcons } from "../state/defaultIcons";
import { layoutOf, useStore } from "../state/store";
import { applyEdits, EDIT_OPS, MAX_EDITS } from "./edits";
import { extensionSchema } from "./schema";
import {
  type BundleSpec,
  type ExtensionSpec,
  layoutFromSpec,
  SCHEMA_PATH,
  SPEC_VERSION,
  specFromLayout,
} from "./spec";

/** A JSON Schema, as a plain object. */
export type JsonSchema = Record<string, unknown>;

/**
 * What a tool returns. Always JSON-serializable. `ok` is false when the tool
 * refused or failed; `message` says what happened in one or two sentences,
 * written for a model to act on.
 */
export interface ToolResult {
  ok: boolean;
  message: string;
  [key: string]: unknown;
}

export interface AgentTool {
  name: string;
  /** A short human label. */
  title: string;
  /** Written for a model reading it cold. */
  description: string;
  inputSchema: JsonSchema;
  /** The shape of every result, refusals included (WebMCP's outputSchema). */
  outputSchema: JsonSchema;
  /** True when the tool only reads: it changes nothing in the builder. */
  readOnly: boolean;
  /**
   * True when the tool can throw away the user's work: it replaces what is in
   * the builder (Undo can still take it back). Only meaningful when readOnly
   * is false.
   */
  destructive?: boolean;
  /**
   * True when the result carries text the user or a link put in the
   * extension (names, tooltips, scripts), which an agent must not take as
   * instructions: an import link can come from anyone.
   */
  untrustedContent?: boolean;
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}

const SITE = "https://builder.pyrevitlabs.io";

const ABOUT =
  "This page is the pyRevit Extension Builder. pyRevit is an open-source add-in framework for Autodesk Revit that turns folders of Python scripts into Revit ribbon buttons. An extension is one such folder (<name>.extension): ribbon tabs, holding panels, holding bundles (push buttons that run a Python script, URL buttons, toggles, stacks, pulldowns, split buttons, combo boxes...). The builder shows the extension as a Revit ribbon the user edits, and downloads it as a ZIP to unzip into their pyRevit extensions folder.";

const WORKFLOW = `To change the extension: call get_extension, then change part of it by name with edit_extension, or write a new spec whole with set_extension (check one first with validate_extension). Every bundle type and parameter is in get_extension_schema; a guide with examples is at ${SITE}/llms.txt.`;

/**
 * The inputSchema of a tool that takes a spec: short, pointing to
 * get_extension_schema for the full one (29 KB, which would otherwise be
 * loaded twice before any call). The tool checks the spec itself.
 */
function specInput(description: string): JsonSchema {
  return {
    type: "object",
    properties: {
      spec: {
        type: "object",
        description: `${description} An extension spec: {"name": ..., "tabs": [{"name": ..., "panels": [{"name": ..., "items": [bundles]}]}]}, each bundle {"type": ..., "name": ..., parameters..., "items" for a stack or group}, as get_extension returns. Its full JSON Schema, with every bundle type and parameter, is what get_extension_schema returns (also at ${SITE}/${SCHEMA_PATH}). The builder checks the spec and answers with the JSON path of anything wrong.`,
        required: ["name", "tabs"],
        properties: {
          version: { const: SPEC_VERSION },
          name: { type: "string" },
          tabs: { type: "array", items: { type: "object" } },
        },
      },
    },
    required: ["spec"],
    additionalProperties: false,
  };
}

const ISSUES: JsonSchema = {
  type: "array",
  description:
    "Why the input was refused, at a JSON path in the spec or the arguments. Nothing changed.",
  items: {
    type: "object",
    required: ["path", "message"],
    properties: {
      path: {
        type: "string",
        description: 'E.g. "tabs[0].panels[1].items[2].hyperlink" or "edits[0].path[1]".',
      },
      message: { type: "string" },
    },
    additionalProperties: false,
  },
};

/** The result every tool shares, plus what one tool adds. */
function resultSchema(extra: Record<string, JsonSchema> = {}): JsonSchema {
  return {
    type: "object",
    required: ["ok", "message"],
    properties: {
      ok: {
        type: "boolean",
        description: "False when the tool refused or failed; then nothing changed.",
      },
      message: {
        type: "string",
        description: "What happened, in a sentence or two, to act on or tell the user.",
      },
      errors: ISSUES,
      problems: {
        type: "array",
        items: { type: "string" },
        description:
          "pyRevit would skip part of the extension; download is refused until they are fixed.",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description:
          "Worth telling the user, nothing is blocked: buttons that won't work and why, sample values, files to add after unzipping.",
      },
      ...extra,
    },
    additionalProperties: false,
  };
}

const NO_ARGUMENTS: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

function currentLayout() {
  return layoutOf(useStore.getState());
}

function customIconCount(): number {
  let count = 0;
  for (const el of Object.values(useStore.getState().elements)) {
    if (el.iconData) count++;
    if (el.iconDarkData) count++;
    if (el.iconOnData) count++;
  }
  return count;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const getExtensionSchema: AgentTool = {
  name: "get_extension_schema",
  title: "Get the extension JSON Schema",
  description: `Returns the JSON Schema (draft 2020-12) of an extension spec: the format get_extension returns and set_extension takes. It lists every bundle type under $defs, with each type's parameters, which are required, and which bundles a stack, pulldown or split button may hold. Read it before writing bundle types or parameters you have not seen in get_extension's output. ${WORKFLOW}`,
  inputSchema: NO_ARGUMENTS,
  outputSchema: resultSchema({
    schema: {
      type: "object",
      description: "The JSON Schema (draft 2020-12) of an extension spec.",
    },
  }),
  readOnly: true,
  async execute() {
    return {
      ok: true,
      message: `The JSON Schema of an extension spec (version ${SPEC_VERSION}).`,
      schema: extensionSchema(),
    };
  },
};

const getExtension: AgentTool = {
  name: "get_extension",
  title: "Get the extension",
  description: `${ABOUT} Call this first. Returns the extension open in the builder as a spec (nested JSON: name, tabs, panels, items), plus "problems" (pyRevit would skip or break something; download is refused until they are fixed) and "warnings" (buttons that won't work because a required parameter is empty, and why; sample values to replace; files to add after unzipping). Custom icons are left out unless include_icons is true, and set_extension replaces every icon with what the spec holds: if the user uploaded icons, call this with include_icons: true before editing and writing the spec back, or their icons are lost. ${WORKFLOW}`,
  inputSchema: {
    type: "object",
    properties: {
      include_icons: {
        type: "boolean",
        default: false,
        description:
          "Include custom icons as PNG data URLs (large). Needed before a set_extension that must keep them.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: resultSchema({
    spec: { type: "object", description: "The extension open in the builder, as a spec." },
  }),
  readOnly: true,
  untrustedContent: true,
  async execute(input) {
    const icons = input.include_icons === true;
    const layout = currentLayout();
    const omitted = icons ? 0 : customIconCount();
    const problems = validate(layout);
    const warnings = downloadWarnings(layout);
    const notes = [
      `The extension "${layout.extensionName}".`,
      problems.length
        ? `${plural(problems.length, "problem")} to fix before it can be downloaded.`
        : "It can be downloaded.",
      omitted
        ? `${plural(omitted, "custom icon")} left out; call again with include_icons: true before set_extension to keep them.`
        : "",
    ];
    return {
      ok: true,
      message: notes.filter(Boolean).join(" "),
      spec: specFromLayout(layout, { icons }),
      problems,
      warnings,
    };
  },
};

const validateExtension: AgentTool = {
  name: "validate_extension",
  title: "Validate an extension spec",
  description: `Checks an extension spec without changing anything in the builder. Returns "errors" (the spec is malformed, with the JSON path of each: set_extension would refuse it), "problems" (it would load, but pyRevit would skip or break part of it, so download would be refused) and "warnings" (buttons that won't work because a required parameter is empty, and why; sample values worth replacing; files to add after unzipping). ok is true when there are no errors and no problems. ${WORKFLOW}`,
  inputSchema: specInput("The extension spec to check."),
  outputSchema: resultSchema(),
  readOnly: true,
  async execute(input) {
    const result = layoutFromSpec(input.spec);
    const ok = !result.errors.length && !result.problems.length;
    const message = result.errors.length
      ? `The spec has ${plural(result.errors.length, "error")}; set_extension would refuse it.`
      : result.problems.length
        ? `The spec reads, but has ${plural(result.problems.length, "problem")}; download would be refused until they are fixed.`
        : `The spec is sound${result.warnings.length ? `, with ${plural(result.warnings.length, "warning")}` : ""}.`;
    return {
      ok,
      message,
      errors: result.errors,
      problems: result.problems,
      warnings: result.warnings,
    };
  },
};

const setExtension: AgentTool = {
  name: "set_extension",
  title: "Replace the extension",
  description: `Replaces the whole extension in the builder with the given spec, which the user then sees as the ribbon. It is one undo step: the user can take it back with Undo (Ctrl+Z). Refused, with the errors and their JSON paths, if the spec is malformed. When it loads, any "problems" (download refused until fixed) and "warnings" are returned. Icons: what the spec holds replaces every icon, so to keep the user's custom icons, read them with get_extension include_icons: true and pass them back. ${WORKFLOW}`,
  inputSchema: specInput("The whole extension, replacing the current one."),
  outputSchema: resultSchema(),
  readOnly: false,
  destructive: true,
  async execute(input) {
    const result = layoutFromSpec(input.spec);
    if (!result.layout) {
      return {
        ok: false,
        message: `Not loaded: the spec has ${plural(result.errors.length, "error")}. Fix them and call set_extension again; nothing changed.`,
        errors: result.errors,
      };
    }
    useStore.getState().loadLayout(result.layout);
    const counts = `${plural(Object.keys(result.layout.tabs).length, "tab")}, ${plural(Object.keys(result.layout.panels).length, "panel")}, ${plural(Object.keys(result.layout.elements).length, "bundle")}`;
    return {
      ok: true,
      message: `Loaded "${result.layout.extensionName}" (${counts}); the user can undo it.${
        result.problems.length
          ? ` ${plural(result.problems.length, "problem")} to fix before it can be downloaded.`
          : ""
      }`,
      problems: result.problems,
      warnings: result.warnings,
    };
  },
};

/** A valid PNG data URL no icon has: what an icon stands as while edits go through the spec. */
const ICON_TOKEN = "data:image/png;base64,QnVpbGRlckljb24";
const ICON_KEYS = ["icon", "icon_dark", "icon_on"] as const;

/**
 * Set the spec's icons aside for unique tokens, so they survive any edit
 * (renames and moves included) without going through the spec reader,
 * which takes only PNGs where the builder also keeps JPEG, GIF, BMP and SVG.
 */
function stashIcons(spec: ExtensionSpec): Map<string, string> {
  const stash = new Map<string, string>();
  const walk = (bundles: BundleSpec[] | undefined) => {
    for (const bundle of bundles ?? []) {
      for (const key of ICON_KEYS) {
        const value = bundle[key];
        if (typeof value !== "string") continue;
        const token = `${ICON_TOKEN}${stash.size.toString(36)}`;
        stash.set(token, value);
        bundle[key] = token;
      }
      walk(bundle.items);
    }
  };
  for (const tab of spec.tabs) for (const panel of tab.panels) walk(panel.items);
  return stash;
}

function restoreIcons(layout: Layout, stash: Map<string, string>) {
  for (const el of Object.values(layout.elements)) {
    for (const key of ["iconData", "iconDarkData", "iconOnData"] as const) {
      const value = el[key];
      if (value && stash.has(value)) el[key] = stash.get(value) ?? null;
    }
  }
}

const editExtension: AgentTool = {
  name: "edit_extension",
  title: "Edit part of the extension",
  description: `Changes part of the extension in place, by name, without sending the whole spec back: change a bundle's parameters or name, add, remove or move a tab, panel or bundle. "edits" apply in order, all or none, as one undo step; icons you don't touch are kept. Each edit has an "op" and a "path" of names from the top: [] is the extension, ["Tab"] a tab, ["Tab", "Panel"] a panel, ["Tab", "Panel", "Button"] a bundle, ["Tab", "Panel", "Stack", "Button"] a bundle inside a stack or group.
- update: {"op": "update", "path": [...], "set": {"tooltip": "...", "min_revit_version": 2024}}. null removes a key. The extension, a tab or a panel only takes "name".
- add: {"op": "add", "path": [where], "item": {...}, "index": n}: a tab into [], a panel into ["Tab"], a bundle into a panel or a stack or group, written as in a spec. index is optional (default: last).
- remove: {"op": "remove", "path": [...]}.
- move: {"op": "move", "path": [...], "to": [where], "index": n}.
Refused, with the edit and the reason, if a path matches nothing or the result would be malformed; nothing changes then. Returns problems and warnings like set_extension. ${WORKFLOW}`,
  inputSchema: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        minItems: 1,
        maxItems: MAX_EDITS,
        description: "Applied in order, all or none.",
        items: {
          type: "object",
          required: ["op", "path"],
          properties: {
            op: { enum: [...EDIT_OPS] },
            path: {
              type: "array",
              items: { type: "string" },
              description:
                "Names from the top: [] extension, [tab], [tab, panel], [tab, panel, bundle, ...].",
            },
            set: { type: "object", description: "update: the keys to set; null removes one." },
            item: { type: "object", description: "add: the tab, panel or bundle, as in a spec." },
            to: {
              type: "array",
              items: { type: "string" },
              description: "move: the tab, panel or group it goes into.",
            },
            index: {
              type: "integer",
              minimum: 0,
              description: "add, move: position among its new siblings.",
            },
          },
          additionalProperties: false,
        },
      },
    },
    required: ["edits"],
    additionalProperties: false,
  },
  outputSchema: resultSchema(),
  readOnly: false,
  // It can remove: not only additive, though each call is one undo step.
  destructive: true,
  async execute(input) {
    const state = useStore.getState();
    const layout = currentLayout();
    const activeTab = layout.tabs[state.activeTabId]?.name;
    const spec = specFromLayout(layout, { icons: true });
    const stash = stashIcons(spec);

    const edited = applyEdits(spec, input.edits);
    if (!edited.spec) {
      const [first] = edited.errors;
      return {
        ok: false,
        message: `Nothing changed: ${first ? `${first.path} ${first.message}` : "the edits are wrong"}. Fix it and call edit_extension again (get_extension shows the names).`,
        errors: edited.errors,
      };
    }
    const result = layoutFromSpec(edited.spec);
    if (!result.layout) {
      return {
        ok: false,
        message: `Nothing changed: after these edits the extension would have ${plural(result.errors.length, "error")} (the paths are in the edited extension).`,
        errors: result.errors,
      };
    }
    restoreIcons(result.layout, stash);
    // Stay on the tab the user was on, if it's still there.
    const keep = Object.entries(result.layout.tabs).find(([, tab]) => tab.name === activeTab)?.[0];
    if (keep) result.layout.activeTabId = keep;
    useStore.getState().loadLayout(result.layout);

    const done = edited.done.join("; ");
    return {
      ok: true,
      message: `${done.charAt(0).toUpperCase()}${done.slice(1)}. One undo step for the user.${
        result.problems.length
          ? ` ${plural(result.problems.length, "problem")} to fix before it can be downloaded.`
          : ""
      }`,
      problems: result.problems,
      warnings: result.warnings,
    };
  },
};

const downloadExtension: AgentTool = {
  name: "download_extension",
  title: "Download the extension ZIP",
  description: `Builds the extension open in the builder into a ZIP and downloads it in the user's browser, as the page's Download button does. The user unzips it into a folder pyRevit loads extensions from. Refused, with the problems, if pyRevit would skip or break part of the extension; fix them with set_extension first. A button with a required parameter left empty (a URL Button's hyperlink, say) doesn't stop the download: the reply says which buttons won't work and why ("broken"), to tell the user. Returns the file name. ${WORKFLOW}`,
  inputSchema: NO_ARGUMENTS,
  outputSchema: resultSchema({
    file_name: { type: "string", description: "The ZIP the browser downloaded." },
    broken: {
      type: "array",
      items: { type: "string" },
      description: "Buttons that won't work as built, and why; tell the user.",
    },
  }),
  readOnly: false,
  async execute() {
    const layout = currentLayout();
    const problems = validate(layout);
    if (problems.length) {
      return {
        ok: false,
        message: `Not downloaded: ${plural(problems.length, "problem")} to fix first (set_extension with a corrected spec).`,
        problems,
      };
    }
    const { blob, name } = await buildZip(layout, await loadDefaultIcons());
    downloadBlob(blob, name);
    const broken = brokenButtons(layout);
    const warnings = downloadWarnings(layout);
    const why = broken.length
      ? ` ${broken.length === 1 ? "One button won't" : `${broken.length} buttons won't`} work as built: ${broken.join(" ")}`
      : "";
    return {
      ok: true,
      message: `Downloaded ${name}.${why}${warnings.length > broken.length ? ` See warnings for the rest to tell the user.` : ""}`,
      file_name: name,
      broken,
      warnings,
    };
  },
};

function deepFreeze<T>(value: T): T {
  if (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export const AGENT_TOOLS: readonly AgentTool[] = deepFreeze([
  getExtensionSchema,
  getExtension,
  validateExtension,
  editExtension,
  setExtension,
  downloadExtension,
]);

/**
 * The arguments a tool's inputSchema does not declare, when it forbids
 * them (additionalProperties: false). Agents mistype argument names
 * ("includeIcons"); ignoring them silently hides the mistake.
 */
export function unknownArguments(tool: AgentTool, args: Record<string, unknown>): string[] {
  if (tool.inputSchema.additionalProperties !== false) return [];
  const known = Object.keys((tool.inputSchema.properties as Record<string, unknown>) ?? {});
  return Object.keys(args).filter((key) => !known.includes(key));
}

/**
 * The arguments of a call, as an object. Tolerates what agents send: nothing,
 * null, or the arguments as a JSON string (older WebMCP builds did that).
 */
export function argumentsOf(input: unknown): Record<string, unknown> | null {
  let value = input;
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Run one tool by name. Never throws: a failure comes back as `ok: false`. */
export async function callTool(name: string, input?: unknown): Promise<ToolResult> {
  const tool = AGENT_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return {
      ok: false,
      message: `There is no tool "${name}". The tools are: ${AGENT_TOOLS.map((t) => t.name).join(", ")}.`,
    };
  }
  const args = argumentsOf(input);
  if (!args) return { ok: false, message: `The arguments of ${name} must be a JSON object.` };
  const unknown = unknownArguments(tool, args);
  if (unknown.length) {
    const known = Object.keys((tool.inputSchema.properties as Record<string, unknown>) ?? {});
    return {
      ok: false,
      message: `${name} does not take ${unknown.map((k) => `"${k}"`).join(", ")}; ${
        known.length ? `its arguments are: ${known.join(", ")}` : "it takes no arguments"
      }. Nothing changed.`,
    };
  }
  try {
    return await tool.execute(args);
  } catch (error) {
    return {
      ok: false,
      message: `${name} failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
