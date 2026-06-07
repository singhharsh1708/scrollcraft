"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Sparkles, Plus, ExternalLink, Trash2,
  Zap, Globe, Download, LogOut, User, ChevronDown, Settings, Loader2
} from "lucide-react";

interface Site {
  id: string;
  name: string;
  frameCount: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
}

const PLANS: Record<string, { label: string; credits: number; color: string }> = {
  free: { label: "Free Trial", credits: 100, color: "text-muted-foreground" },
  basic: { label: "Basic", credits: 1500, color: "text-blue-400" },
  pro: { label: "Pro", credits: 6000, color: "text-primary" },
  premium: { label: "Premium", credits: 25000, color: "text-amber-400" },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const plan = PLANS.free;
  const usedCredits = 34;
  const totalCredits = plan.credits;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/sites")
      .then(r => r.json())
      .then(data => { if (data.sites) setSites(data.sites); })
      .catch(() => toast.error("Failed to load sites"))
      .finally(() => setSitesLoading(false));
  }, [status]);

  const deleteSite = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSites(prev => prev.filter(s => s.id !== id));
      toast.success("Site deleted");
    } catch {
      toast.error("Failed to delete site");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const user = session.user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-card/50 px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">ScrollCraft</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New site
            </Button>
          </Link>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-white/8 hover:bg-white/5 transition-colors"
            >
              {user?.image ? (
                <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <span className="text-sm font-medium max-w-[120px] truncate">{user?.name || user?.email}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-card shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="p-1">
                  <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 text-left">
                      <Zap className="w-3.5 h-3.5 text-primary" /> Upgrade plan
                    </button>
                  </Link>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 text-left text-muted-foreground">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 text-left text-destructive"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Welcome + credits */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Greeting */}
          <div className="md:col-span-2 p-6 rounded-2xl border border-white/8 bg-card">
            <p className="text-muted-foreground text-sm mb-1">Welcome back</p>
            <h1 className="text-2xl font-black tracking-tighter mb-4">
              {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/15 text-primary border-primary/30 px-3">
                {plan.label}
              </Badge>
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="border-white/10 text-xs h-7">
                  <Zap className="w-3 h-3 mr-1" /> Upgrade
                </Button>
              </Link>
            </div>
          </div>

          {/* Credits */}
          <div className="p-6 rounded-2xl border border-white/8 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">AI Credits</p>
              <span className="text-xs text-muted-foreground">{usedCredits} / {totalCredits}</span>
            </div>
            <Progress value={(usedCredits / totalCredits) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{totalCredits - usedCredits} credits remaining this month</p>
            <Link href="/pricing">
              <Button size="sm" className="w-full bg-primary/15 hover:bg-primary/25 text-primary border-0 text-xs h-7 mt-1">
                Get more credits
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Sites created", value: sites.length, icon: Globe },
            { label: "Total frames", value: sites.reduce((a, s) => a + s.frameCount, 0), icon: ExternalLink },
            { label: "Exports", value: 0, icon: Download },
            { label: "Credits used", value: usedCredits, icon: Zap },
          ].map(stat => (
            <div key={stat.label} className="p-5 rounded-2xl border border-white/8 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className="text-2xl font-black">{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Sites */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold tracking-tight">Your sites</h2>
            <Link href="/create">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New site
              </Button>
            </Link>
          </div>

          {sitesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="font-medium mb-1">No sites yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first scroll site in minutes</p>
              <Link href="/create">
                <Button className="bg-primary text-white">Create your first site</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sites.map(site => (
                <div key={site.id} className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-card hover:border-white/15 transition-colors group">
                  <div className="w-14 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{site.name}</p>
                    <p className="text-xs text-muted-foreground">{site.frameCount} frames · {site.fps} fps · {new Date(site.updatedAt).toLocaleDateString("en-IN")}</p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/editor?siteId=${site.id}`}>
                      <Button size="sm" variant="outline" className="border-white/10 h-7 px-2 text-xs">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteSite(site.id)}
                      disabled={deletingId === site.id}
                      className="border-white/10 h-7 w-7 p-0 hover:border-destructive hover:text-destructive"
                    >
                      {deletingId === site.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-bold tracking-tight mb-5">Quick actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Plus, title: "New site from scratch", desc: "Start with a custom AI prompt", href: "/create", color: "text-primary" },
              { icon: Sparkles, title: "Browse presets", desc: "12 production-ready templates", href: "/presets", color: "text-violet-400" },
              { icon: Zap, title: "Upgrade plan", desc: "More credits, more sites, 4K video", href: "/pricing", color: "text-amber-400" },
            ].map(action => (
              <Link key={action.title} href={action.href}>
                <div className="p-5 rounded-2xl border border-white/8 bg-card hover:border-primary/30 transition-colors cursor-pointer group">
                  <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors`}>
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                  </div>
                  <p className="font-medium text-sm mb-0.5">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
