// The files a language model reads, as published path -> content. Generated
// from the bundle type table so they never disagree with the builder. The
// Vite config emits them into the build and serves them in dev.

import { llmsTxt } from "./llms";
import { extensionSchema } from "./schema";
import { EXAMPLE_SPEC, SCHEMA_PATH } from "./spec";

export function apiFiles(): Record<string, string> {
  return {
    "llms.txt": llmsTxt(),
    [SCHEMA_PATH]: `${JSON.stringify(extensionSchema(), null, 2)}\n`,
    "api/example.json": `${JSON.stringify(EXAMPLE_SPEC, null, 2)}\n`,
  };
}
