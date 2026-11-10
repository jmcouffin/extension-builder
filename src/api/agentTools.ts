// The agent tools: what an AI agent in the user's browser may do with the
// builder. Transport-free and the one source of truth: webmcp.ts hands them to
// WebMCP (navigator/document.modelContext) and to window.pyrevitBuilder for
// agents that drive the page by script. Every tool speaks the extension spec
// (spec.ts), and every result is plain JSON.
//
// The tools are coarse on purpose: an agent reads the whole extension, edits
// the JSON, and writes it back. A write is one undo step in the builder, so
// the user can always take it back.

import { brokenButtons, downloadWarnings, validate } from "../domain/tree";
import { buildZip, downloadBlob } from "../domain/zip";
import { loadDefaultIcons } from "../state/defaultIcons";
import { layoutOf, useStore } from "../state/store";
import { extensionSchema } from "./schema";
import { layoutFromSpec, SPEC_VERSION, specFromLayout } from "./spec";

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

const WORKFLOW = `To change the extension: call get_extension, edit the returned spec, check it with validate_extension, then write it back whole with set_extension. Every bundle type and parameter is in get_extension_schema; a guide with examples is at ${SITE}/llms.txt.`;

/** The inputSchema of a tool that takes a spec, with the schema's $defs at the root so its $refs resolve. */
function specInput(description: string): JsonSchema {
  const schema = extensionSchema();
  const spec: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!["$schema", "$id", "$defs", "examples"].includes(key)) spec[key] = value;
  }
  spec.description = `${description} ${String(schema.description ?? "")}`.trim();
  return {
    type: "object",
    properties: { spec },
    required: ["spec"],
    additionalProperties: false,
    $defs: schema.$defs,
  };
}

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
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
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

const downloadExtension: AgentTool = {
  name: "download_extension",
  title: "Download the extension ZIP",
  description: `Builds the extension open in the builder into a ZIP and downloads it in the user's browser, as the page's Download button does. The user unzips it into a folder pyRevit loads extensions from. Refused, with the problems, if pyRevit would skip or break part of the extension; fix them with set_extension first. A button with a required parameter left empty (a URL Button's hyperlink, say) doesn't stop the download: the reply says which buttons won't work and why ("broken"), to tell the user. Returns the file name. ${WORKFLOW}`,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
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

export const AGENT_TOOLS: readonly AgentTool[] = Object.freeze(
  [getExtensionSchema, getExtension, validateExtension, setExtension, downloadExtension].map(
    (tool) => Object.freeze(tool),
  ),
);

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
