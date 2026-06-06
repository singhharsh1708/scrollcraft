"use client";
import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Sparkles, Upload, Film, Settings, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const TEMPLATE_PROMPTS: Record<string, string> = {
  "SaaS Hero": "A cinematic flythrough of a dark futuristic digital dashboard. Glowing UI panels float in dark space. Purple and blue neon accents. Depth of field blur. Ultra-premium tech aesthetic.",
  "Product Launch": "Cinematic slow-motion reveal of a sleek product materializing from darkness. Dramatic lighting, luxury product photography feel. Black background with golden highlights.",
  "Agency Portfolio": "Abstract flowing geometric shapes in deep space. Bold colors transitioning from black to vibrant gradients. Minimal, modern, editorial feel.",
  "App Showcase": "A smartphone floating in space slowly rotating. App interfaces visible on screen. Soft dramatic lighting. Cinematic 3D render look.",
  "E-commerce": "360 degree spin of a luxury product on a dark background. Studio lighting with rim light effects. Premium commercial photography style.",
  "Restaurant": "Slow cinematic pan across beautifully plated food. Soft warm lighting, shallow depth of field. Fine dining atmosphere.",
};

const STEPS = ["Describe", "Configure", "Generate", "Done"];

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateName = searchParams.get("template") || "";

  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState(TEMPLATE_PROMPTS[templateName] || "");
  const [fps, setFps] = useState([24]);
  const [quality, setQuality] = useState([80]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Please enter a prompt"); return; }
    setStep(2);
    setIsGenerating(true);
    setProgress(10);
    setProgressMsg("Sending to AI video model...");

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setProgress(60);
      setProgressMsg("Video generated! Extracting frames...");
      setIsGenerating(false);
      setIsExtracting(true);

      const extractRes = await fetch("/api/extract-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: data.videoUrl, fps: fps[0], quality: quality[0] }),
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error || "Extraction failed");

      setProgress(100);
      setProgressMsg("Done! Redirecting to editor...");
      setIsExtracting(false);

      const params = new URLSearchParams({
        frames: JSON.stringify(extractData.frames),
        frameCount: String(extractData.frameCount),
        fps: String(fps[0]),
        prompt,
      });
      router.push(`/editor?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setStep(1);
      setIsGenerating(false);
      setIsExtracting(false);
    }
  };

  const handleUpload = async (file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setStep(2);
    setIsExtracting(true);
    setProgress(20);
    setProgressMsg("Uploading and extracting frames...");

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("fps", String(fps[0]));
      formData.append("quality", String(quality[0]));

      const res = await fetch("/api/extract-frames", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      setProgress(100);
      setProgressMsg("Frames ready! Opening editor...");
      setIsExtracting(false);

      const params = new URLSearchParams({
        frames: JSON.stringify(data.frames),
        frameCount: String(data.frameCount),
        fps: String(fps[0]),
        prompt: prompt || "Custom video upload",
      });
      router.push(`/editor?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setStep(1);
      setIsExtracting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-semibold">ScrollCraft</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center gap-2 py-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              i === step ? "bg-primary text-white" :
              i < step ? "bg-primary/20 text-primary" :
              "bg-white/5 text-muted-foreground"
            }`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
              {s}
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < step ? "bg-primary/40" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        {step === 0 && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tighter mb-2">Describe your vision</h1>
              <p className="text-muted-foreground">Tell the AI what atmosphere, style, or scene you want for your scroll background</p>
            </div>
            {templateName && (
              <Badge className="bg-primary/20 text-primary border-primary/30">
                Template: {templateName}
              </Badge>
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cinematic flythrough of a dark futuristic city at night. Neon lights reflecting on wet streets. Blade Runner aesthetic. Slow, dreamy camera movement..."
              className="min-h-[160px] bg-card border-white/10 text-base resize-none focus:border-primary/50"
            />
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TEMPLATE_PROMPTS).map(([name, p]) => (
                <button
                  key={name}
                  onClick={() => setPrompt(p)}
                  className="text-left p-3 rounded-xl border border-white/8 hover:border-primary/30 bg-card text-sm transition-colors"
                >
                  <div className="font-medium mb-0.5">{name}</div>
                  <div className="text-muted-foreground text-xs line-clamp-1">{p.slice(0, 60)}...</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(1)}
                disabled={!prompt.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-white py-5 font-semibold"
              >
                Next: Configure <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tighter mb-2">Configure output</h1>
              <p className="text-muted-foreground">Tune frame rate and quality for your needs</p>
            </div>

            <div className="space-y-6 p-6 rounded-2xl border border-white/8 bg-card">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium flex items-center gap-2"><Film className="w-4 h-4 text-primary" /> Frame Rate</label>
                  <Badge variant="outline" className="border-primary/30 text-primary">{fps[0]} FPS</Badge>
                </div>
                <Slider value={fps} onValueChange={(v) => setFps(Array.isArray(v) ? [...(v as number[])] : [v as number])} min={10} max={40} step={2} className="w-full" />
                <p className="text-xs text-muted-foreground">Higher FPS = smoother scroll, larger file size. 24fps is ideal.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Image Quality</label>
                  <Badge variant="outline" className="border-primary/30 text-primary">{quality[0]}%</Badge>
                </div>
                <Slider value={quality} onValueChange={(v) => setQuality(Array.isArray(v) ? [...(v as number[])] : [v as number])} min={40} max={95} step={5} className="w-full" />
                <p className="text-xs text-muted-foreground">Higher quality = sharper frames, larger bundle. 80% is the sweet spot.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">— or upload your own video —</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-6 rounded-2xl border-2 border-dashed border-white/15 hover:border-primary/40 transition-colors flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-8 h-8" />
                <div>
                  <p className="font-medium">Drop a video or click to upload</p>
                  <p className="text-sm">MP4, MOV, WebM — max 500MB</p>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="border-white/10">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button onClick={handleGenerate} className="flex-1 bg-primary hover:bg-primary/90 text-white py-5 font-semibold">
                <Sparkles className="mr-2 w-4 h-4" /> Generate with AI
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-lg text-center space-y-8">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {isGenerating ? "Generating video..." : "Extracting frames..."}
              </h2>
              <p className="text-muted-foreground">{progressMsg}</p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
            <p className="text-xs text-muted-foreground">This usually takes 30–90 seconds</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  );
}
