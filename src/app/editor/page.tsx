"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { loadFrames, storeFrames } from "@/lib/frameStorage";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Download, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
  Sparkles, Layers, Settings, Type, Loader2, AlignLeft, AlignCenter, AlignRight,
  Monitor, Tablet, Smartphone, Music, Volume2, VolumeX, Save,
  Undo2, Redo2, Copy
} from "lucide-react";
import { useScrollAudio } from "@/lib/useScrollAudio";
import Link from "next/link";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { siteStyleSchema, themeSchema, type EditorSection, type SiteStyle, type Theme } from "@/lib/siteSchema";
import { templateBySlug } from "@/lib/templates";
import { generate2DFrames } from "@/lib/generate2DFrames";

const ScrollEngine = dynamic(() => import("@/components/ScrollEngine"), { ssr: false });
const ScrollSection = dynamic(() => import("@/components/ScrollSection"), { ssr: false });

type Section = EditorSection;

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

  // Derive initial frame state. Frames live in IndexedDB (primary) with sessionStorage as a
  // legacy fallback for any in-flight sessions created before this change.
  const pickedTemplate = templateBySlug(searchParams.get("template") ?? "");
  // A template arrives as a finished site: its sections become the starting document,
  // with the ids the editor needs to track selection and undo.
  const templateSections = pickedTemplate
    ? pickedTemplate.sections.map((s, i) => ({
        ...defaultSection(i),
        ...s,
        id: `section-${i}-${pickedTemplate.slug}`,
        heading: s.heading ?? "",
        eyebrow: s.eyebrow ?? "",
        body: s.body ?? "",
        ctaLabel: s.ctaLabel ?? "",
        ctaHref: s.ctaHref ?? "#",
        accentColor: s.accentColor ?? pickedTemplate.theme.accentText ?? "#ede9fe",
        headingColor: s.headingColor ?? pickedTemplate.theme.ink ?? "#ffffff",
        bodyColor: s.bodyColor ?? pickedTemplate.theme.muted ?? "rgba(255,255,255,0.7)",
        scrollHeight: s.scrollHeight ?? 1000,
        visible: true,
      }))
    : null;

  const framesKey = searchParams.get("framesKey");
  const styleParam = searchParams.get("style");
  const colorParams = [searchParams.get("c1"), searchParams.get("c2"), searchParams.get("c3")];
  const framesParam = searchParams.get("frames"); // legacy URL param
  const countParam = searchParams.get("frameCount");
  const fpsParam = searchParams.get("fps");

  // Synchronous fast path: check legacy sessionStorage only (may be empty for new sessions)
  const parsedFrames: string[] | null = (() => {
    if (framesParam) {
      try {
        const decoded = JSON.parse(framesParam);
        return Array.isArray(decoded) && decoded.every((f) => typeof f === "string") ? decoded : null;
      } catch { return null; }
    }
    return null;
  })();

  const DEMO_COUNT = 120;
  const demoFrameUrls = Array.from({ length: DEMO_COUNT }, (_, i) => `/api/demo-frame?i=${i}&total=${DEMO_COUNT}`);
  const initialIsDemo = !parsedFrames && !framesKey;

  const [frames, setFrames] = useState<string[]>(parsedFrames ?? demoFrameUrls);
  const [frameCount, setFrameCount] = useState(parsedFrames ? parseInt(countParam || String(parsedFrames.length)) : DEMO_COUNT);
  const [fps, setFps] = useState(parsedFrames ? parseInt(fpsParam || "24") : 24);
  const [sections, setSections] = useState<Section[]>(() => templateSections ?? [defaultSection(0)]);
  const [selectedSection, setSelectedSection] = useState<string>(sections[0].id);
  // Named after the preset or upload it came from, so a generated site does not
  // arrive here as an anonymous "My ScrollCraft Site".
  const [siteName, setSiteName] = useState(
    () => searchParams.get("name")?.slice(0, 80) || pickedTemplate?.name || "My ScrollCraft Site"
  );
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const handleFrameChange = useCallback((i: number) => {
    if (frameLabelRef.current) {
      frameLabelRef.current.textContent = `Frame ${i + 1}/${frameCount}`;
    }
  }, [frameCount]);
  const [showPreview, setShowPreview] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  // A ZIP export runs for tens of seconds — a template fetch, a sequential fetch per
  // frame, then compression — behind a single spinner. Name the current stage so the
  // wait reads as progress rather than a hang.
  const [exportStage, setExportStage] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(initialIsDemo);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [customHead, setCustomHead] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [mobileFrames, setMobileFrames] = useState<string[]>([]);
  // Load mobile frames from IndexedDB (too large for sessionStorage's 5 MB quota)
  useEffect(() => {
    if (searchParams.get("hasMobileFrames") !== "1") return;
    loadFrames("scrollcraft_mobile_frames").then((f) => {
      if (f && f.length) setMobileFrames(f);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // The device simulator sizes its scroll port to the emulated device, but the overlays
  // inside it were pinned to 100vh — the browser window — so in mobile/tablet every
  // section was taller than the frame it sat in and the preview drifted out of step with
  // the published result. Measure the port instead.
  const [previewViewportH, setPreviewViewportH] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(searchParams.get("siteId"));
  // Background recipe and theme travel with the site so the published page and the export
  // can recompile them; frames themselves never reach the server.
  const [styleSpec, setStyleSpec] = useState<SiteStyle | null>(() => {
    if (pickedTemplate) return { style: pickedTemplate.style, colors: pickedTemplate.colors };
    const parsedStyle = siteStyleSchema.safeParse({ style: styleParam, colors: colorParams });
    return parsedStyle.success ? parsedStyle.data : null;
  });
  const [siteTheme, setSiteTheme] = useState<Theme | null>(() =>
    pickedTemplate ? themeSchema.parse(pickedTemplate.theme) : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;
    const measure = () => setPreviewViewportH(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPreview, viewportMode]);

  // Load desktop frames from IndexedDB (primary store; sessionStorage was too small at 5 MB)
  useEffect(() => {
    if (!framesKey || parsedFrames) return;
    loadFrames(framesKey).then((f) => {
      if (f && f.length) {
        setFrames(f);
        setFrameCount(f.length);
        setIsDemo(false);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // "Use this template" arrives with sections but no frames; render the template's own
  // background instead of leaving the demo one underneath it.
  const templateGenStarted = useRef(false);
  useEffect(() => {
    if (!pickedTemplate || parsedFrames || framesKey || searchParams.get("siteId")) return;
    if (templateGenStarted.current) return;
    templateGenStarted.current = true;
    const isMobileViewport = window.innerWidth < 768;
    generate2DFrames({
      style: pickedTemplate.style,
      color1: pickedTemplate.colors[0],
      color2: pickedTemplate.colors[1],
      color3: pickedTemplate.colors[2],
      frameCount: isMobileViewport ? 60 : 90,
      width: isMobileViewport ? 640 : 1280,
      height: isMobileViewport ? 360 : 720,
    }, () => {}).then((generated) => {
      setFrames(generated);
      setFrameCount(generated.length);
      setIsDemo(false);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // showPreview/viewportMode remount the preview container, replacing the element the
  // scroll listener is bound to.
  useScrollAudio({
    audioSrc,
    scrollEl: previewScrollRef,
    muted: audioMuted,
    rebindKey: `${showPreview}:${viewportMode}:${frames.length > 0}`,
  });


  // Hydrate a saved site from the DB when opened with ?siteId= and no frames in the URL.
  // This makes saved sites re-editable and lets users return after a Lemon Squeezy
  // export purchase (they land back here via the checkout redirect).
  const [hydrating, setHydrating] = useState(() => !!searchParams.get("siteId") && !parsedFrames);
  useEffect(() => {
    const sid = searchParams.get("siteId");
    if (!sid || parsedFrames) return; // fresh-from-generation flow already has frames
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sites/${sid}`);
        if (!res.ok) {
          if (!cancelled) toast.error("Couldn't load that site. It may have been deleted.");
          return;
        }
        const { site } = await res.json();
        if (cancelled || !site) return;
        // A persisted site is never a demo, even if its frames can't be resolved on this
        // device — the demo lock is only for browser-generated placeholder frames, and
        // leaving it on here made a real site refuse to Save or Export.
        setIsDemo(false);
        // Load frames from IndexedDB (primary). Fall back to DB framesJson for old sites.
        // Guard the read: an IndexedDB rejection must not throw past the rest of the
        // hydration, which would discard the sections, name, and theme already fetched.
        const storedFrames = await loadFrames(`scrollcraft_frames_${sid}`).catch(() => null);
        const storedMobile = await loadFrames(`scrollcraft_mframes_${sid}`).catch(() => null);
        let framesResolved = false;
        if (storedFrames && storedFrames.length) {
          setFrames(storedFrames); setFrameCount(storedFrames.length); setIsDemo(false);
          if (storedMobile && storedMobile.length) setMobileFrames(storedMobile);
          framesResolved = true;
        } else if (site.framesJson) {
          const f = JSON.parse(site.framesJson);
          if (Array.isArray(f) && f.length) { setFrames(f); setFrameCount(f.length); setIsDemo(false); framesResolved = true; }
        }
        // Opened on a second device: the IndexedDB frames live in the other browser, but a
        // stored style recipe lets us regenerate the background instead of leaving the demo.
        if (!framesResolved && site.styleJson) {
          const recipe = siteStyleSchema.safeParse(JSON.parse(site.styleJson));
          if (recipe.success) {
            const mob = window.innerWidth < 768;
            const regen = await generate2DFrames({
              style: recipe.data.style,
              color1: recipe.data.colors[0], color2: recipe.data.colors[1], color3: recipe.data.colors[2],
              frameCount: mob ? 60 : 90, width: mob ? 640 : 1280, height: mob ? 360 : 720,
            }, () => {}).catch(() => null);
            if (!cancelled && regen && regen.length) {
              setFrames(regen); setFrameCount(regen.length); setIsDemo(false);
              storeFrames(`scrollcraft_frames_${sid}`, regen).catch(() => {});
            }
          }
        }
        if (site.sectionsJson) {
          const s = JSON.parse(site.sectionsJson);
          if (Array.isArray(s) && s.length) {
            setSections(s);
            setSelectedSection(s[0].id);
          }
        }
        if (typeof site.fps === "number") setFps(site.fps);
        if (site.name) setSiteName(site.name);
        if (site.customHead) setCustomHead(site.customHead);
        if (site.themeJson) {
          const parsedTheme = themeSchema.safeParse(JSON.parse(site.themeJson));
          if (parsedTheme.success) setSiteTheme(parsedTheme.data);
        }
        if (site.styleJson) {
          const parsedStyle = siteStyleSchema.safeParse(JSON.parse(site.styleJson));
          if (parsedStyle.success) setStyleSpec(parsedStyle.data);
        }
        if (site.customCss) setCustomCss(site.customCss);
        if (site.audioUrl) setAudioSrc(site.audioUrl);
        if (searchParams.get("purchased") === "1") {
          toast.success("Export unlocked! Click Export to download your ZIP.");
        }
      } catch {
        if (!cancelled) toast.error("Couldn't load that site. Please try again.");
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show demo toast once on mount — but not when reopening a saved site (it hydrates async)
  useEffect(() => {
    if (initialIsDemo && !searchParams.get("siteId")) {
      toast.info("Running in demo mode — add your API key for real AI video generation");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSectionData = sections.find(s => s.id === selectedSection);

  // ── Undo / redo history ──────────────────────────────────────────────
  // sectionsRef always mirrors the latest sections so async callers (AI chat)
  // and history snapshots never read a stale value.
  const sectionsRef = useRef(sections);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  const undoStack = useRef<Section[][]>([]);
  const redoStack = useRef<Section[][]>([]);
  const lastEditKey = useRef<{ key: string; t: number } | null>(null);
  // canUndo/canRedo are state (not derived from refs during render) so the
  // toolbar buttons re-render correctly without reading refs at render time.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Bumped on every content edit. A save captures this at its start and only clears the
  // dirty flag if it is unchanged when the request resolves — otherwise edits the user
  // made while the save was in flight would be silently marked as saved.
  const editGenRef = useRef(0);
  useEffect(() => { editGenRef.current += 1; }, [sections, siteName, customHead, customCss]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  // Apply a section mutation while recording an undo snapshot. Consecutive edits
  // sharing the same historyKey within 800ms coalesce into one undo step (so
  // typing a heading is a single undo, not one-per-keystroke).
  const commitSections = useCallback((updater: (prev: Section[]) => Section[], historyKey?: string) => {
    const baseline = sectionsRef.current;
    const next = updater(baseline);
    const now = Date.now();
    const coalesce = !!historyKey
      && lastEditKey.current?.key === historyKey
      && now - (lastEditKey.current?.t ?? 0) < 800;
    if (!coalesce) {
      undoStack.current.push(baseline);
      if (undoStack.current.length > 100) undoStack.current.shift();
    }
    lastEditKey.current = historyKey ? { key: historyKey, t: now } : null;
    redoStack.current = [];
    setSections(next);
    setDirty(true);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(sectionsRef.current);
    const prev = undoStack.current.pop()!;
    lastEditKey.current = null;
    setSections(prev);
    setDirty(true);
    setSelectedSection(sel => prev.some(s => s.id === sel) ? sel : prev[0]?.id ?? sel);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(sectionsRef.current);
    const next = redoStack.current.pop()!;
    lastEditKey.current = null;
    setSections(next);
    setDirty(true);
    setSelectedSection(sel => next.some(s => s.id === sel) ? sel : next[0]?.id ?? sel);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const updateSection = (id: string, updates: Partial<Section>) => {
    commitSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s), `${id}:${Object.keys(updates).join(",")}`);
  };

  const addSection = () => {
    const newSection = defaultSection(sections.length);
    commitSections(prev => [...prev, newSection]);
    setSelectedSection(newSection.id);
  };

  const duplicateSection = (id: string) => {
    const src = sectionsRef.current.find(s => s.id === id);
    if (!src) return;
    const copy: Section = { ...src, id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, heading: src.heading ? `${src.heading} (copy)` : src.heading };
    commitSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedSection(copy.id);
  };

  const removeSection = (id: string) => {
    if (sections.length === 1) { toast.error("Need at least one section"); return; }
    if (pendingDeleteId !== id) { setPendingDeleteId(id); return; }
    setPendingDeleteId(null);
    commitSections(prev => prev.filter(s => s.id !== id));
    if (selectedSection === id) setSelectedSection(sections.find(s => s.id !== id)!.id);
  };

  const moveSection = (id: string, dir: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sections.length - 1) return;
    commitSections(prev => {
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleExport = async () => {
    if (isDemo) {
      toast.error("Can't export demo frames — generate real frames first");
      return;
    }
    setIsExporting(true);
    try {
      // A purchase must be tied to a saved site, and a purchased export is rebuilt
      // server-side from that site's stored content — so save first, or unsaved edits
      // are silently dropped from the ZIP. A failed save is not fatal on its own:
      // paid plans export straight from the editor's own content, so only fall back
      // to the last known site id and warn.
      const savedSiteId = await handleSave({ silent: true });
      const effectiveSiteId = savedSiteId ?? siteId;
      if (!effectiveSiteId) {
        toast.error("Couldn't save your site — sign in and try again.");
        return;
      }
      if (!savedSiteId) {
        toast.warning("Couldn't save your latest edits — exporting the last saved version.");
      }

      // Resolve audio for the ZIP. Only data: URIs used to qualify, so a track stored
      // as a remote URL — which is the only form that survives a save, since a
      // multi-megabyte data: URI is never persisted — silently exported with no audio
      // at all: no audio/ folder, no mute button, and no warning.
      let hasAudio = false;
      let audioMime = "audio/mpeg";
      let audioBase64 = "";
      if (typeof audioSrc === "string" && audioSrc) {
        const dataUri = audioSrc.match(/^data:(audio\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (dataUri) {
          hasAudio = true;
          audioMime = dataUri[1];
          audioBase64 = dataUri[2];
        } else if (/^https?:\/\//i.test(audioSrc) || audioSrc.startsWith("/")) {
          try {
            const audioRes = await fetch(audioSrc);
            if (!audioRes.ok) throw new Error(String(audioRes.status));
            const blob = await audioRes.blob();
            audioMime = blob.type || "audio/mpeg";
            audioBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            hasAudio = audioBase64.length > 0;
          } catch {
            toast.warning("Couldn't fetch your audio track — exporting without it.");
          }
        }
      }

      // Ask the server to validate auth + purchase + generate the HTML template.
      // Frames are NOT sent — they stay on the client to avoid Vercel's 4.5 MB limit.
      const res = await fetch("/api/export-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections,
          siteName,
          fps,
          customHead,
          customCss,
          siteId: effectiveSiteId,
          frameCount: frames.length,
          mobileFrameCount: mobileFrames.length,
          hasAudio,
          audioMime,
        }),
      });

      if (res.status === 402) {
        const checkoutRes = await fetch("/api/payments/ls-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: effectiveSiteId }),
        });
        const checkoutData = await checkoutRes.json().catch(() => ({}));
        if (checkoutData.alreadyPurchased) {
          toast.info("Purchase confirmed — preparing your download…");
          setIsExporting(false);
      setExportStage(null);
          return handleExport();
        }
        if (checkoutRes.status === 503) {
          toast.error("Paid exports aren't available right now. Try again later.");
          return;
        }
        if (!checkoutRes.ok || !checkoutData.checkoutUrl) {
          toast.error("Could not start checkout. Please try again.");
          return;
        }
        toast.info("Redirecting to secure checkout…");
        window.location.assign(checkoutData.checkoutUrl);
        return;
      }

      if (!res.ok) {
        const msg = await res.json().then((d) => d?.error).catch(() => null);
        throw new Error(msg || "Export failed. Please try again.");
      }
      const { html, audioExt } = await res.json();

      // Build ZIP entirely in the browser — no round-trip for large frame data. Load
      // JSZip on demand so it stays out of the editor's first-load bundle.
      setExportStage("Building ZIP…");
      toast.info("Building ZIP…");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      zip.file("index.html", html);

      // Ship Lenis inside the ZIP. index.html used to load it from jsDelivr with no
      // integrity hash, so a CDN compromise would have run arbitrary JS on every
      // exported customer site, and a network that blocks jsDelivr lost smooth
      // scrolling silently. Exports stay self-contained.
      try {
        const lenisRes = await fetch("/lenis.min.js");
        if (lenisRes.ok) zip.file("lenis.min.js", await lenisRes.text());
      } catch {
        // Non-fatal: the generated page feature-detects window.Lenis and falls back
        // to a native scroll listener.
      }

      zip.file("README.txt", `ScrollCraft Export\n==================\nGenerated by ScrollCraft (https://scrollcraft.app)\n\nTo use:\n1. Extract this zip\n2. Serve from a static file server (e.g. 'npx serve .')\n3. Open in browser and scroll!\n\nNote: The frames/ folder must be in the same directory as index.html.\nDo NOT open index.html directly from your filesystem — use a local server.\n`);

      const framesFolder = zip.folder("frames")!;
      for (let i = 0; i < frames.length; i++) {
        if (i % 10 === 0) {
          setExportStage(`Packing frames ${i + 1}/${frames.length}…`);
          // Yield so React can paint the updated label between fetches.
          await new Promise((r) => setTimeout(r, 0));
        }
        const src = frames[i];
        const name = `frame_${String(i).padStart(4, "0")}.jpg`;
        if (src.startsWith("data:image/")) {
          framesFolder.file(name, src.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, ""), { base64: true });
        } else {
          const r = await fetch(src);
          framesFolder.file(name, await r.arrayBuffer());
        }
      }

      if (mobileFrames.length) {
        const mobileFolder = zip.folder("frames-mobile")!;
        for (let i = 0; i < mobileFrames.length; i++) {
          if (i % 10 === 0) {
            setExportStage(`Packing mobile frames ${i + 1}/${mobileFrames.length}…`);
            await new Promise((r) => setTimeout(r, 0));
          }
          const src = mobileFrames[i];
          const name = `frame_${String(i).padStart(4, "0")}.jpg`;
          if (src.startsWith("data:image/")) {
            mobileFolder.file(name, src.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, ""), { base64: true });
          } else {
            const r = await fetch(src);
            mobileFolder.file(name, await r.arrayBuffer());
          }
        }
      }

      if (hasAudio && audioBase64) {
        zip.file(`audio/track.${audioExt}`, audioBase64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (m) => {
        setExportStage(`Compressing ${Math.round(m.percent)}%…`);
      });
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
      setExportStage(null);
    }
  };

  const handleSave = async (opts?: { silent?: boolean }): Promise<string | null> => {
    if (isDemo) {
      if (!opts?.silent) toast.error("Can't save demo — generate real frames first");
      return null;
    }
    setIsSaving(true);
    const genAtSave = editGenRef.current;
    try {
      // Frames are NOT sent to the server (would exceed Vercel's 4.5 MB limit).
      // They are stored in sessionStorage keyed by site ID after a successful save.
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: siteId ?? undefined,
          name: siteName,
          fps,
          frameCount,
          sectionsJson: JSON.stringify(sections),
          themeJson: siteTheme ? JSON.stringify(siteTheme) : undefined,
          styleJson: styleSpec ? JSON.stringify(styleSpec) : undefined,
          // Frame data never fits the request cap, but the video path's frames are blob
          // URLs, which do — and they are what lets that site publish.
          framesJson: frames.length && frames.every((f) => /^https?:\/\//i.test(f))
            ? JSON.stringify(frames)
            : undefined,
          customHead,
          customCss,
          // Uploaded audio is a multi-MB data: URI held on the client only — the API
          // stores a URL and rejects anything longer than 2000 chars, so sending it
          // would fail the whole save.
          audioUrl: audioSrc && !audioSrc.startsWith("data:") ? audioSrc : undefined,
        }),
      });
      if (res.status === 401) { toast.error("Sign in to save your site"); return null; }
      if (!res.ok) {
        const msg = await res.json().then((d) => d?.error).catch(() => null);
        throw new Error(msg || "Export failed. Please try again.");
      }
      const data = await res.json();
      const savedId = data.site.id as string;
      setSiteId(savedId);

      // Persist frames in IndexedDB so they survive navigation without hitting sessionStorage quota.
      const framesCached = await storeFrames(`scrollcraft_frames_${savedId}`, frames).then(() => true, () => false);
      if (mobileFrames.length) {
        await storeFrames(`scrollcraft_mframes_${savedId}`, mobileFrames).catch(() => {});
      }

      // Only clear dirty if nothing was edited while the request was in flight, so those
      // in-flight edits aren't lost from the unsaved-changes tracking.
      if (editGenRef.current === genAtSave) setDirty(false);
      if (!opts?.silent) {
        if (framesCached) toast.success("Site saved!");
        else toast.warning("Site saved. Frames couldn't be cached on this device — reopen here to re-cache them.");
      }
      return savedId;
    } catch {
      toast.error("Failed to save site");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const totalScrollHeight = sections.filter(s => s.visible).reduce((a, s) => a + s.scrollHeight, 0) + 1000;


  // handleSave/handleExport are re-created every render and read sections, frames
  // and siteName from their closure. The keydown listener below is registered once,
  // so it must reach them through a ref or it would act on a stale snapshot.
  const shortcutsRef = useRef({ undo, redo, handleSave, handleExport, isSaving, isExporting });
  useEffect(() => {
    shortcutsRef.current = { undo, redo, handleSave, handleExport, isSaving, isExporting };
  });

  // Keyboard shortcuts: ⌘Z undo, ⌘⇧Z / ⌘Y redo, ⌘S save, ⌘E export
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const el = e.target as HTMLElement | null;
      const editing = !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (editing) return; // let the browser's own undo/redo run in text fields
      const s = shortcutsRef.current;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
      } else if (key === "y") {
        e.preventDefault(); s.redo();
      } else if (key === "s") {
        e.preventDefault(); if (!s.isSaving) s.handleSave();
      } else if (key === "e") {
        e.preventDefault(); if (!s.isExporting) s.handleExport();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {hydrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center gap-3 bg-background/80 backdrop-blur-sm text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your site…
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2 border-b border-white/5 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            onClick={(e) => { if (dirty && !window.confirm("Discard unsaved changes and leave?")) e.preventDefault(); }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <Input
            value={siteName}
            onChange={(e) => { setSiteName(e.target.value); setDirty(true); }}
            className="h-7 bg-transparent border-transparent hover:border-white/10 focus:border-primary/50 text-sm font-medium w-48"
          />
          {dirty && <span title="Unsaved changes" className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
          {isDemo && <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">Demo mode</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / redo */}
          <div className="flex items-center bg-white/5 rounded-md p-0.5 gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
            <span ref={frameLabelRef}>Frame 1/{frameCount}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-label={showPreview ? "Hide preview" : "Show preview"}
            onClick={() => setShowPreview(p => !p)}
            className="border-white/10 h-7 px-2 text-xs"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="border-white/10 h-7 px-3 text-xs gap-1"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            title={exportStage ?? undefined}
            className="bg-primary hover:bg-primary/90 text-white h-7 px-3 text-xs font-semibold"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Export
          </Button>
          {isExporting && exportStage && (
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {exportStage}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-x-auto md:overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-2 space-y-1" data-lenis-prevent>
            {sections.map((s, i) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedSection === s.id}
                onClick={() => setSelectedSection(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSection(s.id); } }}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                  selectedSection === s.id ? "bg-primary/15 border border-primary/30" : "hover:bg-white/5"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.visible ? "bg-primary" : "bg-white/20"}`} />
                <span className="text-xs flex-1 truncate">{s.heading || `Section ${i + 1}`}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "up"); }} className="p-0.5 hover:text-primary" title="Move up">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveSection(s.id, "down"); }} className="p-0.5 hover:text-primary" title="Move down">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateSection(s.id); }} className="p-0.5 hover:text-primary" title="Duplicate section">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSection(s.id); }}
                    onBlur={() => setPendingDeleteId(null)}
                    className={`p-0.5 rounded transition-colors ${pendingDeleteId === s.id ? "bg-destructive text-white ring-1 ring-destructive" : "hover:text-destructive"}`}
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
                // Lenis is mounted app-wide and preventDefault()s every wheel event to
                // scroll the window, which has no scroll range here — without this the
                // preview cannot be scrubbed by wheel or trackpad at all.
                data-lenis-prevent
                style={{
                  // Desktop: fill parent absolutely and scroll the *content* inside, not the container itself.
                  // Mobile/tablet: fixed viewport size with overflow-y:scroll so the inner content scrolls.
                  ...(viewportMode === "mobile"
                    ? { width: 390, height: "85vh", position: "relative", borderRadius: 24, border: "2px solid rgba(255,255,255,0.1)", overflowY: "scroll" }
                    : viewportMode === "tablet"
                    ? { width: 768, height: "85vh", position: "relative", borderRadius: 16, border: "2px solid rgba(255,255,255,0.1)", overflowY: "scroll" }
                    : { position: "absolute", inset: 0, overflowY: "scroll" }),
                }}
              >
                <ScrollEngine
                  frames={frames}
                  mobileFrames={mobileFrames.length ? mobileFrames : undefined}
                  totalScrollHeight={totalScrollHeight}
                  onFrameChange={handleFrameChange}
                  scrollContainer={previewScrollRef}
                  position="absolute"
                  forceMobile={viewportMode === "mobile"}
                />
                {/* Section overlays */}
                <div className="relative z-10" style={{ height: totalScrollHeight }}>
                  <div style={{ height: previewViewportH || "100vh" }} />
                  {sections.filter(s => s.visible).map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedSection === s.id}
                      aria-label={`Select section ${s.heading || ""}`.trim()}
                      onClick={() => setSelectedSection(s.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSection(s.id); } }}
                      style={{
                        position: "relative",
                        height: s.scrollHeight,
                        cursor: "pointer",
                        outline: selectedSection === s.id ? "1px solid rgba(124,58,237,0.5)" : "none",
                      }}
                    >
                      {/* Sticky wrapper keeps content pinned in the viewport while the section's
                          scroll height is consumed — the canvas scrubs beneath it */}
                      <div style={{
                        position: "sticky",
                        top: 0,
                        height: previewViewportH || "100vh",
                        display: "flex",
                        alignItems: s.align || "center",
                        justifyContent: s.justify || "center",
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}>
                        <ScrollSection style={{ pointerEvents: "auto" }}>
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
                      </div>
                    </div>
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

        {/* Right panel: section editor */}
        {selectedSectionData && (
          <div className="w-72 border-l border-white/5 flex flex-col bg-card/30 flex-shrink-0 overflow-y-auto" data-lenis-prevent>
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
                    aria-label="Eyebrow text"
                    value={selectedSectionData.eyebrow}
                    onChange={(e) => updateSection(selectedSectionData.id, { eyebrow: e.target.value })}
                    placeholder="NEW FEATURE"
                    className="h-7 bg-white/5 border-white/10 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Heading</label>
                  <Textarea
                    aria-label="Heading"
                    value={selectedSectionData.heading}
                    onChange={(e) => updateSection(selectedSectionData.id, { heading: e.target.value })}
                    placeholder="Your powerful headline"
                    className="bg-white/5 border-white/10 text-sm resize-none min-h-[60px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Body text</label>
                  <Textarea
                    aria-label="Body text"
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
                      aria-label="CTA label"
                      value={selectedSectionData.ctaLabel}
                      onChange={(e) => updateSection(selectedSectionData.id, { ctaLabel: e.target.value })}
                      placeholder="Get started"
                      className="h-7 bg-white/5 border-white/10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">CTA link</label>
                    <Input
                      aria-label="CTA link"
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
                    <input aria-label="Accent color" type="color" value={selectedSectionData.accentColor} onChange={(e) => updateSection(selectedSectionData.id, { accentColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input aria-label="Accent color hex value" value={selectedSectionData.accentColor} onChange={(e) => updateSection(selectedSectionData.id, { accentColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Heading color</label>
                  <div className="flex items-center gap-2">
                    <input aria-label="Heading color" type="color" value={selectedSectionData.headingColor} onChange={(e) => updateSection(selectedSectionData.id, { headingColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input aria-label="Heading color hex value" value={selectedSectionData.headingColor} onChange={(e) => updateSection(selectedSectionData.id, { headingColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Body color</label>
                  <div className="flex items-center gap-2">
                    <input aria-label="Body color" type="color" value={selectedSectionData.bodyColor.startsWith("rgba") ? "#b3b3b3" : selectedSectionData.bodyColor} onChange={(e) => updateSection(selectedSectionData.id, { bodyColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                    <Input aria-label="Body color hex value" value={selectedSectionData.bodyColor} onChange={(e) => updateSection(selectedSectionData.id, { bodyColor: e.target.value })} className="flex-1 h-7 bg-white/5 border-white/10 text-xs font-mono" />
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
                    role="switch"
                    aria-checked={selectedSectionData.visible}
                    aria-label="Toggle section visibility"
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
                    aria-label="Section height in pixels"
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
                      const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
                      if (file.size > MAX_AUDIO_BYTES) {
                        toast.error("Audio file too large — please use a file under 8 MB.");
                        if (audioFileRef.current) audioFileRef.current.value = "";
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => setAudioSrc(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {audioSrc?.startsWith("data:") && (
                    // An uploaded track is a multi-megabyte data: URI, which is far past
                    // what the site record stores — it exports fine now but will not
                    // survive a reload, so say so instead of letting it vanish quietly.
                    <p className="text-[10px] leading-snug text-amber-400/80 px-0.5">
                      Uploaded audio stays in this session — export before reloading, or re-upload after.
                    </p>
                  )}
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
                    onChange={(e) => { setCustomHead(e.target.value); setDirty(true); }}
                    placeholder={'<!-- e.g. Google Analytics, custom meta -->\n<script async src="..."></script>'}
                    className="min-h-[100px] font-mono text-xs bg-black/30 border-white/10 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Custom CSS</label>
                  <p className="text-xs text-muted-foreground/70">Extra styles injected after the default stylesheet</p>
                  <Textarea
                    value={customCss}
                    onChange={(e) => { setCustomCss(e.target.value); setDirty(true); }}
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
      <RequireAuth>
        <EditorInner />
      </RequireAuth>
    </Suspense>
  );
}
