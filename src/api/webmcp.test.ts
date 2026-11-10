import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../state/store";
import type { ToolResult } from "./agentTools";
import {
  type McpToolResult,
  type ModelContextLike,
  registerWebMcp,
  type WebMcpTool,
} from "./webmcp";

type Holder = { modelContext?: ModelContextLike };

function fake(where: Holder, context: ModelContextLike) {
  Object.defineProperty(where, "modelContext", { value: context, configurable: true });
}

let dispose: (() => void) | null = null;
afterEach(() => {
  dispose?.();
  dispose = null;
  delete (document as Holder).modelContext;
  delete (navigator as Holder).modelContext;
  useStore.getState().reset();
});

describe("WebMCP registration", () => {
  it("registers every tool with document.modelContext.registerTool, and unregisters on abort", async () => {
    const tools: WebMcpTool[] = [];
    let signal: AbortSignal | undefined;
    fake(document, {
      registerTool: (tool, options) => {
        tools.push(tool);
        signal = options?.signal;
        return Promise.resolve();
      },
    });
    dispose = registerWebMcp();
    expect(tools.map((t) => t.name)).toEqual([
      "get_extension_schema",
      "get_extension",
      "validate_extension",
      "set_extension",
      "download_extension",
    ]);
    // get_extension returns what a link may have put there.
    expect(tools[1]?.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    // set_extension replaces the user's work; download_extension only adds a file.
    expect(tools[3]?.annotations).toEqual({ readOnlyHint: false, destructiveHint: true });
    expect(tools[4]?.annotations).toEqual({ readOnlyHint: false });

    // The current API serializes what execute returns: the tool's own
    // result, not an MCP envelope with JSON in a string.
    const result = (await tools[1]?.execute({})) as ToolResult;
    expect(result.ok).toBe(true);
    expect((result.spec as { name: string }).name).toBe(useStore.getState().extensionName);
    expect(result).not.toHaveProperty("content");

    const refused = (await tools[3]?.execute({ spec: {} })) as ToolResult;
    expect(refused.ok).toBe(false);
    expect(refused.errors).not.toEqual([]);

    dispose();
    dispose = null;
    expect(signal?.aborted).toBe(true);
    expect(window.pyrevitBuilder).toBeUndefined();
  });

  it("falls back to navigator.modelContext.provideContext, with MCP-shaped results", async () => {
    const provideContext = vi.fn();
    const clearContext = vi.fn();
    fake(navigator, { provideContext, clearContext });
    dispose = registerWebMcp();
    expect(provideContext).toHaveBeenCalledOnce();
    const tools: WebMcpTool[] = provideContext.mock.calls[0]?.[0].tools;
    expect(tools).toHaveLength(5);

    // The older builds expected an MCP CallToolResult.
    const result = (await tools[1]?.execute({})) as McpToolResult;
    expect(JSON.parse(result.content[0]?.text ?? "{}").ok).toBe(true);
    expect(result.isError).toBeUndefined();
    const refused = (await tools[3]?.execute({ spec: {} })) as McpToolResult;
    expect(refused.isError).toBe(true);

    dispose();
    dispose = null;
    expect(clearContext).toHaveBeenCalledOnce();
  });

  it("keeps the page working when registration is refused", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake(document, {
      registerTool: () => Promise.reject(new DOMException("tools disabled", "NotAllowedError")),
    });
    dispose = registerWebMcp();
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    expect(window.pyrevitBuilder).toBeDefined();
    warn.mockRestore();
  });

  it("exposes window.pyrevitBuilder without WebMCP, and registers only once", async () => {
    dispose = registerWebMcp();
    expect(registerWebMcp()).toBe(dispose);
    const api = window.pyrevitBuilder;
    expect(api?.tools).toHaveLength(5);
    expect((await api?.call("get_extension", {}))?.ok).toBe(true);
    expect((await api?.validate({ name: "X" }))?.ok).toBe(false);
    expect(api?.schema()).toMatchObject({ title: "pyRevit extension" });
  });
});
