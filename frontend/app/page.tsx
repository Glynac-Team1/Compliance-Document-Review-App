"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  Search,
  ArrowRight,
  CheckCircle2,
  Lock,
  Zap,
  Users,
  Eye,
  EyeOff,
  HelpCircle,
  Mail,
  FileText,
  Clock,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Activity,
  ArrowUpRight,
  UserPlus,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-foreground">Northstar</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Compliance</p>
      </div>
    </div>
  );
}

function getPasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: "", color: "bg-muted" };
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 4) return { score, label: "Moderate", color: "bg-amber-500" };
  return { score: 5, label: "Strong", color: "bg-emerald-500" };
}

export default function LandingPage() {
  const router = useRouter();

  // Remembered session state
  const [detectedSlug, setDetectedSlug] = useState<string | null>(null);
  const [detectedWorkspaceName, setDetectedWorkspaceName] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<{ name: string; role: string; slug: string } | null>(null);

  // Active tab in hero workspace hub: 'create' | 'lookup'
  const [activeTab, setActiveTab] = useState<"create" | "lookup">("create");

  // Create Workspace Form State
  const [createWsName, setCreateWsName] = useState("");
  const [createWsSlug, setCreateWsSlug] = useState("");
  const [createAdminName, setCreateAdminName] = useState("");
  const [createAdminEmail, setCreateAdminEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreatePass, setShowCreatePass] = useState(false);

  // Email workspace detection State
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    workspaces?: { name: string; slug: string; role: string }[];
    invitation?: { workspace_name: string; role: string; token: string };
    message?: string;
  } | null>(null);

  // FAQ Interactive Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Copy support email feedback
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    const savedSlug = localStorage.getItem("last_workspace_slug");
    const savedName = localStorage.getItem("workspace_name");
    if (savedSlug) {
      setDetectedSlug(savedSlug);
      setDetectedWorkspaceName(savedName || (savedSlug === "northstar" ? "Northstar Compliance" : savedSlug));
    }

    const token = localStorage.getItem("auth_token");
    if (token) {
      fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setActiveUser({ name: data.name, role: data.role, slug: data.slug });
            if (data.workspace_slug) {
              setDetectedSlug(data.workspace_slug);
              setDetectedWorkspaceName(data.workspace_name || data.workspace_slug);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleCopyEmail() {
    navigator.clipboard.writeText("compliance-support@northstar.internal");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  }

  async function handleLookupWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!lookupEmail.trim() || lookupLoading) return;
    setLookupLoading(true);
    setLookupResult(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/lookup-workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lookupEmail.trim() }),
      });
      const data = await res.json();
      setLookupResult(data);
    } catch (err) {
      setLookupResult({
        found: false,
        message: "Unable to connect to discovery service. Please verify your connection.",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleCreateWorkspace(e: FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_name: createWsName.trim(),
          workspace_slug: createWsSlug.trim().toLowerCase(),
          admin_name: createAdminName.trim(),
          admin_email: createAdminEmail.trim().toLowerCase(),
          admin_password: createPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create workspace.");
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("user_slug", data.slug);
      localStorage.setItem("last_workspace_slug", data.workspace_slug);
      localStorage.setItem("workspace_name", data.workspace_name);

      router.push(`/compliance-officer/${data.slug}`);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create workspace.");
    } finally {
      setCreateLoading(false);
    }
  }

  const passStrength = getPasswordStrength(createPassword);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 relative overflow-x-hidden">
      {/* Ambient Background Lights & Grid Design */}
      <div className="absolute top-[-100px] right-[-50px] size-[520px] rounded-full bg-primary/10 blur-[130px] pointer-events-none animate-float-slow -z-10" />
      <div className="absolute top-[38%] left-[-120px] size-[480px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-float-reverse -z-10" />
      <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,#000_50%,transparent_100%)] pointer-events-none -z-10" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-muted-foreground">
            <button
              onClick={() => scrollToSection("features")}
              className="transition hover:text-foreground cursor-pointer"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection("architecture")}
              className="transition hover:text-foreground cursor-pointer"
            >
              Zero-Trust Architecture
            </button>
            <button
              onClick={() => scrollToSection("support")}
              className="transition hover:text-foreground cursor-pointer"
            >
              Support & FAQ
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {activeUser ? (
              <button
                onClick={() => {
                  const path =
                    activeUser.role === "officer"
                      ? `/compliance-officer/${activeUser.slug}`
                      : `/advisor/${activeUser.slug}`;
                  router.push(path);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition active:scale-95"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <>
                <Link
                  href={detectedSlug ? `/login?workspace=${detectedSlug}` : "/login"}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => {
                    setActiveTab("create");
                    scrollToSection("workspace-hub");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition active:scale-95 cursor-pointer"
                >
                  <Building2 className="size-3.5" />
                  <span>Create Workspace</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-24 border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
            {/* Left Headline Column */}
            <div className="lg:col-span-6 space-y-6 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                SEC Rule 206(4)-1 & FINRA 2210 Heuristics
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.08]">
                Institutional compliance review, complete audit assurance.
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                Northstar enables financial teams to review client materials with machine-verified precision, strict role governance, and real-time concurrency locks built for regulatory scrutiny.
              </p>

              {/* Workspace Auto-Detection Callout */}
              {detectedSlug && (
                <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] backdrop-blur-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-sm">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground">Active Workspace Detected</p>
                      <p className="text-sm font-bold text-foreground truncate">{detectedWorkspaceName}</p>
                    </div>
                  </div>
                  <Link
                    href={`/login?workspace=${detectedSlug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition shrink-0 active:scale-95"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}

              {/* Confidence Points */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Single-use cryptographic invitations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>No unverified officer self-signups</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Live SSE document conflict prevention</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Immutable audit log for inspections</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab("create");
                    scrollToSection("workspace-hub");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition active:scale-95 cursor-pointer"
                >
                  <Building2 className="size-4" />
                  <span>Create Your Workspace</span>
                </button>
                <button
                  onClick={() => scrollToSection("features")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95 cursor-pointer"
                >
                  <span>Explore Capabilities</span>
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: First-Time User Interactive Workspace Hub */}
            <div id="workspace-hub" className="lg:col-span-6 scroll-mt-24">
              <div className="rounded-3xl border border-border/80 bg-card/85 backdrop-blur-xl p-6 sm:p-7 shadow-xl shadow-primary/[0.04] transition-all">
                {/* Segmented Tab Switcher */}
                <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                      activeTab === "create"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserPlus className="size-3.5" />
                    <span>Create Workspace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("lookup")}
                    className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                      activeTab === "lookup"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Search className="size-3.5" />
                    <span>Find My Team</span>
                  </button>
                </div>

                {activeTab === "create" ? (
                  /* 1. Create Workspace Onboarding Form */
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Register Organization Workspace
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Set up an isolated regulatory domain for your firm and assign your master administrator.
                      </p>
                    </div>

                    {createError && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center justify-between">
                        <span>{createError}</span>
                        <button
                          type="button"
                          onClick={() => setCreateError(null)}
                          className="font-bold opacity-70 hover:opacity-100 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleCreateWorkspace} className="space-y-3 text-xs">
                      <div>
                        <label className="block font-semibold text-foreground mb-1">
                          Firm / Organization Name
                        </label>
                        <input
                          type="text"
                          required
                          value={createWsName}
                          onChange={(e) => {
                            setCreateWsName(e.target.value);
                            if (!createWsSlug || createWsSlug === createWsName.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
                              setCreateWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                            }
                          }}
                          placeholder="e.g. Apex Wealth Partners"
                          className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-semibold text-foreground">
                            Workspace URL Slug
                          </label>
                          {createWsSlug && (
                            <span className="text-[10px] font-mono text-primary font-medium">
                              app/{createWsSlug}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center rounded-xl border border-input bg-background/80 px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition">
                          <span className="text-muted-foreground font-mono text-[11px] mr-1">app.compliance/</span>
                          <input
                            type="text"
                            required
                            value={createWsSlug}
                            onChange={(e) => setCreateWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            placeholder="apex-wealth"
                            className="w-full bg-transparent text-foreground font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-foreground mb-1">
                            Administrator Name
                          </label>
                          <input
                            type="text"
                            required
                            value={createAdminName}
                            onChange={(e) => setCreateAdminName(e.target.value)}
                            placeholder="Alex Morgan, CCO"
                            className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-foreground mb-1">
                            Corporate Work Email
                          </label>
                          <input
                            type="email"
                            required
                            value={createAdminEmail}
                            onChange={(e) => setCreateAdminEmail(e.target.value)}
                            placeholder="alex@apexwealth.com"
                            className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-semibold text-foreground">
                            Master Password
                          </label>
                          {createPassword && (
                            <span className={`text-[10px] font-semibold ${
                              passStrength.label === "Strong"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : passStrength.label === "Moderate"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive"
                            }`}>
                              {passStrength.label}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showCreatePass ? "text" : "password"}
                            required
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="Min 8 chars, uppercase, lowercase, number, symbol"
                            className="w-full rounded-xl border border-input bg-background/80 px-3 py-2 pr-9 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCreatePass(!showCreatePass)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showCreatePass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>

                        {createPassword && (
                          <div className="mt-2 flex gap-1 h-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`flex-1 rounded-full transition-all ${
                                  level <= passStrength.score ? passStrength.color : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={createLoading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                        >
                          {createLoading ? "Provisioning Organization..." : "Launch Organization Workspace →"}
                        </button>
                      </div>

                      <p className="text-[11px] text-center text-muted-foreground pt-1">
                        Already have a workspace?{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("lookup")}
                          className="font-semibold text-primary hover:underline"
                        >
                          Find your team
                        </button>{" "}
                        or{" "}
                        <Link href="/login" className="font-semibold text-primary hover:underline">
                          Sign In
                        </Link>
                      </p>
                    </form>
                  </div>
                ) : (
                  /* 2. Find Existing Workspace Tab */
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Find Your Organization Workspace
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enter your work email to discover which workspace you belong to or accept a pending invitation.
                      </p>
                    </div>

                    <form onSubmit={handleLookupWorkspace} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Corporate Work Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <input
                            type="email"
                            required
                            value={lookupEmail}
                            onChange={(e) => setLookupEmail(e.target.value)}
                            placeholder="colleague@firm.com"
                            className="w-full rounded-xl border border-input bg-background/80 pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={lookupLoading || !lookupEmail.trim()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground text-background px-4 py-2.5 text-xs font-semibold hover:bg-foreground/90 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                      >
                        {lookupLoading ? "Searching Directory..." : "Discover My Workspace"}
                        <Search className="size-3.5" />
                      </button>
                    </form>

                    {lookupResult && (
                      <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs transition-all">
                        {lookupResult.found ? (
                          <div className="space-y-2.5">
                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Workspace discovered:
                            </p>
                            {lookupResult.workspaces?.map((ws) => (
                              <div key={ws.slug} className="flex items-center justify-between pt-1 border-t border-border/60">
                                <div>
                                  <span className="font-bold text-foreground block">{ws.name}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase">{ws.role}</span>
                                </div>
                                <Link
                                  href={`/login?workspace=${ws.slug}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
                                >
                                  <span>Sign in</span>
                                  <ArrowRight className="size-3" />
                                </Link>
                              </div>
                            ))}
                            {lookupResult.invitation && (
                              <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                                <div>
                                  <span className="font-semibold text-foreground block">
                                    {lookupResult.invitation.workspace_name}
                                  </span>
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                    Pending Invite: {lookupResult.invitation.role}
                                  </span>
                                </div>
                                <Link
                                  href={`/accept-invite?token=${lookupResult.invitation.token}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                                >
                                  <span>Accept Invite</span>
                                  <ArrowRight className="size-3" />
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-muted-foreground">
                              {lookupResult.message || "No active workspace was found for this email address."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveTab("create")}
                              className="text-primary hover:underline font-semibold"
                            >
                              Create a new organization workspace instead →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Core Capabilities Section */}
      <section id="features" className="py-20 sm:py-24 border-b border-border/40 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground mb-3">
              <Shield className="size-3.5 text-primary" />
              Institutional Platform Pillars
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Engineered for Regulatory Assurance
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Eliminate self-appointment vulnerabilities, audit blind spots, and review bottlenecks with purpose-built compliance workflows.
            </p>
          </div>

          <div id="architecture" className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 scroll-mt-20">
            {/* Pillar 1 */}
            <div className="group rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform">
                <FileCheck2 className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Precision Rule Scanning</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Automated text heuristics cross-reference client communications against FINRA Rule 2210 and SEC Rule 206(4)-1 disclosure standards.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">FINRA 2210 Heuristics</span>
                <button
                  onClick={() => {
                    setActiveTab("create");
                    scrollToSection("workspace-hub");
                  }}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Test in workspace</span>
                  <ArrowUpRight className="size-3" />
                </button>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="group rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform">
                <Lock className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Zero-Trust Role Governance</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Compliance Officer roles cannot be claimed publicly. Workspace administrators pre-assign locked roles via single-use 256-bit cryptographic invitation tokens.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-primary">Cryptographic Tokens</span>
                <Link
                  href="/accept-invite"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Accept invite</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="group rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform">
                <Zap className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Live Concurrency Locking</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Atomic database locking ensures two officers never review the same document simultaneously. Real-time SSE updates keep teams synchronized.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-600 dark:text-amber-400">Atomic Review Locks</span>
                <button
                  onClick={() => scrollToSection("support")}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Learn how it works</span>
                  <ArrowUpRight className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support & Interactive FAQ Section */}
      <section id="support" className="py-20 sm:py-24 border-b border-border/40 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left FAQ Column */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground mb-3">
                  <HelpCircle className="size-3.5 text-primary" />
                  Frequently Asked Questions
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Everything you need to know about Northstar Workspaces
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Common questions on multi-tenant isolation, administrator controls, and regulatory audit compliance.
                </p>
              </div>

              {/* Accordion List */}
              <div className="space-y-3">
                {[
                  {
                    q: "How do organization workspaces isolate firm data?",
                    a: "Every workspace is tenant-partitioned with its own distinct organization slug and database keys. Financial Advisors and Compliance Officers can only view and process submissions belonging to their authorized organization.",
                  },
                  {
                    q: "Can Compliance Officers self-register without an administrator invitation?",
                    a: "No. To prevent unverified self-appointment vulnerabilities, Compliance Officers cannot self-register. Only authorized workspace administrators can issue cryptographic single-use invitation tokens with pre-locked roles.",
                  },
                  {
                    q: "How does the real-time concurrency locking prevent review conflicts?",
                    a: "When a compliance officer begins reviewing a client submission, an atomic database claim lock is applied with a 30-minute idle TTL. All other officers in the workspace receive a live SSE event displaying the document as 'In Review by Alex', preventing duplicate reviews.",
                  },
                  {
                    q: "What happens when an employee departs the organization?",
                    a: "Workspace Administrators can unassign departing employees directly from the Admin Console. The employee loses access immediately, while their historical submissions and approved review threads remain permanently preserved for regulatory inspections.",
                  },
                ].map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-sm overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-foreground hover:bg-muted/40 transition cursor-pointer"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-3 ${
                            isOpen ? "rotate-180 text-primary" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Support Desk Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-border/80 bg-card/85 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Compliance Desk Support</h3>
                    <p className="text-xs text-muted-foreground">Dedicated technical assistance</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Need assistance migrating custom compliance rulebooks, configuring firm disclosure requirements, or integrating automated archives?
                </p>

                {/* Copy Support Contact Action */}
                <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Official Support Channel</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Verified Active</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-input bg-background/90 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground truncate">compliance-support@northstar.internal</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-semibold shrink-0 cursor-pointer"
                      title="Copy support email address"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="size-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setActiveTab("create");
                      scrollToSection("workspace-hub");
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition active:scale-95 cursor-pointer"
                  >
                    <span>Create Organization Workspace</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                  <Link
                    href="/accept-invite"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
                  >
                    <span>Accept Onboarding Invitation</span>
                  </Link>
                </div>

                <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Activity className="size-3 text-emerald-500" /> All Systems Operational
                  </span>
                  <span>PostgreSQL &bull; Redis &bull; MinIO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Institutional Footer */}
      <footer className="mt-auto border-t border-border/80 bg-card/40 backdrop-blur-md py-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-[11px] text-muted-foreground">
              &copy; {new Date().getFullYear()} Northstar Compliance Systems. Enterprise Edition.
            </span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <button
              onClick={() => {
                setActiveTab("create");
                scrollToSection("workspace-hub");
              }}
              className="hover:text-foreground cursor-pointer transition"
            >
              Create Workspace
            </button>
            <button
              onClick={() => {
                setActiveTab("lookup");
                scrollToSection("workspace-hub");
              }}
              className="hover:text-foreground cursor-pointer transition"
            >
              Find Team
            </button>
            <Link href="/login" className="hover:text-foreground transition">
              Sign In
            </Link>
            <Link href="/accept-invite" className="hover:text-foreground transition">
              Accept Invite
            </Link>
            <button
              onClick={handleCopyEmail}
              className="hover:text-foreground cursor-pointer transition"
            >
              Support
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

