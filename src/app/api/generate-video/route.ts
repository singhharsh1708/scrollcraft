import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { auth } from "@/auth";

export const maxDuration = 300;

// The poll loop must finish inside maxDuration with room for request latency. 60 × 5s is
// exactly the budget, so the platform killed the invocation (504, no JSON body) before the
// timeout branch below could ever run.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 45;
const MAX_BODY_BYTES = 8_000;

const bodySchema = z.object({ prompt: z.string().trim().min(1).max(2000) });

/** A permanent provider failure should not burn the whole budget polling. */
function isPermanentFailure(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  try {
    // `prompt` was previously forwarded to a paid provider with no type or length check,
    // so a 5 MB string or a non-string value went straight upstream.
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "A prompt of 1-2000 characters is required" }, { status: 400 });
    }
    const { prompt } = parsed.data;

    // Luma AI (Dream Machine) path
    if (process.env.LUMAAI_API_KEY) {
      const genRes = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.LUMAAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "16:9",
          loop: false,
        }),
      });
      if (!genRes.ok) {
        console.error("Luma API error:", genRes.status);
        return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 500 });
      }
      const gen = await genRes.json();
      const generationId = typeof gen?.id === "string" ? gen.id.trim() : "";
      // Without this an unexpected 200 response shape polled ".../generations/undefined".
      if (!generationId) {
        console.error("Luma API returned no generation id");
        return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 502 });
      }

      // Poll until complete
      let videoUrl = "";
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(generationId)}`, {
          headers: { "Authorization": `Bearer ${process.env.LUMAAI_API_KEY}` },
        });
        if (!pollRes.ok) {
          // A revoked key or over-quota account returns 401/403 on every poll; continuing
          // just burned the entire budget before failing.
          if (isPermanentFailure(pollRes.status)) {
            console.error("Luma poll failed permanently:", pollRes.status);
            return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 502 });
          }
          continue;
        }
        const pollData = await pollRes.json();
        if (pollData.state === "completed") {
          videoUrl = pollData.assets?.video;
          break;
        }
        if (pollData.state === "failed") {
          return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
        }
      }
      if (!videoUrl) return NextResponse.json({ error: "Generation timed out" }, { status: 500 });
      return NextResponse.json({ videoUrl });
    }

    // Runway ML path
    if (process.env.RUNWAYML_API_KEY) {
      const genRes = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RUNWAYML_API_KEY}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          model: "gen4_turbo",
          promptText: prompt,
          ratio: "1280:720",
          duration: 5,
        }),
      });
      if (!genRes.ok) {
        console.error("Runway API error:", genRes.status);
        return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 500 });
      }
      const task = await genRes.json();
      const taskId = typeof task?.id === "string" ? task.id.trim() : "";
      if (!taskId) {
        console.error("Runway API returned no task id");
        return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 502 });
      }

      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`, {
          headers: {
            "Authorization": `Bearer ${process.env.RUNWAYML_API_KEY}`,
            "X-Runway-Version": "2024-11-06",
          },
        });
        if (!pollRes.ok) {
          if (isPermanentFailure(pollRes.status)) {
            console.error("Runway poll failed permanently:", pollRes.status);
            return NextResponse.json({ error: "Video generation failed. Try again later." }, { status: 502 });
          }
          continue;
        }
        const pollData = await pollRes.json();
        if (pollData.status === "SUCCEEDED") {
          return NextResponse.json({ videoUrl: pollData.output?.[0] });
        }
        if (pollData.status === "FAILED") {
          return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
        }
      }
      return NextResponse.json({ error: "Generation timed out" }, { status: 500 });
    }

    // Demo mode — return a sample video URL for testing
    return NextResponse.json({
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      demo: true,
    });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
