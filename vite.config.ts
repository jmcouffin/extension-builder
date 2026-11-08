import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, runnerImport } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The files a language model reads, generated from the bundle type table so
 * they never disagree with the builder: /llms.txt, the spec's JSON Schema and
 * an example spec. Emitted into the build, and served by the dev server.
 * src/api/files.ts is loaded through Vite's module runner rather than imported
 * here, so the config itself stays loadable by Node as is.
 */
const API_PATHS = ["llms.txt", "api/extension.schema.json", "api/example.json"];

function apiFiles(): Plugin {
  const files = async (): Promise<Record<string, string>> => {
    const { module } = await runnerImport<typeof import("./src/api/files")>(
      fileURLToPath(new URL("./src/api/files.ts", import.meta.url)),
    );
    return module.apiFiles();
  };
  return {
    name: "pyrevit-builder-api-files",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0]?.replace(/^\//, "") ?? "";
        if (!API_PATHS.includes(path)) return next();
        const body = (await files())[path];
        if (body === undefined) return next();
        res.setHeader(
          "Content-Type",
          path.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
        );
        res.end(body);
      });
    },
    async generateBundle() {
      for (const [fileName, source] of Object.entries(await files())) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiFiles()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
