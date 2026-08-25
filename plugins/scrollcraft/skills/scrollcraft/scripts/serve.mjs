#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".json": "application/json; charset=utf-8",
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write("Usage: serve.mjs [--dir dist] [--port 4321]\n");
  process.exit(0);
}

const root = path.resolve(typeof args.dir === "string" ? args.dir : "dist");
const port = Number(args.port) || 4321;

if (!fs.existsSync(root)) {
  process.stderr.write(`serve: directory not found: ${root}\n`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(root, rel);

  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`serving ${root} at http://127.0.0.1:${port}\n`);
});
