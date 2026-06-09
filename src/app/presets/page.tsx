"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Sparkles, Eye } from "lucide-react";

const CATEGORIES = [
  "All", "SaaS", "Agency", "E-commerce", "Mobile App", "Startup",
  "Developer Tool", "AI Platform", "Fintech", "Logistics",
  "Healthcare", "Education", "Gaming", "Real Estate", "Restaurant",
  "Creative", "Music", "Fitness",
];

const PRESETS = [
  // ── SaaS ───────────────────────────────────────────────────────────────────
  {
    name: "OrbitCRM",
    category: "SaaS",
    description: "Dark SaaS hero with floating UI elements",
    tags: ["Dark", "Tech", "Dashboard"],
    gradient: "from-violet-800 via-purple-900 to-violet-950",
    accent: "#a78bfa",
    prompt: "Cinematic flythrough of a dark futuristic digital dashboard. Glowing UI panels float in dark space. Purple and blue neon accents. Depth of field blur.",
  },
  {
    name: "SyncBase",
    category: "SaaS",
    description: "Productivity tool with clean minimal scroll",
    tags: ["Minimal", "Teal", "Productivity"],
    gradient: "from-emerald-800 via-teal-900 to-emerald-950",
    accent: "#34d399",
    prompt: "Abstract flowing data streams in deep space. Green and teal particle effects moving through darkness. Clean, technical, modern.",
  },
  {
    name: "PulseMetrics",
    category: "SaaS",
    description: "Real-time analytics platform with live data hero",
    tags: ["Analytics", "Cyan", "Live"],
    gradient: "from-cyan-700 via-sky-800 to-cyan-900",
    accent: "#67e8f9",
    prompt: "Abstract data visualization with glowing line charts and pulse waves in deep teal space. Real-time energy. Clean technical aesthetic.",
  },
  {
    name: "FlowDeploy",
    category: "SaaS",
    description: "CI/CD pipeline tool with kinetic flow aesthetic",
    tags: ["DevOps", "Green", "Pipeline"],
    gradient: "from-green-700 via-emerald-800 to-green-900",
    accent: "#86efac",
    prompt: "Abstract network of glowing green nodes and connections flowing like a river of light. Pipeline metaphor. Dark background, emerald glow.",
  },
  {
    name: "NexusHQ",
    category: "SaaS",
    description: "All-in-one workspace with warm collaborative energy",
    tags: ["Workspace", "Amber", "Bold"],
    gradient: "from-orange-700 via-amber-800 to-orange-950",
    accent: "#fb923c",
    prompt: "Abstract interconnected hexagonal grid in warm amber tones. Orbiting dots suggest collaboration and connectivity. Warm cinematic grade.",
  },
  {
    name: "VaultDB",
    category: "SaaS",
    description: "Database-as-a-service with secure fortress branding",
    tags: ["Database", "Indigo", "Secure"],
    gradient: "from-indigo-700 via-blue-800 to-indigo-950",
    accent: "#818cf8",
    prompt: "Abstract glowing data vault — layers of hexagonal shields illuminated in deep indigo. Secure, architectural, cinematic.",
  },

  // ── Agency ─────────────────────────────────────────────────────────────────
  {
    name: "Meridian",
    category: "Agency",
    description: "Premium agency portfolio with bold editorial scroll",
    tags: ["Dark", "Minimal", "Editorial"],
    gradient: "from-slate-700 via-slate-800 to-slate-900",
    accent: "#e2e8f0",
    prompt: "A slow cinematic pan through a modernist architecture interior. Concrete and glass. Dark, premium, editorial feel. Shallow depth of field.",
  },
  {
    name: "LuminaStudio",
    category: "Agency",
    description: "Creative studio with vivid bold photography",
    tags: ["Creative", "Bold", "Color"],
    gradient: "from-rose-700 via-pink-800 to-rose-900",
    accent: "#fb7185",
    prompt: "Abstract explosion of vibrant color pigments in slow motion. Paint in water. Cinematic macro. Bold, artistic, vivid.",
  },
  {
    name: "BlackAtlas",
    category: "Agency",
    description: "Global branding agency with monochrome elegance",
    tags: ["Monochrome", "Premium", "Global"],
    gradient: "from-gray-600 via-gray-700 to-gray-900",
    accent: "#9ca3af",
    prompt: "Slow pan over a black marble surface with subtle white veining. Premium material. Studio lighting. Monochrome luxury.",
  },
  {
    name: "Chromatic",
    category: "Agency",
    description: "Design-led agency with gradient-first visual identity",
    tags: ["Gradient", "Vibrant", "Design"],
    gradient: "from-violet-700 via-fuchsia-800 to-violet-900",
    accent: "#d8b4fe",
    prompt: "Slow morphing abstract color field — violet bleeds into fuchsia into deep purple. Liquid light. Cinematic color grade.",
  },

  // ── E-commerce ─────────────────────────────────────────────────────────────
  {
    name: "Shopnest",
    category: "E-commerce",
    description: "Luxury e-commerce with dramatic product reveal scroll",
    tags: ["Luxury", "Gold", "Product"],
    gradient: "from-amber-800 via-yellow-900 to-amber-950",
    accent: "#f59e0b",
    prompt: "Ultra slow macro product shot. Luxury leather texture in dramatic studio lighting. Black background, golden rim light. Commercial photography.",
  },
  {
    name: "AuraBeauty",
    category: "E-commerce",
    description: "Premium beauty brand with soft cinematic glow",
    tags: ["Beauty", "Soft", "Pink"],
    gradient: "from-pink-700 via-rose-800 to-pink-900",
    accent: "#f9a8d4",
    prompt: "Macro shot of soft pink rose petals with water droplets in dramatic studio lighting. Beauty brand aesthetic. Pastel luxury.",
  },
  {
    name: "NordGoods",
    category: "E-commerce",
    description: "Scandinavian minimalist goods with clean scroll",
    tags: ["Minimal", "Nordic", "Clean"],
    gradient: "from-slate-500 via-slate-700 to-slate-800",
    accent: "#cbd5e1",
    prompt: "Clean product photography on pure white surface. Minimal Scandinavian home goods. Perfect studio lighting. Stark, beautiful, editorial.",
  },
  {
    name: "VaultKicks",
    category: "E-commerce",
    description: "Sneaker marketplace with street-culture energy",
    tags: ["Street", "Bold", "Dynamic"],
    gradient: "from-orange-700 via-red-800 to-orange-950",
    accent: "#fdba74",
    prompt: "Cinematic slow-motion sneaker drop in warm studio light. Orange and amber tones. Dramatic product hero. Street culture energy.",
  },
  {
    name: "JewelBox",
    category: "E-commerce",
    description: "Fine jewellery store with faceted light effects",
    tags: ["Jewellery", "Luxury", "Sparkle"],
    gradient: "from-yellow-700 via-amber-800 to-yellow-950",
    accent: "#fcd34d",
    prompt: "Ultra macro shot of a diamond facet refracting rainbow light in slow motion. Dark background. Light splits into spectral rays. Luxury.",
  },

  // ── Mobile App ─────────────────────────────────────────────────────────────
  {
    name: "TripVault",
    category: "Mobile App",
    description: "Travel app showcase with destination flythrough",
    tags: ["Travel", "Sky Blue", "Immersive"],
    gradient: "from-sky-700 via-blue-800 to-indigo-900",
    accent: "#38bdf8",
    prompt: "Aerial cinematic flyover of turquoise tropical coastline at golden hour. Drone shot, warm colors, crystal water, lush green islands.",
  },
  {
    name: "DreamTrack",
    category: "Mobile App",
    description: "Sleep & wellness tracker with dreamy ambient visuals",
    tags: ["Wellness", "Purple", "Calm"],
    gradient: "from-purple-700 via-violet-800 to-purple-950",
    accent: "#c4b5fd",
    prompt: "Slow time-lapse of bioluminescent jellyfish drifting in deep purple ocean. Dreamy, calm, otherworldly. Ultra cinematic.",
  },
  {
    name: "SwiftPay",
    category: "Mobile App",
    description: "Instant payment app with electric speed branding",
    tags: ["Payments", "Green", "Fast"],
    gradient: "from-lime-700 via-green-800 to-lime-900",
    accent: "#bef264",
    prompt: "Abstract electric current flowing through neon green circuit pathways in dark space. Speed and precision. Fintech energy.",
  },
  {
    name: "FitPulse",
    category: "Mobile App",
    description: "Fitness tracking app with raw kinetic energy",
    tags: ["Fitness", "Red", "Energy"],
    gradient: "from-red-700 via-orange-800 to-red-950",
    accent: "#fca5a5",
    prompt: "Slow motion cinematic shot of fire embers and sparks flying upward against black. Intense energy, ambition, motion blur.",
  },

  // ── Startup ────────────────────────────────────────────────────────────────
  {
    name: "Mindloop",
    category: "Startup",
    description: "Newsletter platform with liquid-glass minimal UI",
    tags: ["Glass", "Mono", "Content"],
    gradient: "from-neutral-700 via-zinc-800 to-neutral-900",
    accent: "#a3a3a3",
    prompt: "Slow motion liquid glass surface with subtle refractions. Monochrome. Ultra minimal. Premium material render. Studio lighting.",
  },
  {
    name: "Launchpad",
    category: "Startup",
    description: "Bold launch page with rocket energy and bright accents",
    tags: ["Launch", "Yellow", "Bold"],
    gradient: "from-yellow-700 via-amber-800 to-yellow-950",
    accent: "#fde047",
    prompt: "Cinematic slow-motion rocket launch through amber clouds at dusk. Light bursts through cloud formations. Epic scale. Ignition energy.",
  },
  {
    name: "Zephyr",
    category: "Startup",
    description: "Web3 protocol with flowing abstract teal aesthetic",
    tags: ["Web3", "Teal", "Flow"],
    gradient: "from-teal-700 via-cyan-800 to-teal-950",
    accent: "#5eead4",
    prompt: "Abstract flowing teal aurora-like light ribbons moving in deep space. Ethereal, smooth, blockchain metaphor. Ultra cinematic.",
  },
  {
    name: "Beacon",
    category: "Startup",
    description: "Media and newsletter brand with editorial warmth",
    tags: ["Media", "Indigo", "Editorial"],
    gradient: "from-indigo-700 via-blue-800 to-indigo-950",
    accent: "#a5b4fc",
    prompt: "Soft focused light bokeh through glass. Indigo and blue. Editorial newspaper aesthetic. Premium print magazine feel.",
  },
  {
    name: "GreenShift",
    category: "Startup",
    description: "Climate tech startup with organic earthy visuals",
    tags: ["Climate", "Green", "Organic"],
    gradient: "from-green-700 via-lime-800 to-green-950",
    accent: "#86efac",
    prompt: "Time-lapse of lush green forest canopy from drone. Morning light through leaves. Organic, alive, hopeful. Climate-forward.",
  },

  // ── Developer Tool ──────────────────────────────────────────────────────────
  {
    name: "StackForge",
    category: "Developer Tool",
    description: "Dev tool landing with cinematic code-depth aesthetic",
    tags: ["Code", "Cyan", "Dark"],
    gradient: "from-zinc-700 via-zinc-800 to-zinc-900",
    accent: "#22d3ee",
    prompt: "Cinematic zoom through lines of glowing code on dark screens. Matrix-like but premium. Cyan and white light trails. Depth of field.",
  },
  {
    name: "AutoMachines",
    category: "Developer Tool",
    description: "Automation platform with geometric precision",
    tags: ["Automation", "Stone", "Geometric"],
    gradient: "from-stone-700 via-neutral-800 to-stone-900",
    accent: "#d4d4d4",
    prompt: "Cinematic shot of robotic assembly arms in dark factory. Sparks flying, precision motion. Industrial but premium. Slow motion.",
  },
  {
    name: "CodePilot",
    category: "Developer Tool",
    description: "AI coding assistant with neural-network hero",
    tags: ["AI", "Emerald", "Code"],
    gradient: "from-emerald-700 via-green-800 to-emerald-950",
    accent: "#6ee7b7",
    prompt: "Glowing green circuit board traces in macro. Deep focus. Neural network of connections. Premium developer aesthetic.",
  },
  {
    name: "Terminus",
    category: "Developer Tool",
    description: "Terminal and CLI tool with retro-modern identity",
    tags: ["Terminal", "Green", "Retro"],
    gradient: "from-green-800 via-emerald-900 to-green-950",
    accent: "#4ade80",
    prompt: "Green monochrome terminal text scrolling rapidly on black screen. CRT glow effect. Retro-computing meets modern precision.",
  },

  // ── AI Platform ─────────────────────────────────────────────────────────────
  {
    name: "VisionForge",
    category: "AI Platform",
    description: "AI platform with cinematic neural network visuals",
    tags: ["AI", "Fuchsia", "Neural"],
    gradient: "from-fuchsia-800 via-pink-900 to-fuchsia-950",
    accent: "#e879f9",
    prompt: "Abstract neural network visualization. Glowing nodes and connections in deep purple space. Data flowing between points. Ultra cinematic.",
  },
  {
    name: "Power AI",
    category: "AI Platform",
    description: "Full-screen dark hero with electric AI energy",
    tags: ["AI", "Indigo", "Bold"],
    gradient: "from-indigo-800 via-violet-900 to-indigo-950",
    accent: "#818cf8",
    prompt: "Abstract AI energy field. Electric indigo and violet light bursts in dark space. Powerful, dynamic, cinematic. Slow motion.",
  },
  {
    name: "Synthex",
    category: "AI Platform",
    description: "Generative AI platform with morphing abstract visuals",
    tags: ["Generative", "Purple", "Morph"],
    gradient: "from-violet-700 via-purple-800 to-violet-950",
    accent: "#c084fc",
    prompt: "Abstract morphing geometric shapes in violet. Smooth AI-generated transitions between forms. Generative art aesthetic.",
  },
  {
    name: "NeuralPath",
    category: "AI Platform",
    description: "AI research lab with deep science aesthetic",
    tags: ["Research", "Blue", "Science"],
    gradient: "from-blue-700 via-cyan-800 to-blue-950",
    accent: "#7dd3fc",
    prompt: "3D brain scan visualization with glowing cyan pathways. Medical imaging aesthetic. Data moving through neural pathways.",
  },
  {
    name: "Luminary",
    category: "AI Platform",
    description: "AI creative suite with prismatic light effects",
    tags: ["Creative", "Amber", "Prismatic"],
    gradient: "from-amber-700 via-orange-800 to-amber-950",
    accent: "#fbbf24",
    prompt: "Slow motion prism splitting white light into rainbow spectrum. Crystal clear optics. AI creativity metaphor. Cinematic light study.",
  },

  // ── Fintech ─────────────────────────────────────────────────────────────────
  {
    name: "Halo",
    category: "Fintech",
    description: "Stablecoin platform with premium liquid metal feel",
    tags: ["Finance", "Blue", "Premium"],
    gradient: "from-blue-800 via-indigo-900 to-blue-950",
    accent: "#60a5fa",
    prompt: "Abstract liquid metal surface with ripples. Futuristic financial data overlays. Dark blue, silver, premium. Cinematic macro shot.",
  },
  {
    name: "GoldStack",
    category: "Fintech",
    description: "Investment platform with wealth and gold branding",
    tags: ["Investment", "Gold", "Wealth"],
    gradient: "from-yellow-700 via-amber-800 to-yellow-950",
    accent: "#fcd34d",
    prompt: "Cinematic slow-motion pour of liquid gold. Rich amber tones. Studio macro photography. Investment and wealth aesthetic.",
  },
  {
    name: "CipherBank",
    category: "Fintech",
    description: "Crypto bank with digital security aesthetics",
    tags: ["Crypto", "Cyan", "Secure"],
    gradient: "from-cyan-700 via-sky-800 to-cyan-950",
    accent: "#38bdf8",
    prompt: "Abstract blockchain data flowing through secure tunnels of light. Cyan and electric blue. Cryptographic security visualized.",
  },

  // ── Logistics ───────────────────────────────────────────────────────────────
  {
    name: "Targo",
    category: "Logistics",
    description: "Transport & logistics with bold red branding",
    tags: ["Transport", "Red", "Bold"],
    gradient: "from-red-800 via-rose-900 to-red-950",
    accent: "#f87171",
    prompt: "Time-lapse of cargo ships and trucks moving at dusk. Bold industrial aesthetic. Red sky, motion blur, cinematic grade.",
  },
  {
    name: "SwiftRoute",
    category: "Logistics",
    description: "Last-mile delivery startup with fast urban energy",
    tags: ["Delivery", "Orange", "Urban"],
    gradient: "from-orange-700 via-amber-800 to-orange-950",
    accent: "#fb923c",
    prompt: "Time-lapse of city street at night — vehicle light trails streaking past. Urban logistics energy. Fast, electric, dynamic.",
  },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  {
    name: "MediFlow",
    category: "Healthcare",
    description: "Medical practice platform with calm clinical teal",
    tags: ["Medical", "Teal", "Clinical"],
    gradient: "from-teal-700 via-emerald-800 to-teal-950",
    accent: "#99f6e4",
    prompt: "Macro shot of water droplets on a clean teal surface. Clinical precision meets warmth. Healthcare digital platform aesthetic.",
  },
  {
    name: "Vitara",
    category: "Healthcare",
    description: "Mental health app with warm gentle visuals",
    tags: ["Mental Health", "Rose", "Gentle"],
    gradient: "from-rose-700 via-pink-800 to-rose-950",
    accent: "#fda4af",
    prompt: "Soft focus shot of cherry blossoms falling in slow motion. Warm pink light. Gentle, healing, mindful aesthetic.",
  },
  {
    name: "PureGen",
    category: "Healthcare",
    description: "Biotech firm with precision science branding",
    tags: ["Biotech", "Sky", "Precision"],
    gradient: "from-sky-700 via-blue-800 to-sky-950",
    accent: "#7dd3fc",
    prompt: "Abstract DNA helix rendered in glowing sky blue. Rotating slowly in dark space. Biotech precision. Scientific elegance.",
  },

  // ── Education ───────────────────────────────────────────────────────────────
  {
    name: "LearnSphere",
    category: "Education",
    description: "Online learning platform with cosmic curiosity visuals",
    tags: ["Learning", "Blue", "Cosmic"],
    gradient: "from-blue-700 via-indigo-800 to-blue-950",
    accent: "#93c5fd",
    prompt: "Cinematic flythrough of a galaxy nebula. Stars and cosmic dust in deep blue and violet. Curiosity and exploration metaphor.",
  },
  {
    name: "MindCraft",
    category: "Education",
    description: "Kids coding platform with playful bright energy",
    tags: ["Kids", "Yellow", "Playful"],
    gradient: "from-yellow-600 via-orange-700 to-yellow-900",
    accent: "#fde047",
    prompt: "Abstract colorful geometric shapes bouncing in a bright playful space. Primary colors. Playful energy. Child-friendly vibrancy.",
  },

  // ── Gaming ──────────────────────────────────────────────────────────────────
  {
    name: "NightRealm",
    category: "Gaming",
    description: "Dark fantasy RPG with epic cinematic atmosphere",
    tags: ["Fantasy", "Dark", "Epic"],
    gradient: "from-purple-800 via-indigo-900 to-purple-950",
    accent: "#818cf8",
    prompt: "Cinematic pan through a dark fantasy castle on a stormy night. Lightning illuminates gothic spires. Purple and dark blue sky.",
  },
  {
    name: "Nebula",
    category: "Gaming",
    description: "Space exploration game with breathtaking cosmos",
    tags: ["Space", "Cosmic", "Blue"],
    gradient: "from-blue-800 via-indigo-900 to-slate-950",
    accent: "#60a5fa",
    prompt: "Cinematic journey through a blue and violet nebula. Star formations and gas clouds. Epic space exploration. IMAX quality.",
  },
  {
    name: "PixelForge",
    category: "Gaming",
    description: "Indie game studio with vibrant creative energy",
    tags: ["Indie", "Fuchsia", "Creative"],
    gradient: "from-fuchsia-700 via-purple-800 to-fuchsia-950",
    accent: "#f0abfc",
    prompt: "Abstract pixel art exploding into 3D geometric shapes. Fuchsia and purple. Game world materializing from code. Creative energy.",
  },

  // ── Real Estate ──────────────────────────────────────────────────────────────
  {
    name: "EstateLux",
    category: "Real Estate",
    description: "Luxury property marketplace with aspirational visuals",
    tags: ["Luxury", "Amber", "Premium"],
    gradient: "from-amber-700 via-yellow-800 to-amber-950",
    accent: "#fbbf24",
    prompt: "Aerial drone shot of a luxury villa at golden hour. Pool glinting, palm trees, warm amber sky. Premium real estate aesthetic.",
  },
  {
    name: "UrbanNest",
    category: "Real Estate",
    description: "City apartment finder with modern architectural feel",
    tags: ["Urban", "Slate", "Modern"],
    gradient: "from-slate-600 via-blue-800 to-slate-900",
    accent: "#94a3b8",
    prompt: "Time-lapse of city skyline at dusk — lights turning on one by one. Glass towers reflecting amber sunset. Modern urban living.",
  },

  // ── Restaurant ───────────────────────────────────────────────────────────────
  {
    name: "Ember",
    category: "Restaurant",
    description: "Upscale steakhouse with live fire branding",
    tags: ["Fire", "Orange", "Premium"],
    gradient: "from-orange-700 via-red-800 to-orange-950",
    accent: "#fb923c",
    prompt: "Cinematic slow motion close-up of glowing ember coals. Cooking fire. Deep orange and red. Premium steakhouse atmosphere.",
  },
  {
    name: "SaffronGarden",
    category: "Restaurant",
    description: "Premium Indian restaurant with rich spice palette",
    tags: ["Indian", "Gold", "Warm"],
    gradient: "from-yellow-600 via-orange-700 to-amber-900",
    accent: "#fbbf24",
    prompt: "Macro shot of vibrant saffron and turmeric spices in warm studio light. Rich golden and orange tones. Aromatic premium dining.",
  },
  {
    name: "FrostBrew",
    category: "Restaurant",
    description: "Craft beer brand with cool refreshing identity",
    tags: ["Beer", "Blue", "Cool"],
    gradient: "from-sky-700 via-blue-800 to-indigo-950",
    accent: "#7dd3fc",
    prompt: "Macro shot of cold beer glass with ice crystals forming. Water droplets on frosted glass. Cool blue light. Refreshing energy.",
  },

  // ── Creative ─────────────────────────────────────────────────────────────────
  {
    name: "LensCraft",
    category: "Creative",
    description: "Photography portfolio with editorial film elegance",
    tags: ["Photography", "Mono", "Film"],
    gradient: "from-gray-600 via-slate-700 to-gray-900",
    accent: "#94a3b8",
    prompt: "Slow pan through a photography darkroom. Red safety light glows on silver gelatin prints. Film photography aesthetic. Timeless.",
  },
  {
    name: "PaperWild",
    category: "Creative",
    description: "Illustration studio with textured analog warmth",
    tags: ["Illustration", "Amber", "Analog"],
    gradient: "from-amber-700 via-yellow-800 to-amber-950",
    accent: "#fcd34d",
    prompt: "Macro of old paper texture with watercolor paint bleeding at edges. Warm analog studio. Illustration and craft aesthetic.",
  },

  // ── Music ───────────────────────────────────────────────────────────────────
  {
    name: "WaveForm",
    category: "Music",
    description: "Music streaming platform with soundwave visuals",
    tags: ["Streaming", "Indigo", "Audio"],
    gradient: "from-indigo-700 via-violet-800 to-indigo-950",
    accent: "#a5b4fc",
    prompt: "Abstract 3D audio waveform pulsing in deep indigo space. Sound visualized as flowing light ribbons. Music platform aesthetic.",
  },
  {
    name: "BeatLab",
    category: "Music",
    description: "Beat production studio with dark club energy",
    tags: ["Production", "Rose", "Club"],
    gradient: "from-rose-800 via-pink-900 to-rose-950",
    accent: "#f43f5e",
    prompt: "Cinematic shot of DJ mixer with glowing VU meters. Dark club atmosphere. Red and pink neon. Bass-heavy visual energy.",
  },

  // ── Fitness ──────────────────────────────────────────────────────────────────
  {
    name: "IronPeak",
    category: "Fitness",
    description: "Premium gym brand with raw power aesthetics",
    tags: ["Gym", "Gray", "Raw"],
    gradient: "from-gray-600 via-zinc-700 to-gray-900",
    accent: "#d1d5db",
    prompt: "Cinematic slow motion of chalk dust exploding from weights. Dark gym atmosphere. Dramatic rim lighting. Raw athletic power.",
  },
  {
    name: "ZenFlow",
    category: "Fitness",
    description: "Yoga & meditation app with serene nature visuals",
    tags: ["Yoga", "Teal", "Serene"],
    gradient: "from-teal-600 via-emerald-700 to-teal-900",
    accent: "#6ee7b7",
    prompt: "Aerial view of morning mist over a glassy mountain lake. Teal and emerald tones. Absolute stillness. Meditation and peace.",
  },
];

export default function PresetsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = PRESETS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/presets" className="text-sm text-foreground font-medium">Presets</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Start Building</Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-10 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Sparkles className="w-3 h-3 mr-1.5" /> 50 production-ready presets
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          Start from a preset
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every preset includes a pre-built AI prompt, scroll layout, and section structure. Customize in seconds.
        </p>
      </section>

      {/* Search + filters */}
      <div className="px-6 pb-8 max-w-7xl mx-auto space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presets…"
            className="pl-9 bg-card border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {filtered.length} preset{filtered.length !== 1 ? "s" : ""}
          {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
      </div>

      {/* Grid */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No presets found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((preset) => (
              <div
                key={preset.name}
                className="group relative rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1"
              >
                {/* Visual preview */}
                <div className={`aspect-video bg-gradient-to-br ${preset.gradient} relative flex items-end p-4`}>
                  {/* Subtle scan lines */}
                  <div className="absolute inset-0 opacity-10">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-white"
                        style={{ top: `${20 + i * 18}%`, opacity: 1 - i * 0.2 }}
                      />
                    ))}
                  </div>
                  {/* Animated accent glow */}
                  <div
                    className="absolute inset-0 blur-2xl animate-pulse"
                    style={{ background: `radial-gradient(circle at 40% 40%, ${preset.accent}55, transparent 65%)`, animationDuration: "3s" }}
                  />
                  <div
                    className="absolute inset-0 blur-3xl"
                    style={{ background: `radial-gradient(circle at 70% 60%, ${preset.accent}33, transparent 60%)` }}
                  />
                  <div className="relative z-10">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {preset.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="font-bold text-base text-white leading-tight">{preset.name}</p>
                    <p className="text-xs text-white/60">{preset.category}</p>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                    <Link href={`/create?template=${encodeURIComponent(preset.name)}&prompt=${encodeURIComponent(preset.prompt)}`}>
                      <Button size="sm" className="bg-primary text-white shadow-lg shadow-primary/30 text-xs h-8 px-3">
                        Use preset <ArrowRight className="ml-1 w-3 h-3" />
                      </Button>
                    </Link>
                    <Link href={`/editor?prompt=${encodeURIComponent(preset.prompt)}`}>
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-xs h-8 px-3">
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-card">
                  <p className="font-semibold text-sm mb-0.5">{preset.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{preset.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="pb-24 px-6 text-center border-t border-white/5 pt-20">
        <h2 className="text-3xl font-black tracking-tighter mb-4">Don&apos;t see what you need?</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Start from scratch — describe any atmosphere and the AI generates it instantly.
        </p>
        <Link href="/create">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-base font-semibold shadow-xl shadow-primary/30">
            Create from scratch <Sparkles className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          ScrollCraft — Built with Next.js & AI
        </div>
      </footer>
    </main>
  );
}
