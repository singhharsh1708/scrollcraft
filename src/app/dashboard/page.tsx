"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Sparkles, Plus, ExternalLink, Trash2,
  Zap, Globe, Download, Loader2
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { planByKey } from "@/lib/plans";

interface Site {
  id: string;
  name: string;
  frameCount: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
}


export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Two-click confirm, matching the editor's existing pattern. The trash button sits
  // directly beside Edit in the hover row, and one misclick permanently destroyed the
  // site and its stored frames with no undo.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [exportCount, setExportCount] = useState(0);
  const userPlanKey = (session?.user?.plan ?? "FREE") as string;
  const plan = planByKey(userPlanKey);
  const siteLimit = plan.sites;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // A failed load used to parse fine (the body is valid JSON, just `{error}`), so
    // `sites` stayed empty, the catch never ran, and a user with sites was shown the
    // "no sites yet" empty state. Reject on a non-ok status so failure is visible.
    Promise.all([
      fetch("/api/sites").then(async r => {
        if (!r.ok) throw new Error("sites");
        return r.json();
      }),
      fetch("/api/user/stats")
        .then(r => (r.ok ? r.json() : {}))
        .catch(() => ({})) as Promise<{ exportCount?: number }>,
    ]).then(([sitesData, statsData]) => {
      setSites(Array.isArray(sitesData.sites) ? sitesData.sites : []);
      if (typeof statsData.exportCount === "number") setExportCount(statsData.exportCount);
      setLoadFailed(false);
    }).catch(() => {
      setLoadFailed(true);
      toast.error("Couldn't load your sites. Refresh to try again.");
    }).finally(() => setSitesLoading(false));
  }, [status]);

  const deleteSite = async (id: string) => {
    if (deletingId) return;
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      // Reset if they do not confirm, so the armed state cannot linger and catch a
      // later stray click.
      window.setTimeout(() => setPendingDeleteId(cur => (cur === id ? null : cur)), 4000);
      return;
    }
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Throwing away the body made the 409 "this site has a purchased export"
        // unreachable — the user saw "Failed to delete" and retried forever.
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete site");
        return;
      }
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
      <Navbar />

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
              <Badge className={`bg-primary/15 border-primary/30 px-3 ${plan.color}`}>
                {plan.label}
              </Badge>
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="border-white/10 text-xs h-7">
                  <Zap className="w-3 h-3 mr-1" /> Upgrade
                </Button>
              </Link>
            </div>
          </div>

          {/* Plan */}
          <div className="p-6 rounded-2xl border border-white/8 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Saved websites</p>
              <span className="text-xs text-muted-foreground">{sites.length} / {siteLimit}</span>
            </div>
            <Progress value={siteLimit > 0 ? Math.min(100, (sites.length / siteLimit) * 100) : 0} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              {Math.max(0, siteLimit - sites.length)} slot{siteLimit - sites.length === 1 ? "" : "s"} left on {plan.label}
            </p>
            <Link href="/pricing">
              <Button size="sm" className="w-full bg-primary/15 hover:bg-primary/25 text-primary border-0 text-xs h-7 mt-1">
                Upgrade for more
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Sites created", value: sites.length, icon: Globe },
            { label: "Total frames", value: sites.reduce((a, s) => a + s.frameCount, 0), icon: ExternalLink },
            { label: "Exports", value: exportCount, icon: Download },
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
          ) : loadFailed ? (
            // Distinct from the empty state: telling someone with 12 sites to "create
            // their first" is worse than telling them the load failed.
            <div className="text-center py-20 rounded-2xl border border-dashed border-amber-500/30">
              <p className="font-medium mb-1">Couldn&apos;t load your sites</p>
              <p className="text-sm text-muted-foreground mb-4">Your sites are safe — this is a loading problem.</p>
              <Button className="bg-primary text-white" onClick={() => window.location.reload()}>
                Try again
              </Button>
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
                      className={`border-white/10 h-7 p-0 hover:border-destructive hover:text-destructive ${pendingDeleteId === site.id ? "w-12 border-destructive text-destructive" : "w-7"}`}
                    >
                      {deletingId === site.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : pendingDeleteId === site.id
                          ? <span className="text-[10px] font-semibold px-1">Sure?</span>
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
              { icon: Plus, title: "Start from a template", desc: "Pick a ready-made scroll site", href: "/presets", color: "text-primary" },
              { icon: Sparkles, title: "Browse presets", desc: "12 production-ready templates", href: "/presets", color: "text-violet-400" },
              { icon: Zap, title: "Upgrade plan", desc: "Keep more websites saved", href: "/pricing", color: "text-amber-400" },
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
