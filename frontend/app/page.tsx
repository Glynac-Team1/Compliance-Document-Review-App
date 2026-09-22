"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Shield,
  Building2,
  FileCheck2,
  Search,
  ArrowRight,
  CheckCircle2,
  Lock,
  Zap,
  HelpCircle,
  Mail,
  ChevronDown,
  Copy,
  Check,
  Activity,
  ArrowUpRight,
  X,
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

export default function LandingPage() {
  const router = useRouter();

  // Remembered session state
  const [detectedSlug, setDetectedSlug] = useState<string | null>(null);
  const [detectedWorkspaceName, setDetectedWorkspaceName] = useState<string | null>(null);

  // FAQ Interactive Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Copy support email feedback
  const [copiedEmail, setCopiedEmail] = useState(false);

  function handleClearDetectedWorkspace() {
    localStorage.removeItem("last_workspace_slug");
    localStorage.removeItem("workspace_name");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_slug");
    localStorage.removeItem("is_admin");
    setDetectedSlug(null);
    setDetectedWorkspaceName(null);
  }

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
        .then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            handleClearDetectedWorkspace();
            return null;
          }
        })
        .then((data) => {
          if (data && data.workspace_slug) {
            setDetectedSlug(data.workspace_slug);
            setDetectedWorkspaceName(data.workspace_name || data.workspace_slug);
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 relative overflow-x-clip">
      {/* Institutional dot grid with soft radial vignette */}
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,#000_50%,transparent_100%)] -z-10" />

      {/* Top Navigation - Sticky header with glassy blur so content smoothly scrolls under it */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-xl shadow-xs transition-colors">
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
            <Link
              href={detectedSlug ? `/login?workspace=${detectedSlug}` : "/login"}
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
            >
              Sign In
            </Link>
            <Link
              href="/create-workspace"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition active:scale-95 cursor-pointer"
            >
              <Building2 className="size-3.5" />
              <span>Create Workspace</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Isolated Stacking Context & Transparent Blue Circles */}
      <section className="relative isolate overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 border-b border-border/40">
        {/* Aesthetic Transparent Blue Geometric Circles in Hero (Vividly visible, perfectly matching brand palette) */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 size-[650px] sm:size-[820px] lg:size-[980px] select-none -z-10 flex items-center justify-center">
          {/* Ambient soft radiant outer glow */}
          <div className="absolute inset-0 rounded-full bg-blue-500/15 blur-[100px] animate-pulse-glow" />
          
          {/* Primary transparent blue circle disk with visible border */}
          <div className="absolute inset-8 sm:inset-12 rounded-full border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent shadow-[0_0_120px_rgba(37,99,235,0.22)] animate-float-slow" />
          
          {/* Nested concentric precision ring */}
          <div className="absolute size-[72%] rounded-full border border-blue-400/35 bg-blue-500/[0.05]" />
          
          {/* Inner core circle */}
          <div className="absolute size-[46%] rounded-full border border-primary/30 bg-primary/[0.03]" />
        </div>

        {/* Accent floating transparent blue circle behind headline */}
        <div className="pointer-events-none absolute top-12 -left-20 size-[380px] sm:size-[480px] select-none -z-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-blue-500/30 bg-gradient-to-tr from-sky-500/15 via-blue-500/10 to-transparent shadow-[0_0_80px_rgba(59,130,246,0.18)] animate-float-reverse" />
          <div className="absolute size-[70%] rounded-full border border-blue-400/25" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Headline Column */}
            <div className="lg:col-span-6 space-y-6 pt-2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.08]">
                Institutional compliance review, complete audit assurance.
              </h1>

              <p className="text-sm sm:text-base text-foreground/85 dark:text-foreground/90 font-normal leading-relaxed max-w-xl">
                Northstar enables financial teams to review client materials, coordinate team approvals, and maintain a complete audit history.
              </p>

              {/* Workspace Auto-Detection Callout */}
              {detectedSlug && (
                <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] dark:bg-primary/10 backdrop-blur-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-sm">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary dark:text-sky-400 uppercase tracking-wider">Active Workspace Detected</p>
                      <p className="text-base font-extrabold text-foreground truncate">{detectedWorkspaceName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleClearDetectedWorkspace}
                      title="Clear saved workspace"
                      aria-label="Clear saved workspace"
                      className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                    <Link
                      href={`/login?workspace=${detectedSlug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition shrink-0 active:scale-95"
                    >
                      <span>Enter Workspace</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Confidence Points with Crisp High-Contrast Typography */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium text-foreground/90 dark:text-foreground/95">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
                  <span>Direct team invitations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
                  <span>Role-based access control</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
                  <span>Simultaneous review conflict prevention</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.2} />
                  <span>Document history & audit trail</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                <Link
                  href="/create-workspace"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition active:scale-95 cursor-pointer"
                >
                  <Building2 className="size-4" />
                  <span>Create Workspace</span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href={detectedSlug ? `/login?workspace=${detectedSlug}` : "/login"}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 backdrop-blur-sm px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition active:scale-95 cursor-pointer"
                >
                  <Search className="size-4" />
                  <span>Find My Workspace</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Preserves two-column layout with background orbital rings */}
            <div className="lg:col-span-6 relative hidden lg:flex items-center justify-center min-h-[380px]" aria-hidden="true" />
          </div>
        </div>
      </section>
      {/* Core Capabilities Section with Isolated Stacking Context & Transparent Blue Circle */}
      <section id="features" className="relative isolate overflow-hidden py-20 sm:py-24 border-b border-border/40 scroll-mt-16">
        {/* Mid-page Aesthetic Blue Transparent Geometric Circle */}
        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-28 size-[520px] sm:size-[650px] select-none -z-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-blue-500/30 bg-gradient-to-bl from-blue-500/15 via-primary/[0.06] to-transparent shadow-[0_0_90px_rgba(37,99,235,0.18)] animate-float-slow" />
          <div className="absolute size-[70%] rounded-full border border-blue-400/25" />
          <div className="absolute size-[45%] rounded-full border border-primary/20" />
        </div>

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
              <h3 className="text-base font-bold text-foreground">Document Review Checks</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Automated policy screening flags potential compliance issues and disclosure requirements in marketing and client materials.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Automated Screening</span>
                <Link
                  href="/create-workspace"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Get started</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="group rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform">
                <Lock className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Role Management</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Team member access is managed securely by administrators. Roles are pre-assigned through direct email invitations.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-primary">Direct Invitations</span>
                <span className="font-medium text-muted-foreground">Administrator Controlled</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="group rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform">
                <Zap className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Review Conflict Prevention</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Active review locking prevents multiple reviewers from making conflicting decisions on the same document simultaneously.
              </p>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-amber-600 dark:text-amber-400">Live Status Sync</span>
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

      {/* Support & Interactive FAQ Section with Isolated Stacking Context & Transparent Blue Circle */}
      <section id="support" className="relative isolate overflow-hidden py-20 sm:py-24 border-b border-border/40 scroll-mt-16">
        {/* Bottom-page Aesthetic Blue Transparent Geometric Circle */}
        <div className="pointer-events-none absolute top-1/3 -left-28 size-[480px] sm:size-[600px] select-none -z-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-blue-500/25 bg-gradient-to-tr from-blue-600/15 via-primary/[0.05] to-transparent shadow-[0_0_80px_rgba(37,99,235,0.15)] animate-float-reverse" />
          <div className="absolute size-[70%] rounded-full border border-blue-400/20" />
          <div className="absolute size-[45%] rounded-full border border-primary/20" />
        </div>

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
                    a: "Every workspace is private to your organization. Advisors and Compliance Officers can only view and process submissions belonging to their assigned workspace.",
                  },
                  {
                    q: "Can team members register without an invitation?",
                    a: "No. All team members must be invited directly by a workspace administrator with an assigned role.",
                  },
                  {
                    q: "How does review conflict prevention work?",
                    a: "When an officer starts reviewing a document, it is marked as in-review across the workspace, preventing duplicate reviews and conflicting decisions.",
                  },
                  {
                    q: "What happens when an employee departs the organization?",
                    a: "Workspace Administrators can deactivate departing team members directly from the Admin Console. The member loses access immediately, while document history and approvals are preserved.",
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
                  <Link
                    href="/create-workspace"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition active:scale-95 cursor-pointer"
                  >
                    <span>Create Organization Workspace</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
                  >
                    <span>Sign In to Existing Workspace</span>
                  </Link>
                </div>

                <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Activity className="size-3 text-emerald-500" /> All Systems Operational
                  </span>
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
            <Link
              href="/create-workspace"
              className="hover:text-foreground cursor-pointer transition"
            >
              Create Workspace
            </Link>
            <Link href="/login" className="hover:text-foreground transition">
              Sign In
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

