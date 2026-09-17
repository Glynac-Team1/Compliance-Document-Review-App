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
  X,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
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
  const [activeUser, setActiveUser] = useState<{ name: string; role: string; slug: string } | null>(null);

  // Email workspace detection
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    workspaces?: { name: string; slug: string; role: string }[];
    invitation?: { workspace_name: string; role: string; token: string };
    message?: string;
  } | null>(null);

  // Create Workspace Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWsName, setCreateWsName] = useState("");
  const [createWsSlug, setCreateWsSlug] = useState("");
  const [createAdminName, setCreateAdminName] = useState("");
  const [createAdminEmail, setCreateAdminEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreatePass, setShowCreatePass] = useState(false);

  useEffect(() => {
    // Check remembered workspace
    const savedSlug = localStorage.getItem("last_workspace_slug");
    const savedName = localStorage.getItem("workspace_name");
    if (savedSlug) {
      setDetectedSlug(savedSlug);
      setDetectedWorkspaceName(savedName || (savedSlug === "northstar" ? "Northstar Compliance" : savedSlug));
    }

    // Check if user is currently logged in
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
        message: "Unable to look up workspaces. Please check your connection.",
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

      // Save credentials & active session
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("user_slug", data.slug);
      localStorage.setItem("last_workspace_slug", data.workspace_slug);
      localStorage.setItem("workspace_name", data.workspace_name);

      setShowCreateModal(false);
      router.push(`/compliance-officer/${data.slug}`);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create workspace.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="transition hover:text-foreground">
              Capabilities
            </a>
            <a href="#architecture" className="transition hover:text-foreground">
              Zero-Trust Architecture
            </a>
            <a href="#support" className="transition hover:text-foreground">
              Support & Contact
            </a>
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
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <>
                <Link
                  href={detectedSlug ? `/login?workspace=${detectedSlug}` : "/login"}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition"
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
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Headline Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-4" />
                SEC & FINRA Regulatory Compliance Engine
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Automated compliance review,{" "}
                <span className="text-primary underline decoration-primary/30 underline-offset-4">
                  complete audit assurance.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                Northstar enables financial teams to review client materials with machine-verified precision, strict role governance, and an immutable audit trail built for regulatory inspections.
              </p>

              {/* Workspace Auto-Detection Callout */}
              {detectedSlug && (
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Detected Organization Workspace</p>
                      <p className="text-sm font-bold text-foreground truncate">{detectedWorkspaceName}</p>
                    </div>
                  </div>
                  <Link
                    href={`/login?workspace=${detectedSlug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition shrink-0"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}

              {/* Email Workspace Finder */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Looking for your firm&apos;s workspace?
                </p>
                <form onSubmit={handleLookupWorkspace} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="name@firm.com"
                      className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2 text-xs font-semibold hover:bg-foreground/90 transition disabled:opacity-50"
                  >
                    {lookupLoading ? "Locating..." : "Find Workspace"}
                    <Search className="size-3.5" />
                  </button>
                </form>

                {lookupResult && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                    {lookupResult.found ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Workspace discovered for your account:
                        </p>
                        {lookupResult.workspaces?.map((ws) => (
                          <div key={ws.slug} className="flex items-center justify-between pt-1">
                            <span className="font-bold text-foreground">{ws.name}</span>
                            <Link
                              href={`/login?workspace=${ws.slug}`}
                              className="text-primary hover:underline font-semibold"
                            >
                              Sign in ({ws.role}) →
                            </Link>
                          </div>
                        ))}
                        {lookupResult.invitation && (
                          <div className="flex items-center justify-between border-t border-border/60 pt-2">
                            <span>
                              Pending invite as <strong>{lookupResult.invitation.role}</strong>
                            </span>
                            <Link
                              href={`/accept-invite?token=${lookupResult.invitation.token}`}
                              className="text-primary hover:underline font-semibold"
                            >
                              Accept Invitation →
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        {lookupResult.message || "No active workspace or pending invitation found for this email."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Product Mockup Column */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-primary/[0.06]">
                {/* Mock Queue Window */}
                <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-red-400/80" />
                    <span className="size-3 rounded-full bg-amber-400/80" />
                    <span className="size-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    northstar-compliance-officer
                  </span>
                </div>

                {/* Mock Review Item */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Clock className="size-3" />
                        In Review
                      </span>
                      <h3 className="mt-1 text-xs font-bold text-foreground">
                        Q3-Growth-Portfolio-Presentation.pdf
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Submitted by Jordan Davis (Advisor)
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      98% Match
                    </span>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background p-3 text-[11px] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <FileText className="size-3.5 text-primary" />
                      Rule Disclosure Detection
                    </div>
                    <p className="text-muted-foreground leading-normal">
                      &quot;Flagged: FINRA Rule 2210 requirement for prominent performance disclaimer missing on Slide 4.&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Active Lock: Compliance Officer Alex</span>
                    <span className="font-medium text-primary">Immutable Audit Logged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="features" className="py-20 bg-muted/20 border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Engineered for Institutional Trust
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              Eliminate self-appointment vulnerabilities, audit blind spots, and review bottlenecks with purpose-built compliance workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <FileCheck2 className="size-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Precision Rule Scanning</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Vector retrieval and automated text heuristics cross-reference client communications against FINRA 2210, SEC marketing rules, and firm disclosure standards.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Lock className="size-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Zero-Trust Role Governance</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Compliance Officer roles cannot be claimed publicly. Workspace administrators pre-assign locked roles via single-use 256-bit cryptographic invitation tokens.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <Zap className="size-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Live SSE Concurrency Locks</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Atomic database locking ensures two officers never approve the same document simultaneously. Real-time notifications keep advisor and compliance teams synchronized.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Support & Contact Section */}
      <section id="support" className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                  <HelpCircle className="size-5" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Enterprise Support & Inquiries
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Need assistance setting up your organization workspace, custom compliance rules, or integrating your firm&apos;s existing record repository?
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <a
                    href="mailto:support@northstarcompliance.com"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    <Mail className="size-3.5" />
                    Contact Compliance Desk
                  </a>
                  <Link
                    href="/accept-invite"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                  >
                    Accept Onboarding Invite
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-5 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Standard Security Compliance
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Every workspace operates with segregated database tenant keys, NIST SP 800-63B password enforcement, and cryptographically verified JWT tokens.
                </p>
                <div className="border-t border-border/70 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>System Status: Operational</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">● 99.99% Uptime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-border py-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="text-[11px]">© {new Date().getFullYear()} Northstar Compliance Systems.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-foreground">
              Sign In
            </Link>
            <Link href="/accept-invite" className="hover:text-foreground">
              Accept Invite
            </Link>
            <a href="mailto:compliance@northstar.com" className="hover:text-foreground">
              Contact Support
            </a>
          </div>
        </div>
      </footer>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Register Organization Workspace</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateWorkspace} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Company / Firm Name</label>
                <input
                  type="text"
                  required
                  value={createWsName}
                  onChange={(e) => {
                    setCreateWsName(e.target.value);
                    if (!createWsSlug) {
                      setCreateWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }
                  }}
                  placeholder="e.g. Apex Wealth Management"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Workspace URL Slug</label>
                <div className="flex items-center rounded-xl border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <span className="text-muted-foreground font-mono mr-1">app.com/</span>
                  <input
                    type="text"
                    required
                    value={createWsSlug}
                    onChange={(e) => setCreateWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="apex-wealth"
                    className="w-full bg-transparent text-foreground font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Primary Administrator Name</label>
                <input
                  type="text"
                  required
                  value={createAdminName}
                  onChange={(e) => setCreateAdminName(e.target.value)}
                  placeholder="Jordan Davis, CFA"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Administrator Email</label>
                <input
                  type="email"
                  required
                  value={createAdminEmail}
                  onChange={(e) => setCreateAdminEmail(e.target.value)}
                  placeholder="admin@firm.com"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Master Password</label>
                <div className="relative">
                  <input
                    type={showCreatePass ? "text" : "password"}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Min 8 chars, uppercase, lowercase, number, symbol"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 pr-9 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePass(!showCreatePass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCreatePass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {createLoading ? "Provisioning Workspace..." : "Create Organization & Enter Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
