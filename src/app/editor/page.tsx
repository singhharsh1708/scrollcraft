"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Download, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
  Sparkles, Layers, Settings, Type, Loader2, AlignLeft, AlignCenter, AlignRight,
  MessageSquare, Send, X, Bot, Monitor, Tablet, Smartphone, Music, Volume2, VolumeX
} from "lucide-react";
import { useScrollAudio } from "@/lib/useScrollAudio";
import Link from "next/link";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const ScrollEngine = dynamic(() => import("@/components/ScrollEngine"), { ssr: false });
const ScrollSection = dynamic(() => import("@/components/ScrollSection"), { ssr: false });

interface Section {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  accentColor: string;
  headingColor: string;
  bodyColor: string;
  textAlign: "left" | "center" | "right";
  align: string;
  justify: string;
  scrollHeight: number;
  visible: boolean;
}

const defaultSection = (i: number): Section => ({
  id: `section-${Date.now()}-${i}`,
  eyebrow: "",
  heading: `Section ${i + 1}`,
  body: "",
  ctaLabel: "",
  ctaHref: "#",
  accentColor: "#a78bfa",
  headingColor: "#ffffff",
  bodyColor: "rgba(255,255,255,0.7)",
  textAlign: "center",
  align: "center",
  justify: "center",
  scrollHeight: 1000,
  visible: true,
});

function EditorInner() {
  const searchParams = useSearchParams();
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // Derive initial frame state from URL params at render time (no setState-in-effect)
  const framesParam = searchParams.get("frames");
  const countParam = searchParams.get("frameCount");
  const fpsParam = searchParams.get("fps");

  const parsedFrames: string[] | null = (() => {
    if (!framesParam) return null;
    try { return JSON.parse(framesParam); } catch { return null; }
  })();

  const DEMO_COUNT = 120;
  const demoFrameUrls = Array.from({ length: DEMO_COUNT }, (_, i) => `/api/demo-frame?i=${i}&total=${DEMO_COUNT}`);
  const initialIsDemo = !parsedFrames;

  const [frames] = useState<string[]>(parsedFrames ?? demoFrameUrls);
  const [frameCount] = useState(parsedFrames ? parseInt(countParam || String(parsedFrames.length)) : DEMO_COUNT);
  const [fps] = useState(parsedFrames ? parseInt(fpsParam || "24") : 24);
  const [sections, setSections] = useState<Section[]>([defaultSection(0)]);
  const [selectedSection, setSelectedSection] = useState<string>(sections[0].id);
  const [siteName, setSiteName] = useState("My ScrollCraft Site");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const isDemo = initialIsDemo;
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hi! I can edit your site for you. Try: \"Make it purple\", \"Center the text\", \"Change the heading to...\"" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [customHead, setCustomHead] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [mobileFrames, setMobileFrames] = useState<string[]>([]);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioFileRef = useRef<HTMLInputElement>(null);

  useScrollAudio({ audioSrc, scrollEl: previewScrollRef, muted: audioMuted });

  // Load mobile frames from sessionStorage if the create page generated them
  useEffect(() => {
    const hasMobile = searchParams.get("hasMobileFrames") === "1";
    if (!hasMobile) return;
    try {
      const stored = sessionStorage.getItem("scrollcraft_mobile_frames");
      if (stored) setMobileFrames(JSON.parse(stored));
    } catch { /* sessionStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show demo toast once on mount — side-effect only, no state mutation
  useEffect(() => {
    if (initialIsDemo) {
      toast.info("Running in demo mode — add your API key for real AI video generation");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSectionData = sections.find(s => s.id === selectedSection);

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addSection = () => {
    const newSection = defaultSection(sections.length);
    setSections(prev => [...prev, newSection]);
    setSelectedSection(newSection.id);
  };

  const removeSection = (id: string) => {
    if (sections.length === 1) { toast.error("Need at least one section"); return; }
    if (pendingDeleteId !== id) { setPendingDeleteId(id); return; }
    setPendingDeleteId(null);
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedSection === id) setSelectedSection(sections.find(s => s.id !== id)!.id);
  };

  const moveSection = (id: string, dir: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sections.length - 1) return;
    const newSections = [...sections];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swap]] = [newSections[swap], newSections[idx]];
    setSections(newSections);
  };

  const handleExport = async () => {
    if (isDemo) {
      toast.error("Can't export demo frames — generate real frames first");
      return;
    }
    setIsExporting(true);
    try {
      const res = await fetch("/api/export-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, mobileFrames: mobileFrames.length ? mobileFrames : undefined, audioSrc: audioSrc ?? undefined, sections, siteName, fps, customHead, customCss }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${siteName.replace(/\s+/g, "-").toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Site exported! Extract and serve with `npx serve .`");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const totalScrollHeight = sections.filter(s => s.visible).reduce((a, s) => a + s.scrollHeight, 0) + 1000;

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatMessages(m => [...m, { role: "user", text }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sections, selectedSectionId: selectedSection }),
      });
      const data = await res.json();
      if (data.updates?.length) {
        setSections(prev => prev.map(s => {
          const updates = data.updates.filter((u: { id: string }) => u.id === s.id);
          if (!updates.length) return s;
          return updates.reduce((acc: Section, u: { field: string; value: string | number }) => ({ ...acc, [u.field]: u.value }), s);
        }));
      }
      setChatMessages(m => [...m, { role: "ai", text: data.message || "Done!" }]);
    } catch {
      setChatMessages(m => [...m, { role: "ai", text: "Something went wrong. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/create" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="h-7 bg-transparent border-transparent hover:border-white/10 focus:border-primary/50 text-sm font-medium w-48"
          />
          {isDemo && <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">Demo mode</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Audio mute toggle — only show when audio is loaded */}
          {audioSrc && (
            <button
              onClick={() => setAudioMuted(m => !m)}
              title={audioMuted ? "Unmute audio" : "Mute audio"}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
            </button>
          )}
          {/* Viewport toggle */}
          <div className="flex items-center bg-white/5 rounded-md p-0.5 gap-0.5">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewportMode(mode)}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                className={`p-1 rounded transition-colors ${viewportMode === mode ? "bg-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded">
            Frame {currentFrame + 1}/{frameCount}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatOpen(o => !o)}
            className={`border-white/10 h-7 px-2 text-xs gap-1.5 ${chatOpen ? "border-primary/50 text-primary" : ""}`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> AI Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(p => !p)}
            className="border-white/10 h-7 px-2 text-xs"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="bg-primary hover:bg-primary/90 text-white h-7 px-3 text-xs font-semibold"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: sections list */}
        <div className="w-56 border-r border-white/5 flex flex-col bg-card/30 flex-shrink-0">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="w-3.5 h-3.5 text-primary" /> Sections
            </div>
            <Button onClick={addSection} size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-primary/20">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sections.map((s, i) => (
              <div
                key={s.id}
                onClick={() => setSelectedSection(s.id)}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSection === s.id ? "bg-primary/15 border border-primary/30" : "hover:bg-white/5"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.visible ? "bg-primary" : "bg-white/20"}`} />
                <span className="text-xs flex-1 truncate">{s.heading || `Section ${i + 1}`}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "up"); }} className="p-0.5 hover:text-primary">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "down"); }} className="p-0.5 hover:text-primary">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSection(s.id); }}
                    onBlur={() => setPendingDeleteId(null)}
                    className={`p-0.5 transition-colors ${pendingDeleteId === s.id ? "text-destructive font-bold" : "hover:text-destructive"}`}
                    title={pendingDeleteId === s.id ? "Click again to confirm delete" : "Delete section"}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: preview canvas */}
        {showPreview && (
          <div className="flex-1 relative overflow-hidden bg-black/20 flex items-center justify-center">
            {frames.length > 0 && (
              <div
                ref={previewScrollRef}
                style={{
                  height: totalScrollHeight,
                  overflowY: "scroll",
                  ...(viewportMode === "mobile"
                    ? { width: 390, maxHeight: "85vh", position: "relative", borderRadius: 24, border: "2px solid rgba(255,255,255,0.1)", overflow: "hidden" }
                    : viewportMode === "tablet"
                    ? { width: 768, maxHeight: "85vh", position: "relative", borderRadius: 16, border: "2px solid rgba(255,255,255,0.1)", overflow: "hidden" }
                    : { position: "absolute", inset: 0 }),
                }}
              >
                <ScrollEngine
                  frames={frames}
                  mobileFrames={mobileFrames.length ? mobileFrames : undefined}
                  totalScrollHeight={totalScrollHeight}
                  onFrameChange={setCurrentFrame}
                  scrollContainer={previewScrollRef}
                />
                {/* Section overlays */}
                <div className="relative z-10" style={{ height: totalScrollHeight }}>
                  <div style={{ height: "100vh" }} />
                  {sections.filter(s => s.visible).map((s) => (
                    <ScrollSection
                      key={s.id}
                      onClick={() => setSelectedSection(s.id)}
                      style={{
                        height: s.scrollHeight,
                        display: "flex",
                        alignItems: s.align || "center",
                        justifyContent: s.justify || "center",
                        cursor: "pointer",
                        outline: selectedSection === s.id ? "1px solid rgba(124,58,237,0.5)" : "none",
                      }}
                    >
                      <div style={{ textAlign: s.textAlign, padding: "2rem", maxWidth: "700px" }}>
                        {s.eyebrow && (
                          <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: s.accentColor, marginBottom: "0.5rem" }}>
                            {s.eyebrow}
                          </p>
                        )}
                        {s.heading && (
                          <h2 style={{ fontSize: "clamp(1.5rem,4vw,3.5rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", color: s.headingColor, marginBottom: "0.75rem" }}>
                            {s.heading}
                          </h2>
                        )}
                        {s.body && (
                          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: s.bodyColor, marginBottom: "1rem" }}>
                            {s.body}
                          </p>
                        )}
                        {s.ctaLabel && (
                          <span style={{ display: "inline-block", background: s.accentColor, color: "white", padding: "0.625rem 1.5rem", borderRadius: "0.375rem", fontWeight: 600, fontSize: "0.875rem" }}>
                            {s.ctaLabel}
                          </span>
                        )}
                      </div>
                    </ScrollSection>
                  ))}
                </div>
              </div>
            )}
            {frames.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-72 border-l border-white/5 flex flex-col bg-card/30 flex-shrink-0">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="w-3.5 h-3.5 text-primary" /> AI Editor
              </div>
              <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${msg.role === "ai" ? "bg-primary/20 text-primary" : "bg-white/10 text-foreground"}`}>
                    {msg.role === "ai" ? <Sparkles className="w-3 h-3" /> : "U"}
                  </div>
                  <div className={`max-w-[200px] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === "ai" ? "bg-white/5 text-foreground" : "bg-primary/20 text-foreground"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <div className="bg-white/5 rounded-xl px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Make it purple..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-7 h-7 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <Send className="w-3 h-3 text-white" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Powered by Claude AI
              </p>
            </div>
          </div>
        )}

        {/* Right panel: section editor */}
        {selectedSectionData && (
          <div className="w-72 border-l border-white/5 flex flex-col bg-card/30 flex-shrink-0 overflow-y-auto">
            <Tabs defaultValue="content">
              <div className="p-3 border-b border-white/5">
                <TabsList className="w-full h-8 bg-white/5">
                  <TabsTrigger value="content" className="flex-1 text-xs h-6">
                    <Type className="w-3 h-3 mr-1" /> Content
                  </TabsTrigger>
                  <TabsTrigger value="style" className="flex-1 text-xs h-6">
                    <Sparkles className="w-3 h-3 mr-1" /> Style
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="flex-1 text-xs h-6">
                    <Settings className="w-3 h-3 mr-1" /> Layout
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="flex-1 text-xs h-6">
                    <Music className="w-3 h-3 mr-1" /> Audio
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex-1 text-xs h-6">
                    &lt;/&gt; Code
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="content" className="p-3 space-y-3 mt-0">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Eyebrow text</label>
                  <Input
                    value={selectedSectionData.eyebrow}
                    onChange={(e) => updateSection(selectedSectionData.id, { eyebrow: e.target.value })}
                    placeholder="NEW FEATURE"
                    className="h-7 bg-white/5 border-white/10 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Heading</label>
                  <Textarea
                    value={selectedSectionData.heading}
                    onChange={(e) => updateSection(selectedSectionData.id, { heading: e.target.value })}
                    placeholder="Your powerful headline"
                    className="bg-white/5 border-white/10 text-sm resize-none min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Body text</label>
                  <Textarea
                    value={selectedSectionData.body}
                    onChange={(e) => updateSection(selectedSectionData.id, { body: e.target.value })}
                    placeholder="Supporting description..."
                    className="bg-white/5 border-white/10 text-xs resize-none min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">CTA label</label>
                    <Input
                      value={selectedSectionData.ctaLabel}
                      onChange={(e) => updateSection(selectedSectionData.id, { ctaLabel: e.target.value })}
                      placeholder="Get started"
                      className="h-7 bg-white/5 border-white/10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">CTA link</label>
                    <Input
                      value={selectedSectionData.ctaHref}
                      onChange={(e) => updateSection(selectedSectionData.id, { ctaHref: e.target.value })}
                      placeholder="#"
                      className="h-7 bg-white/5 border-white/10 text-xs"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="style" className="p-3 space-y-3 mt-0">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Accent color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={selectedSectionData.accentColor} onChange={(e) => updateSection(selectedSectionData.id, { accentColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input value={selectedSectionData.accentColor} onChange={(e) => updateSection(selectedSectionData.id, { accentColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Heading color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={selectedSectionData.headingColor} onChange={(e) => updateSection(selectedSectionData.id, { headingColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input value={selectedSectionData.headingColor} onChange={(e) => updateSection(selectedSectionData.id, { headingColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Body color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={selectedSectionData.bodyColor.startsWith("rgba") ? "#b3b3b3" : selectedSectionData.bodyColor} onChange={(e) => updateSection(selectedSectionData.id, { bodyColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input value={selectedSectionData.bodyColor} onChange={(e) => updateSection(selectedSectionData.id, { bodyColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Text alignment</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map(a => (
                      <button key={a} onClick={() => updateSection(selectedSectionData.id, { textAlign: a })}
                        className={`flex-1 h-7 rounded border text-xs flex items-center justify-center transition-colors ${selectedSectionData.textAlign === a ? "border-primary bg-primary/15 text-primary" : "border-white/10 hover:border-white/20"}`}
                      >
                        {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Visible</label>
                  <button
                    onClick={() => updateSection(selectedSectionData.id, { visible: !selectedSectionData.visible })}
                    className={`w-8 h-4 rounded-full transition-colors ${selectedSectionData.visible ? "bg-primary" : "bg-white/20"}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${selectedSectionData.visible ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="layout" className="p-3 space-y-3 mt-0">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Section height (scroll px)</label>
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">{selectedSectionData.scrollHeight}px</Badge>
                  </div>
                  <Slider
                    value={[selectedSectionData.scrollHeight]}
                    onValueChange={(v) => updateSection(selectedSectionData.id, { scrollHeight: Array.isArray(v) ? (v as number[])[0] : v as number })}
                    min={300} max={3000} step={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Vertical position</label>
                  <div className="flex gap-1">
                    {["flex-start", "center", "flex-end"].map((a) => (
                      <button key={a} onClick={() => updateSection(selectedSectionData.id, { align: a })}
                        className={`flex-1 h-7 rounded border text-xs transition-colors ${selectedSectionData.align === a ? "border-primary bg-primary/15 text-primary" : "border-white/10 hover:border-white/20"}`}
                      >
                        {a === "flex-start" ? "Top" : a === "center" ? "Middle" : "Bottom"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Horizontal position</label>
                  <div className="flex gap-1">
                    {["flex-start", "center", "flex-end"].map((a) => (
                      <button key={a} onClick={() => updateSection(selectedSectionData.id, { justify: a })}
                        className={`flex-1 h-7 rounded border text-xs transition-colors ${selectedSectionData.justify === a ? "border-primary bg-primary/15 text-primary" : "border-white/10 hover:border-white/20"}`}
                      >
                        {a === "flex-start" ? "Left" : a === "center" ? "Center" : "Right"}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audio" className="p-3 space-y-4 mt-0">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Background audio</label>
                  <p className="text-xs text-muted-foreground/70">Volume fades in on scroll, fades out when idle</p>
                  <button
                    onClick={() => audioFileRef.current?.click()}
                    className={`w-full p-3 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center gap-1.5 text-xs ${audioSrc ? "border-primary/40 bg-primary/5 text-primary" : "border-white/15 hover:border-primary/30 text-muted-foreground"}`}
                  >
                    <Music className="w-5 h-5" />
                    {audioSrc ? "Audio loaded — scroll to play" : "Upload MP3 / WAV"}
                  </button>
                  <input
                    ref={audioFileRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setAudioSrc(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {audioSrc && (
                    <button
                      onClick={() => { setAudioSrc(null); if (audioFileRef.current) audioFileRef.current.value = ""; }}
                      className="w-full h-7 rounded border border-white/10 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                    >
                      Remove audio
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground/60 space-y-1">
                  <p>• Audio plays when you scroll in the preview</p>
                  <p>• Exported site includes the audio file</p>
                  <p>• Use ambient loops for best results</p>
                </div>
              </TabsContent>

              <TabsContent value="code" className="p-3 space-y-4 mt-0">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Custom &lt;head&gt; HTML</label>
                  <p className="text-xs text-muted-foreground/70">Inject analytics, fonts, or meta tags into &lt;head&gt;</p>
                  <Textarea
                    value={customHead}
                    onChange={(e) => setCustomHead(e.target.value)}
                    placeholder={'<!-- e.g. Google Analytics, custom meta -->\n<script async src="..."></script>'}
                    className="min-h-[100px] font-mono text-xs bg-black/30 border-white/10 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Custom CSS</label>
                  <p className="text-xs text-muted-foreground/70">Extra styles injected after the default stylesheet</p>
                  <Textarea
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder={".scroll-section { ... }\n.section-content { ... }"}
                    className="min-h-[100px] font-mono text-xs bg-black/30 border-white/10 resize-none"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
