import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";

const execAsync = promisify(exec);

export const maxDuration = 300;

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const tmpDir = path.join(process.cwd(), "tmp", `frames-${Date.now()}`);

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

      // Download the video
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to download video");
      const buffer = Buffer.from(await response.arrayBuffer());
      videoPath = path.join(tmpDir, "input.mp4");
      await writeFile(videoPath, buffer);
    }

    const hasFFmpeg = await ffmpegAvailable();
    if (!hasFFmpeg) {
      // Demo fallback — return placeholder frame URLs
      const frameCount = fps * 8;
      const frames = Array.from({ length: frameCount }, (_, i) =>
        `/api/demo-frame?i=${i}&total=${frameCount}`
      );
      await rm(tmpDir, { recursive: true, force: true });
      return NextResponse.json({ frames, frameCount, demo: true });
    }

    const framesDir = path.join(tmpDir, "frames");
    await mkdir(framesDir, { recursive: true });

    // Extract frames with ffmpeg
    const jpegQuality = Math.round((quality / 100) * 31); // ffmpeg qscale: 1(best)–31(worst)
    const ffmpegQuality = Math.max(1, 31 - jpegQuality);
    await execAsync(
      `ffmpeg -i "${videoPath}" -vf "fps=${fps}" -q:v ${ffmpegQuality} "${path.join(framesDir, "frame_%04d.jpg")}" -y`
    );

    // Read frames and convert to base64 data URLs
    const frameFiles = (await readdir(framesDir))
      .filter(f => f.endsWith(".jpg"))
      .sort();

    const frames: string[] = [];
    for (const file of frameFiles) {
      const buf = await readFile(path.join(framesDir, file));
      frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
    }

    await rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({ frames, frameCount: frames.length });
  } catch (err) {
    console.error("extract-frames error:", err);
    if (existsSync(tmpDir)) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: "Frame extraction failed" }, { status: 500 });
  }
}
