#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

function fail(msg) {
  process.stderr.write("verify: " + msg + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".webm": "audio/webm", ".aac": "audio/aac", ".flac": "audio/flac",
};

function serve(root) {
  const missing = [];
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); }
    catch { res.writeHead(400).end(); return; }
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.stat(target, (err, st) => {
      if (err || !st.isFile()) {
        if (rel !== "favicon.ico") missing.push(rel);
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
        "Content-Length": st.size,
      });
      fs.createReadStream(target).pipe(res);
    });
  });
  return { server, missing };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let b = "";
      res.on("data", (d) => { b += d; });
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.setTimeout(4000, () => req.destroy(new Error("timeout")));
  });
}

async function waitForPort(userDataDir, timeoutMs) {
  const file = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const txt = fs.readFileSync(file, "utf8").split("\n");
      const port = Number(txt[0]);
      if (port > 0) return port;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error("Chrome did not report a debugging port");
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        (this.handlers.get(msg.method) || []).forEach((h) => h(msg.params));
      }
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`${method} timed out`)); }
      }, 20000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "page threw");
    return r.result.value;
  }
}

const PROBE = `(() => {
  const canvas = document.getElementById('scroll-canvas');
  if (!canvas) return { error: 'no #scroll-canvas' };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parseRgb = (s) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const effectiveOpacity = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return o;
  };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sampleRect = (cssX, cssY, cssW, cssH) => {
    const x = Math.max(0, Math.round(cssX * dpr));
    const y = Math.max(0, Math.round(cssY * dpr));
    const w = Math.max(1, Math.min(canvas.width - x, Math.round(cssW * dpr)));
    const h = Math.max(1, Math.min(canvas.height - y, Math.round(cssH * dpr)));
    if (w < 1 || h < 1) return null;
    const d = ctx.getImageData(x, y, w, h).data;
    let lum = 0, n = 0, min = 255, max = 0, sig = 0;
    const step = Math.max(4, Math.floor(d.length / 4 / 4000) * 4);
    for (let i = 0; i < d.length; i += step) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      lum += relLum(r, g, b);
      const y8 = (r * 299 + g * 587 + b * 114) / 1000;
      if (y8 < min) min = y8;
      if (y8 > max) max = y8;
      sig = (sig * 31 + r + g * 3 + b * 7) % 1000000007;
      n++;
    }
    return { lum: lum / n, spread: max - min, sig, samples: n };
  };

  const full = sampleRect(0, 0, window.innerWidth, window.innerHeight);
  if (!full) return { error: 'canvas has no readable pixels' };

  const contrasts = [];
  for (const el of document.querySelectorAll('.section-content')) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.width < 1 || r.height < 1) continue;
    if (effectiveOpacity(el) < 0.01) continue;
    const behind = sampleRect(r.left, Math.max(0, r.top), r.width, Math.min(r.height, window.innerHeight));
    if (!behind) continue;
    for (const t of el.querySelectorAll('h2, p, a')) {
      const tr = t.getBoundingClientRect();
      if (tr.width < 1 || tr.height < 1) continue;
      if (!t.textContent.trim()) continue;
      const cs = getComputedStyle(t);
      const fg = parseRgb(cs.color);
      if (!fg) continue;

      const own = parseRgb(cs.backgroundColor);
      let bgLum, over;
      if (own && own.a >= 0.95) {
        bgLum = relLum(own.r, own.g, own.b);
        over = 'own background';
      } else {
        const local = sampleRect(tr.left, Math.max(0, tr.top), tr.width, Math.min(tr.height, window.innerHeight)) || behind;
        bgLum = local.lum;
        over = 'frame';
      }

      const alpha = Math.max(0, Math.min(1, fg.a * effectiveOpacity(t)));
      const lfRaw = relLum(fg.r, fg.g, fg.b);
      const lf = alpha >= 0.999 ? lfRaw : lfRaw * alpha + bgLum * (1 - alpha);
      const ratio = (Math.max(lf, bgLum) + 0.05) / (Math.min(lf, bgLum) + 0.05);
      contrasts.push({
        tag: t.tagName.toLowerCase(),
        text: t.textContent.trim().slice(0, 48),
        ratio: Math.round(ratio * 100) / 100,
        alpha: Math.round(alpha * 1000) / 1000,
        over,
      });
    }
  }

  return {
    scrollY: Math.round(window.scrollY),
    docHeight: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    canvas: { w: canvas.width, h: canvas.height, lum: full.lum, spread: full.spread, sig: full.sig },
    contrasts,
  };
})()`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: verify.mjs [--dir dist] [--samples 16] [--width 1280] [--height 800]\n" +
      "                  [--min-contrast 4.5] [--shots <dir>] [--json]\n\n" +
      "Loads the built site in headless Chrome, scrolls it, and measures the frames the\n" +
      "reader actually sees: that the canvas paints, that it advances, and that every line\n" +
      "of copy clears a contrast ratio against the pixels behind it.\n"
    );
    return;
  }

  const dir = path.resolve(typeof args.dir === "string" ? args.dir : "dist");
  if (!fs.existsSync(path.join(dir, "index.html"))) fail(`no index.html in ${dir}. Build first.`);

  const samples = Math.max(2, Math.min(60, Number(args.samples) || 16));
  const width = Math.max(320, Math.min(3840, Number(args.width) || 1280));
  const height = Math.max(400, Math.min(2160, Number(args.height) || 800));
  const minContrast = Number(args["min-contrast"]) || 4.5;
  const shotsDir = typeof args.shots === "string" ? path.resolve(args.shots) : null;

  const chrome = findChrome();
  if (!chrome) {
    fail("no Chrome, Chromium or Edge found. Set CHROME_PATH to the binary, or install one.");
  }

  const { server, missing } = serve(dir);
  const port = await listen(server);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrollcraft-verify-"));

  const proc = spawn(chrome, [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${userDataDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--disable-extensions", "--disable-background-networking",
    `--window-size=${width},${height}`, "about:blank",
  ], { stdio: "ignore" });

  const problems = [];
  const warnings = [];
  let cdp;

  const cleanup = () => {
    try { cdp?.ws.close(); } catch { /* closed */ }
    try { proc.kill(); } catch { /* gone */ }
    try { server.close(); } catch { /* closed */ }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* gone */ }
  };

  try {
    const debugPort = await waitForPort(userDataDir, 15000);
    const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page = targets.find((t) => t.type === "page");
    if (!page) throw new Error("no page target in Chrome");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", () => rej(new Error("could not attach to Chrome")), { once: true });
    });
    cdp = new Cdp(ws);

    const consoleErrors = [];
    cdp.on("Runtime.exceptionThrown", (p) => {
      consoleErrors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "exception");
    });
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? "").join(" "));
    });

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: false,
    });

    const loaded = new Promise((res) => cdp.on("Page.loadEventFired", res));
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    await loaded;
    await cdp.eval("new Promise(r => setTimeout(r, 700))");

    const first = await cdp.eval(PROBE);
    if (first?.error) throw new Error(first.error);

    const track = first.docHeight - height;
    if (track <= 0) problems.push(`page is not scrollable: document height ${first.docHeight} vs viewport ${height}`);
    if (first.overflowX) problems.push("page scrolls horizontally, which it must never do");

    if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

    const seen = new Map();
    const rows = [];
    let blank = 0;
    let worst = { ratio: Infinity, text: "", tag: "", at: 0 };

    for (let i = 0; i < samples; i++) {
      const y = Math.round((track > 0 ? track : 0) * (i / (samples - 1)));
      await cdp.eval(
        `window.scrollTo(0, ${y});\n` +
        `new Promise((resolve) => {\n` +
        `  const deadline = performance.now() + 3000;\n` +
        `  const opacityOf = (el) => {\n` +
        `    let o = 1;\n` +
        `    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {\n` +
        `      const v = parseFloat(getComputedStyle(n).opacity);\n` +
        `      if (!Number.isNaN(v)) o *= v;\n` +
        `    }\n` +
        `    return o;\n` +
        `  };\n` +
        `  const settled = () => {\n` +
        `    if (performance.now() > deadline) { resolve(); return; }\n` +
        `    const onscreen = [...document.querySelectorAll('.section-content')].filter((el) => {\n` +
        `      const r = el.getBoundingClientRect();\n` +
        `      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;\n` +
        `    });\n` +
        `    const faded = onscreen.some((el) => {\n` +
        `      if (!el.classList.contains('visible')) return true;\n` +
        `      if (opacityOf(el) < 0.99) return true;\n` +
        `      return [...el.children].some((c) => opacityOf(c) < 0.99);\n` +
        `    });\n` +
        `    const running = document.getAnimations().some((a) => a.playState === 'running');\n` +
        `    if (faded || running) { requestAnimationFrame(settled); return; }\n` +
        `    setTimeout(resolve, 60);\n` +
        `  };\n` +
        `  requestAnimationFrame(() => requestAnimationFrame(settled));\n` +
        `})`
      );
      const s = await cdp.eval(PROBE);
      if (s?.error) { problems.push(`probe failed at y=${y}: ${s.error}`); break; }

      if (s.canvas.spread < 2) blank++;
      seen.set(s.canvas.sig, (seen.get(s.canvas.sig) || 0) + 1);

      for (const c of s.contrasts) {
        if (c.ratio < worst.ratio) worst = { ...c, at: y };
        if (c.ratio < minContrast) {
          problems.push(
            `contrast ${c.ratio}:1 at scrollY ${y} on <${c.tag}> "${c.text}" (needs ${minContrast}:1)`
          );
        }
      }

      rows.push({ y, lum: Math.round(s.canvas.lum * 1000) / 1000, spread: Math.round(s.canvas.spread), copy: s.contrasts.length });

      if (shotsDir) {
        const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(shotsDir, `scroll_${String(i).padStart(2, "0")}.png`), Buffer.from(shot.data, "base64"));
      }
    }

    if (blank === rows.length) problems.push("the canvas never painted anything at any scroll position");
    else if (blank > 0) warnings.push(`canvas was flat at ${blank} of ${rows.length} positions`);

    const distinct = seen.size;
    if (rows.length > 1 && distinct === 1) {
      problems.push("the background never changed while scrolling, so the scrub does nothing");
    } else if (rows.length > 2 && distinct < Math.ceil(rows.length / 2)) {
      warnings.push(`only ${distinct} distinct frames across ${rows.length} positions — the scrub looks steppy`);
    }

    const missed = [...new Set(missing)];
    if (missed.length) {
      problems.push(`the page requested ${missed.length} file(s) that do not exist, e.g. ${missed.slice(0, 3).join(", ")}`);
    }
    for (const e of consoleErrors.slice(0, 5)) problems.push(`page error: ${String(e).slice(0, 160)}`);

    if (args.json) {
      process.stdout.write(JSON.stringify({ rows, problems, warnings, distinctFrames: distinct, worstContrast: worst }, null, 2) + "\n");
    } else {
      process.stdout.write(`  scrolled ${rows.length} positions over ${first.docHeight}px\n`);
      process.stdout.write(`  distinct frames rendered: ${distinct}\n`);
      if (Number.isFinite(worst.ratio)) {
        process.stdout.write(`  worst copy contrast: ${worst.ratio}:1 on <${worst.tag}> "${worst.text}" at y=${worst.at}\n`);
      }
      if (shotsDir) process.stdout.write(`  screenshots: ${shotsDir}\n`);
      for (const w of warnings) process.stdout.write("warn: " + w + "\n");
      for (const p of problems) process.stdout.write("FAIL: " + p + "\n");
      process.stdout.write(`\n${problems.length} problem(s), ${warnings.length} warning(s)\n`);
    }
  } catch (e) {
    cleanup();
    fail(e.message);
  }

  cleanup();
  process.exit(problems.length ? 1 : 0);
}

main();
