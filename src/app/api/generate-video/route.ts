import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

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
        const err = await genRes.text();
        return NextResponse.json({ error: `Luma error: ${err}` }, { status: 500 });
      }
      const gen = await genRes.json();
      const generationId = gen.id;

      // Poll until complete
      let videoUrl = "";
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`, {
          headers: { "Authorization": `Bearer ${process.env.LUMAAI_API_KEY}` },
        });
        if (!pollRes.ok) continue;
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
        const err = await genRes.text();
        return NextResponse.json({ error: `Runway error: ${err}` }, { status: 500 });
      }
      const task = await genRes.json();
      const taskId = task.id;

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${process.env.RUNWAYML_API_KEY}`,
            "X-Runway-Version": "2024-11-06",
          },
        });
        if (!pollRes.ok) continue;
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
