// The import link: a URL that opens the builder with an extension in it, so
// a language model can hand a user a link instead of a file.
//
//   #spec=<URL-encoded JSON>     the spec itself (what llms.txt teaches)
//   #spec=<base64url JSON>       the same, for tools that prefer base64
//   ?spec_url=<https URL>        a hosted spec (the host must allow CORS)
//
// The spec lives in the fragment because a fragment never reaches the
// server, has no practical length limit in browsers, and stays out of logs.

import { layoutFromSpec, MAX_SPEC_CHARS, type SpecResult } from "./spec";

const FETCH_TIMEOUT_MS = 15_000;

export type SpecSource = { kind: "inline"; text: string } | { kind: "url"; url: string };

function fromBase64Url(text: string): string | null {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(
      atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")),
      (c) => c.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Where "spec=" starts in a fragment, or -1. It is the fragment's last
 * parameter and runs to its end, as a hand-written spec may hold a raw "&".
 */
function specIndex(hash: string): number {
  const match = /(?:^#|&)spec=/.exec(hash);
  return match ? match.index + match[0].length - "spec=".length : -1;
}

/** The spec a URL carries, if any. */
export function specSourceOf(href: string): SpecSource | null {
  const url = new URL(href);
  const at = specIndex(url.hash);
  if (at >= 0) {
    const raw = url.hash.slice(at + "spec=".length);
    let text: string;
    try {
      text = decodeURIComponent(raw);
    } catch {
      text = raw;
    }
    // URL-encoded JSON starts with "{"; anything else is tried as base64url.
    if (!text.trimStart().startsWith("{")) text = fromBase64Url(raw) ?? text;
    return { kind: "inline", text };
  }
  const specUrl = url.searchParams.get("spec_url");
  if (specUrl) return { kind: "url", url: specUrl };
  return null;
}

/** Read a spec source into a layout; a fetch failure comes back as an error. */
export async function readSpecSource(source: SpecSource): Promise<SpecResult> {
  if (source.kind === "inline") return layoutFromSpec(source.text);
  let target: URL;
  try {
    target = new URL(source.url);
  } catch {
    return failed(`spec_url "${source.url}" is not a URL.`);
  }
  if (target.protocol !== "https:") return failed("spec_url must be an https:// URL.");
  try {
    const response = await fetch(target, {
      credentials: "omit",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return failed(`${target} answered ${response.status}.`);
    const size = Number(response.headers.get("content-length") ?? 0);
    if (size > MAX_SPEC_CHARS) return failed(`${target} is too large for a spec.`);
    // Content-Length can be missing or wrong: stop reading past the cap.
    const text = await readCapped(response, MAX_SPEC_CHARS);
    if (text === null) return failed(`${target} is too large for a spec.`);
    return layoutFromSpec(text);
  } catch (error) {
    if ((error as Error).name === "TimeoutError") {
      return failed(`${target} did not answer within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    }
    return failed(
      `${target} could not be read. Its host must allow cross-origin requests (GitHub raw files and gists do).`,
    );
  }
}

/** A response's text, or null once it passes `maxBytes` (it stops reading there). */
export async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function failed(message: string): SpecResult {
  return { layout: null, errors: [{ path: "", message }], problems: [], warnings: [] };
}

/** The URL without the spec, so a reload doesn't import it again. */
export function withoutSpec(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("spec_url");
  const at = specIndex(url.hash);
  if (at >= 0) url.hash = url.hash.slice(0, at).replace(/&$/, "");
  const out = url.toString();
  return out.endsWith("#") ? out.slice(0, -1) : out;
}

/** A link that opens `spec` in the builder at `base` (the site's root URL). */
export function importLink(spec: unknown, base: string): string {
  return `${base.replace(/#.*$/, "")}#spec=${encodeURIComponent(JSON.stringify(spec))}`;
}
