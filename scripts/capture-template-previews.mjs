#!/usr/bin/env node
/**
 * Capture a still of every template's first screen, for the gallery cards.
 *
 * The cards used to draw each template's background on a paused canvas. For the nine
 * templates built on the dark particle and geometric styles that was a black rectangle:
 * measured on the live gallery, a mean luma under 4 out of 255. A still of the template's
 * own opening heading shows its palette, typeface and copy instead, which is what someone
 * browsing the gallery is trying to judge.
 *
 * Needs a running build and Chrome listening for DevTools on port 9222:
 *   npm run build && npx next start -p 3000 &
 *   "<chrome>" --headless=new --remote-debugging-port=9222 &
 *   node scripts/capture-template-previews.mjs http://127.0.0.1:3000
 */
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const OUT = "public/template-previews";
const DEVTOOLS = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugs = [...readFileSync("src/lib/templates.ts", "utf8").matchAll(/^ {4}slug: "([^"]+)"/gm)].map((m) => m[1]);
if (slugs.length === 0) throw new Error("no template slugs found");

async function pageSocket() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetch(`${DEVTOOLS}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Chrome is not listening on 9222");
}

const ws = new WebSocket(await pageSocket());
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable");
await send("Runtime.enable");
// 16:10, the shape of a gallery card.
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
mkdirSync(OUT, { recursive: true });

for (const slug of slugs) {
  await send("Page.navigate", { url: `${BASE}/templates/${slug}` });
  // Frames render in the browser first; wait until the loading screen has gone.
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const loading = await evaluate(`/Rendering frames/.test(document.body.innerText)`);
    if (i > 3 && !loading) break;
  }
  await evaluate(`(() => { const s = document.createElement("style");
    s.textContent = ".fixed.top-4, .fixed.bottom-4 { display: none !important; }";
    document.head.appendChild(s); })()`);
  // Frame the first real section at the top of its track: its sticky block is pinned
  // there in the layout the template chose, and its reveal has fired. Framing by the
  // heading's own box caught poster-scale headings mid-reveal, clipped at the top.
  const top = await evaluate(`(() => {
    const s = document.querySelector('[data-sc-section]:not([data-sc-kind="spacer"])');
    return s && s.querySelector("h1, h2") ? s.getBoundingClientRect().top + scrollY : null; })()`);
  if (top === null) throw new Error(`${slug}: no section with a heading to frame`);
  await evaluate(`window.scrollTo(0, ${top} + 2)`);
  await sleep(2800);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = `${OUT}/${slug}.jpg`;
  const info = await sharp(Buffer.from(data, "base64")).resize({ width: 800 }).jpeg({ quality: 78, mozjpeg: true }).toFile(file);
  const { channels } = await sharp(file).stats();
  const luma = 0.2126 * channels[0].mean + 0.7152 * channels[1].mean + 0.0722 * channels[2].mean;
  console.log(`${slug.padEnd(20)} ${String(Math.round(info.size / 1024)).padStart(3)} KiB  mean luma ${luma.toFixed(1)}`);
}
ws.close();
process.exit(0);
