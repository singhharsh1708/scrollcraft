import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { writeFile, mkdir, rm } from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";
import type { LookupAddress } from "dns";
import http from "http";
import https from "https";
import { randomUUID } from "crypto";
import os from "os";
import { pipeline } from "stream/promises";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";
import { resolvePublicAddress } from "@/lib/ssrfGuard";
import { put } from "@vercel/blob";

const execFile = promisify(_execFile);

export const maxDuration = 300;

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_REDIRECTS = 5;

class VideoTooLargeError extends Error {}

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
    // A stalling host would otherwise hold the invocation open until Vercel kills it.
    request.setTimeout(30_000, () => request.destroy(new Error("videoUrl timed out")));
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

  const rl = await rateLimit(`user:${session.user.id}`, { bucket: "extract-frames", limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  const contentType = req.headers.get("content-type") || "";
  const tmpDir = path.join(os.tmpdir(), `frames-${Date.now()}-${randomUUID()}`);

  try {
    await mkdir(tmpDir, { recursive: true });

    let videoPath: string;
    let fps = 24;
    let quality = 80;

    const clampFps = (v: unknown) => Math.min(60, Math.max(1, Math.floor(Number(v) || 24)));
    const clampQuality = (v: unknown) => Math.min(100, Math.max(1, Math.floor(Number(v) || 80)));

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("video");
      fps = clampFps(formData.get("fps"));
      quality = clampQuality(formData.get("quality"));
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "No video file" }, { status: 400 });
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: "Video file too large (max 500 MB)" }, { status: 413 });
      }

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

    // Fail loudly rather than substituting placeholders. This used to return 200 with
    // synthetic /api/demo-frame URLs, so an uploaded video was silently replaced by a
    // generic gradient — the user reached the editor believing their footage had been
    // processed, and only discovered otherwise on export.
    if (!(await ffmpegAvailable())) {
      logger.error("extract-frames: ffmpeg unavailable, refusing to substitute placeholders");
      return NextResponse.json(
        {
          error: "Video processing is unavailable on this server. Generate a background from a style instead.",
          code: "FFMPEG_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const framesDir = path.join(tmpDir, "frames");
    await mkdir(framesDir, { recursive: true });

    // Extract frames with ffmpeg — use execFile (no shell interpolation) to prevent injection.
    // -protocol_whitelist keeps a crafted input (a playlist posing as a video) from making
    // ffmpeg pull in remote or arbitrary local resources.
    const jpegQuality = Math.round((quality / 100) * 31); // ffmpeg qscale: 1(best)–31(worst)
    const ffmpegQuality = Math.max(1, 31 - jpegQuality);
    // 3600 = 60fps x 60s. We only sample MAX_FRAMES from the result, so more than this is
    // wasted disk; the cap keeps a long or high-fps input from writing tens of thousands.
    const MAX_EXTRACT_FRAMES = 3600;
    await execFile("ffmpeg", [
      "-protocol_whitelist", "file,crypto,data",
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      "-frames:v", String(MAX_EXTRACT_FRAMES),
      "-q:v", String(ffmpegQuality),
      path.join(framesDir, "frame_%06d.jpg"),
      "-y",
    ]);

    // Read frames and convert to base64 data URLs
    // Cap at MAX_FRAMES to stay within Vercel's 4.5 MB response limit
    const MAX_FRAMES = 120;
    const frameIndex = (name: string) => parseInt(name.match(/(\d+)/)?.[1] ?? "0", 10);
    const allFrameFiles = (await readdir(framesDir))
      .filter(f => f.endsWith(".jpg"))
      .sort((a, b) => frameIndex(a) - frameIndex(b));

    const step = allFrameFiles.length > MAX_FRAMES
      ? allFrameFiles.length / MAX_FRAMES
      : 1;
    const frameFiles = allFrameFiles.length > MAX_FRAMES
      ? Array.from({ length: MAX_FRAMES }, (_, i) => allFrameFiles[Math.min(Math.floor(i * step), allFrameFiles.length - 1)])
      : allFrameFiles;

    const useBlobStorage = !!process.env.BLOB_READ_WRITE_TOKEN;
    const frames: string[] = [];
    // Scope the prefix by user and a random id, not a bare timestamp: frames are public,
    // so a shared timestamp prefix plus fixed frame_NNNNNN names let one user enumerate
    // another's, and two same-millisecond extractions collide.
    const sessionId = `scrollcraft/${session.user.id}/${randomUUID()}`;

    for (const file of frameFiles) {
      const buf = await readFile(path.join(framesDir, file));
      if (useBlobStorage) {
        const { url } = await put(`${sessionId}/${file}`, buf, {
          access: "public",
          contentType: "image/jpeg",
          addRandomSuffix: true,
        });
        frames.push(url);
      } else {
        frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
      }
    }

    return NextResponse.json({ frames, frameCount: frames.length, stored: useBlobStorage });
  } catch (err) {
    logger.error("extract-frames failed", { err });
    return NextResponse.json({ error: "Frame extraction failed" }, { status: 500 });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
