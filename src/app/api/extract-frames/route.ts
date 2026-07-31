import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";
import { lookup } from "dns/promises";
import type { LookupAddress } from "dns";
import { isIPv4, isIPv6 } from "net";
import http from "http";
import https from "https";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";
import { auth } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { put } from "@vercel/blob";

const execFile = promisify(_execFile);

export const maxDuration = 300;

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_REDIRECTS = 5;

class VideoTooLargeError extends Error {}

function ipv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

// Loopback, RFC-1918 private, link-local (cloud metadata), CGNAT, benchmarking, multicast, reserved
function isPrivateIPv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
}

// Expand any IPv6 text form (compressed, zone-suffixed, embedded IPv4) into its 8 groups
function ipv6Groups(address: string): number[] | null {
  const halves = address.split("%")[0].split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const groups: number[] = [];
    for (const part of half.split(":")) {
      if (part.includes(".")) {
        const octets = ipv4Octets(part);
        if (!octets) return null;
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        groups.push(parseInt(part, 16));
      }
    }
    return groups;
  };

  const head = parseHalf(halves[0]);
  const tail = halves.length === 2 ? parseHalf(halves[1]) : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

function isPrivateIPv6(address: string): boolean {
  const g = ipv6Groups(address);
  if (!g) return true;
  const embeddedIPv4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff];
  // IPv4-mapped/compatible (::ffff:a.b.c.d, ::a.b.c.d), NAT64 and 6to4 — judge the embedded IPv4
  const zeroPrefix = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
  if (zeroPrefix && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(embeddedIPv4);
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIPv4(embeddedIPv4);
  }
  if (g[0] === 0x2002) return isPrivateIPv4([g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff]);
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique-local
  return (g[0] & 0xff00) === 0xff00; // multicast
}

function isPrivateAddress(address: string): boolean {
  if (isIPv4(address)) {
    const octets = ipv4Octets(address);
    return octets === null || isPrivateIPv4(octets);
  }
  if (isIPv6(address)) return isPrivateIPv6(address);
  return true;
}

// A hostname is only public if every address it resolves to is public — a literal
// blocklist misses DNS names that point at loopback/metadata addresses. The address
// that passed is returned so the request can be pinned to it: re-resolving at connect
// time would let a rebinding DNS answer swap in a private address after the check.
async function resolvePublicAddress(hostname: string): Promise<LookupAddress | null> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return null;
  if (isIPv4(host)) return isPrivateAddress(host) ? null : { address: host, family: 4 };
  if (isIPv6(host)) return isPrivateAddress(host) ? null : { address: host, family: 6 };

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return null;
    if (addresses.some(({ address }) => isPrivateAddress(address))) return null;
    return addresses[0];
  } catch {
    return null;
  }
}

// Connect to the address that was validated instead of letting the HTTP client
// resolve the hostname a second time. The URL is still passed through, so the Host
// header and TLS SNI stay correct.
function requestPinned(url: URL, pinned: LookupAddress): Promise<http.IncomingMessage> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        headers: { "user-agent": "ScrollCraft", accept: "*/*" },
        // Node connects with autoSelectFamily on by default, which calls the lookup
        // with `{ all: true }` and expects an array of addresses back; the positional
        // (address, family) form is only correct when `all` is not requested.
        lookup: (_hostname, options, callback) =>
          options?.all
            ? callback(null, [{ address: pinned.address, family: pinned.family }])
            : callback(null, pinned.address, pinned.family),
      },
      resolve,
    );
    request.on("error", reject);
    request.end();
  });
}

type DownloadResult = { ok: true } | { ok: false; error: string; status: number };

// Redirects are followed by hand so that every hop is re-validated — otherwise an
// allowed public URL can 302 straight into private space.
async function downloadVideo(startUrl: URL, destPath: string): Promise<DownloadResult> {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "videoUrl must use http or https", status: 400 };
    }
    const pinned = await resolvePublicAddress(url.hostname);
    if (!pinned) {
      return { ok: false, error: "videoUrl must be a public URL", status: 400 };
    }

    const response = await requestPinned(url, pinned);
    const statusCode = response.statusCode ?? 0;
    const location = response.headers.location;

    if (statusCode >= 300 && statusCode < 400 && location) {
      response.destroy();
      try {
        url = new URL(location, url);
      } catch {
        return { ok: false, error: "videoUrl redirects to an invalid location", status: 400 };
      }
      continue;
    }

    if (statusCode < 200 || statusCode >= 300) {
      response.destroy();
      throw new Error("Failed to download video");
    }

    const declared = Number(response.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES) {
      response.destroy();
      return { ok: false, error: "Video file too large (max 500 MB)", status: 413 };
    }

    // Stream to disk and abort the moment the cap is passed — Content-Length may be
    // absent or a lie, so it can never be the only size check
    try {
      await pipeline(
        response,
        async function* (source: AsyncIterable<Buffer>) {
          let received = 0;
          for await (const chunk of source) {
            received += chunk.length;
            if (received > MAX_VIDEO_BYTES) throw new VideoTooLargeError();
            yield chunk;
          }
        },
        createWriteStream(destPath),
      );
    } catch (err) {
      response.destroy();
      if (err instanceof VideoTooLargeError) {
        return { ok: false, error: "Video file too large (max 500 MB)", status: 413 };
      }
      throw err;
    }

    return { ok: true };
  }

  return { ok: false, error: "videoUrl has too many redirects", status: 400 };
}

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFile("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  const contentType = req.headers.get("content-type") || "";
  const tmpDir = path.join(process.cwd(), "tmp", `frames-${Date.now()}-${randomUUID()}`);

  try {
    await mkdir(tmpDir, { recursive: true });

    let videoPath: string;
    let fps = 24;
    let quality = 80;

    const clampFps = (v: unknown) => Math.min(60, Math.max(1, Math.floor(Number(v) || 24)));
    const clampQuality = (v: unknown) => Math.min(100, Math.max(1, Math.floor(Number(v) || 80)));

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("video") as File;
      fps = clampFps(formData.get("fps"));
      quality = clampQuality(formData.get("quality"));
      if (!file) return NextResponse.json({ error: "No video file" }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      videoPath = path.join(tmpDir, "input.mp4");
      await writeFile(videoPath, buffer);
    } else {
      const { videoUrl, fps: f, quality: q } = await req.json();
      fps = clampFps(f);
      quality = clampQuality(q);
      if (!videoUrl) return NextResponse.json({ error: "No videoUrl" }, { status: 400 });

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(videoUrl);
      } catch {
        return NextResponse.json({ error: "Invalid videoUrl" }, { status: 400 });
      }

      videoPath = path.join(tmpDir, "input.mp4");
      const download = await downloadVideo(parsedUrl, videoPath);
      if (!download.ok) {
        return NextResponse.json({ error: download.error }, { status: download.status });
      }
    }

    const hasFFmpeg = await ffmpegAvailable();
    if (!hasFFmpeg) {
      // Demo fallback — return placeholder frame URLs
      const frameCount = fps * 8;
      const frames = Array.from({ length: frameCount }, (_, i) =>
        `/api/demo-frame?i=${i}&total=${frameCount}`
      );
      return NextResponse.json({ frames, frameCount, demo: true });
    }

    const framesDir = path.join(tmpDir, "frames");
    await mkdir(framesDir, { recursive: true });

    // Extract frames with ffmpeg — use execFile (no shell interpolation) to prevent injection.
    // -protocol_whitelist keeps a crafted input (a playlist posing as a video) from making
    // ffmpeg pull in remote or arbitrary local resources.
    const jpegQuality = Math.round((quality / 100) * 31); // ffmpeg qscale: 1(best)–31(worst)
    const ffmpegQuality = Math.max(1, 31 - jpegQuality);
    await execFile("ffmpeg", [
      "-protocol_whitelist", "file,crypto,data",
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      "-q:v", String(ffmpegQuality),
      path.join(framesDir, "frame_%04d.jpg"),
      "-y",
    ]);

    // Read frames and convert to base64 data URLs
    // Cap at MAX_FRAMES to stay within Vercel's 4.5 MB response limit
    const MAX_FRAMES = 120;
    const allFrameFiles = (await readdir(framesDir))
      .filter(f => f.endsWith(".jpg"))
      .sort();

    const step = allFrameFiles.length > MAX_FRAMES
      ? allFrameFiles.length / MAX_FRAMES
      : 1;
    const frameFiles = allFrameFiles.length > MAX_FRAMES
      ? Array.from({ length: MAX_FRAMES }, (_, i) => allFrameFiles[Math.min(Math.floor(i * step), allFrameFiles.length - 1)])
      : allFrameFiles;

    const useBlobStorage = !!process.env.BLOB_READ_WRITE_TOKEN;
    const frames: string[] = [];
    const sessionId = `scrollcraft/${Date.now()}`;

    for (const file of frameFiles) {
      const buf = await readFile(path.join(framesDir, file));
      if (useBlobStorage) {
        const { url } = await put(`${sessionId}/${file}`, buf, {
          access: "public",
          contentType: "image/jpeg",
        });
        frames.push(url);
      } else {
        frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
      }
    }

    return NextResponse.json({ frames, frameCount: frames.length, stored: useBlobStorage });
  } catch (err) {
    console.error("extract-frames error:", err);
    return NextResponse.json({ error: "Frame extraction failed" }, { status: 500 });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
