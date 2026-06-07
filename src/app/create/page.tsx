"use client";
import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Sparkles, Upload, CheckCircle2, Loader2, Layers, Zap, Waves, Circle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { generate2DFrames, type Style2D } from "@/lib/generate2DFrames";

const STYLES: { id: Style2D; label: string; description: string; icon: React.ReactNode; colors: [string, string, string] }[] = [
  { id: "gradient",  label: "Gradient Flow",  description: "Smooth color morphing with floating light orbs", icon: <Circle className="w-5 h-5" />,  colors: ["#7c3aed", "#2563eb", "#0f172a"] },
  { id: "geometric", label: "Geometric",      description: "Rotating polygons and shapes in deep space",   icon: <Layers className="w-5 h-5" />,   colors: ["#7c3aed", "#06b6d4", "#6d28d9"] },
  { id: "particles", label: "Particles",      description: "Drifting star-field with nebula glow",         icon: <Sparkles className="w-5 h-5" />, colors: ["#f59e0b", "#ef4444", "#7c3aed"] },
  { id: "wave",      label: "Wave",           description: "Layered flowing waves with depth",             icon: <Waves className="w-5 h-5" />,    colors: ["#0ea5e9", "#6366f1", "#0f172a"] },
];

const COLOR_PALETTES: { label: string; colors: [string, string, string] }[] = [
  { label: "Cosmic Purple", colors: ["#7c3aed", "#2563eb", "#0f172a"] },
  { label: "Ember",         colors: ["#ef4444", "#f97316", "#1c0a00"] },
  { label: "Ocean",         colors: ["#0ea5e9", "#6366f1", "#020c14"] },
  { label: "Forest",        colors: ["#10b981", "#06b6d4", "#021a10"] },
  { label: "Gold",          colors: ["#f59e0b", "#ef4444", "#1a0d00"] },
  { label: "Monochrome",    colors: ["#e2e8f0", "#94a3b8", "#0f172a"] },
];

const STEPS = ["Style", "Configure", "Generate"];

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planName = searchParams.get("plan") || "";

  const [step, setStep] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<Style2D>("gradient");
  const [colors, setColors] = useState<[string, string, string]>(["#7c3aed", "#2563eb", "#0f172a"]);
  const [frameCount, setFrameCount] = useState(120);
  const [generateMobile, setGenerateMobile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    setStep(2);
    setIsGenerating(true);
    setProgress(0);
    try {
      const opts = { style: selectedStyle, color1: colors[0], color2: colors[1], color3: colors[2], frameCount };

      setProgressLabel(generateMobile ? "Generating desktop frames…" : "Generating frames…");
      const frames = await generate2DFrames(
        { ...opts, width: 1280, height: 720 },
        (p) => setProgress(generateMobile ? Math.round(p * 0.5) : p)
      );

      if (generateMobile) {
        setProgressLabel("Generating mobile portrait frames…");
        const mobileFrames = await generate2DFrames(
          { ...opts, width: 720, height: 1280 },
          (p) => setProgress(50 + Math.round(p * 0.5))
        );
        try {
          sessionStorage.setItem("scrollcraft_mobile_frames", JSON.stringify(mobileFrames));
        } catch {
          // sessionStorage full — skip mobile frames silently
        }
      } else {
        sessionStorage.removeItem("scrollcraft_mobile_frames");
      }

      const params = new URLSearchParams({
        frames: JSON.stringify(frames),
        frameCount: String(frames.length),
        fps: "24",
        prompt: STYLES.find(s => s.id === selectedStyle)?.label ?? selectedStyle,
        ...(generateMobile ? { hasMobileFrames: "1" } : {}),
      });
      router.push(`/editor?${params.toString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setStep(1);
      setIsGenerating(false);
    }
  };

  const handleUpload = async (file: File) => {
    setStep(2);
    setIsGenerating(true);
    setProgress(20);
    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("fps", "24");
      formData.append("quality", "80");
      const res = await fetch("/api/extract-frames", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setProgress(100);
      const params = new URLSearchParams({
        frames: JSON.stringify(data.frames),
        frameCount: String(data.frameCount),
        fps: "24",
        prompt: "Video upload",
      });
      router.push(`/editor?${params.toString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStep(1);
      setIsGenerating(false);
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
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-semibold">ScrollCraft</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/presets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Presets</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </div>
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

      {planName && (
        <div className="flex justify-center pb-2">
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Plan: {planName}</Badge>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 pb-12">

        {/* Step 0 — Pick style */}
        {step === 0 && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tighter mb-2">Choose your style</h1>
              <p className="text-muted-foreground">Pick an animation style for your scroll background</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStyle(s.id); setColors(s.colors); }}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    selectedStyle === s.id
                      ? "border-primary/60 bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-white/8 bg-card hover:border-white/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${selectedStyle === s.id ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"}`}>
                    {s.icon}
                  </div>
                  <div className="font-semibold mb-0.5">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                </button>
              ))}
            </div>
            <Button
              onClick={() => setStep(1)}
              className="w-full bg-primary hover:bg-primary/90 text-white py-5 font-semibold"
            >
              Next: Configure <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 1 — Configure */}
        {step === 1 && (
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tighter mb-2">Configure</h1>
              <p className="text-muted-foreground">Pick a color palette and frame count</p>
            </div>

            <div className="space-y-6 p-6 rounded-2xl border border-white/8 bg-card">
              <div className="space-y-3">
                <label className="font-medium text-sm">Color Palette</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PALETTES.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setColors(p.colors)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        colors[0] === p.colors[0] ? "border-primary/60 bg-primary/10" : "border-white/8 hover:border-white/20"
                      }`}
                    >
                      <div className="flex gap-0.5 flex-shrink-0">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="font-medium text-sm">Frame Count</label>
                  <Badge variant="outline" className="border-primary/30 text-primary">{frameCount} frames</Badge>
                </div>
                <input
                  type="range"
                  min={60} max={200} step={20}
                  value={frameCount}
                  onChange={(e) => setFrameCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground">More frames = smoother scroll. 120 is the sweet spot.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="font-medium text-sm">Generate mobile variant</p>
                  <p className="text-xs text-muted-foreground">Also create portrait 9:16 frames for phones</p>
                </div>
                <button
                  onClick={() => setGenerateMobile(m => !m)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${generateMobile ? "bg-primary" : "bg-white/10"}`}
                  role="switch"
                  aria-checked={generateMobile}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${generateMobile ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {/* Upload your own video */}
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">— or upload your own video —</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-5 rounded-2xl border-2 border-dashed border-white/15 hover:border-primary/40 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-6 h-6" />
                <p className="font-medium text-sm">Drop a video or click to upload</p>
                <p className="text-xs">MP4, MOV, WebM — max 500MB</p>
              </button>
              <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="border-white/10">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button onClick={handleGenerate} className="flex-1 bg-primary hover:bg-primary/90 text-white py-5 font-semibold">
                <Sparkles className="mr-2 w-4 h-4" /> Generate
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Generating */}
        {step === 2 && (
          <div className="w-full max-w-lg text-center space-y-8">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Generating frames…</h2>
              <p className="text-muted-foreground">{isGenerating ? (progressLabel || "Drawing your scroll animation") : "Processing…"}</p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
            <p className="text-xs text-muted-foreground">Usually takes 2–5 seconds</p>
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
