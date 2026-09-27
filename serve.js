// Minimal static file server for local checking. Not part of the site.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || 8778);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.join(root, rel);
    if (process.env.SERVE_LOG) console.log(req.method + " " + req.url + " range=" + (req.headers.range || "-"));
    if (!file.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        console.log("  404 " + rel);
        res.writeHead(404, { "content-type": "text/plain" }).end("not found: " + rel);
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "content-length": data.length,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => console.log("serving " + root + " on http://127.0.0.1:" + port));
