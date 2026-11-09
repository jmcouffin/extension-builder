// WebMCP: the page declares its agent tools to the browser, so an AI agent
// running there can build an extension with no server in between.
//
// The API as it stands (W3C Web Machine Learning CG draft report of
// 2 November 2026, https://webmachinelearning.github.io/webmcp/, and
// https://github.com/webmachinelearning/webmcp):
//   document.modelContext.registerTool(
//     { name, title?, description, inputSchema?, execute(input, { signal }), annotations?: { readOnlyHint, ... } },
//     { signal?, exposedTo? },
//   ) -> Promise<undefined>; unregistering is aborting `signal`. The result of
//   `execute` is serialized to JSON for the agent.
// Chrome (https://developer.chrome.com/docs/ai/webmcp/imperative-api) ships
// it as an origin trial from Chrome 149 and behind chrome://flags/#enable-webmcp-testing.
// Earlier builds and drafts differ, and are still in the wild:
// - navigator.modelContext instead of document.modelContext (Chrome 146-149;
//   deprecated, not removed, in Chrome 150),
// - provideContext({ tools }) / clearContext() (removed from the draft in
//   March 2026), and unregisterTool(name),
// - results in the MCP shape { content: [{ type: "text", text }] }, and
//   arguments passed as a JSON string (deprecated in Chrome 155).
// So: prefer document over navigator, registerTool over provideContext,
// return the MCP shape (which the current API serializes like any value),
// and accept string arguments.
//
// Agents that drive the page by script instead (a browser extension's JS
// tool, Playwright) get the same tools at window.pyrevitBuilder.

import {
  AGENT_TOOLS,
  type AgentTool,
  callTool,
  type JsonSchema,
  type ToolResult,
} from "./agentTools";
import { extensionSchema } from "./schema";
import { SPEC_VERSION } from "./spec";

/** A tool as WebMCP takes it. */
export interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
  execute(input: unknown, options?: unknown): Promise<WebMcpToolResult>;
}

/** An MCP CallToolResult: one text block holding the tool's JSON result. */
export interface WebMcpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** navigator/document.modelContext, as any of its versions may have it. */
export interface ModelContextLike {
  registerTool?(tool: WebMcpTool, options?: { signal?: AbortSignal }): unknown;
  unregisterTool?(name: string): unknown;
  provideContext?(context: { tools: WebMcpTool[] }): unknown;
  clearContext?(): unknown;
}

/** window.pyrevitBuilder: the agent tools, for a script that drives the page. */
export interface PyRevitBuilderApi {
  /** The extension spec version the tools speak. */
  readonly version: number;
  /** Every tool: name, description, inputSchema, readOnly, execute. */
  readonly tools: readonly AgentTool[];
  /** Run a tool by name. Never throws; a refusal has `ok: false`. */
  call(name: string, input?: unknown): Promise<ToolResult>;
  getExtension(options?: { include_icons?: boolean }): Promise<ToolResult>;
  setExtension(spec: unknown): Promise<ToolResult>;
  validate(spec: unknown): Promise<ToolResult>;
  download(): Promise<ToolResult>;
  /** The JSON Schema of an extension spec. */
  schema(): JsonSchema;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContextLike;
  }
  interface Navigator {
    readonly modelContext?: ModelContextLike;
  }
  interface Window {
    pyrevitBuilder?: PyRevitBuilderApi;
  }
}

export function toWebMcpTool(tool: AgentTool): WebMcpTool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: tool.readOnly,
      ...(tool.untrustedContent ? { untrustedContentHint: true } : {}),
    },
    async execute(input) {
      const result = await callTool(tool.name, input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        ...(result.ok ? {} : { isError: true }),
      };
    },
  };
}

function modelContext(): ModelContextLike | null {
  const context =
    (typeof document !== "undefined" ? document.modelContext : undefined) ??
    (typeof navigator !== "undefined" ? navigator.modelContext : undefined);
  return context && typeof context === "object" ? context : null;
}

function warn(error: unknown) {
  console.warn("WebMCP: could not register the builder's tools:", error);
}

function installPageApi() {
  const api: PyRevitBuilderApi = {
    version: SPEC_VERSION,
    tools: AGENT_TOOLS,
    call: callTool,
    getExtension: (options = {}) => callTool("get_extension", options),
    setExtension: (spec) => callTool("set_extension", { spec }),
    validate: (spec) => callTool("validate_extension", { spec }),
    download: () => callTool("download_extension", {}),
    schema: () => extensionSchema(),
  };
  window.pyrevitBuilder = Object.freeze(api);
}

let registered: (() => void) | null = null;

/**
 * Declare the agent tools to WebMCP when the browser has it (a no-op
 * otherwise), and expose them at window.pyrevitBuilder either way. Safe to
 * call more than once. Returns a function that takes the tools back.
 */
export function registerWebMcp(): () => void {
  if (registered) return registered;
  if (typeof window === "undefined") return () => {};
  installPageApi();

  const undo: (() => void)[] = [() => delete window.pyrevitBuilder];
  const context = modelContext();
  const tools = AGENT_TOOLS.map(toWebMcpTool);
  try {
    if (context && typeof context.registerTool === "function") {
      const controller = new AbortController();
      undo.push(() => controller.abort());
      for (const tool of tools) {
        try {
          const handle = context.registerTool(tool, { signal: controller.signal });
          if (typeof (handle as PromiseLike<unknown> | null)?.then === "function") {
            Promise.resolve(handle).catch(warn);
          }
          // Some early builds returned a registration with unregister().
          const unregister = (handle as { unregister?: unknown } | null)?.unregister;
          if (typeof unregister === "function") undo.push(() => unregister.call(handle));
          else if (typeof context.unregisterTool === "function") {
            undo.push(() => context.unregisterTool?.(tool.name));
          }
        } catch (error) {
          warn(error);
        }
      }
    } else if (context && typeof context.provideContext === "function") {
      context.provideContext({ tools });
      undo.push(() => context.clearContext?.());
    }
  } catch (error) {
    warn(error);
  }

  registered = () => {
    for (const step of undo.reverse()) {
      try {
        step();
      } catch {
        // Already gone.
      }
    }
    registered = null;
  };
  return registered;
}
