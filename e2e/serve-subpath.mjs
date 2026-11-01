// Serves dist/ under /extension-builder/, the way GitHub Pages serves a
// project site, so the e2e suite catches any asset URL that assumes the
// domain root.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const PREFIX = "/extension-builder/";
const root = join(import.meta.dirname, "..", "dist");
const port = Number(process.argv[2] ?? 4175);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (!path.startsWith(PREFIX)) {
    res.writeHead(404).end("outside the project site");
    return;
  }
  const rel = path.slice(PREFIX.length) || "index.html";
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving dist at http://localhost:${port}${PREFIX}`));
