"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  UserPlus,
  Search,
  Check,
  Activity,
  AlertCircle,
} from "lucide-react";
import { getApiBaseUrl, formatApiError } from "@/lib/api";

function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 transition hover:opacity-90">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-foreground">Northstar</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Compliance</p>
      </div>
    </Link>
  );
}

function LeftBrandedBrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 transition hover:opacity-90">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground shadow-lg">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-primary-foreground">
          Northstar
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
          Compliance
        </p>
      </div>
    </Link>
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

export default function CreateWorkspacePage() {
  const router = useRouter();

  // Active tab: 'create' | 'lookup'
  const [activeTab, setActiveTab] = useState<"create" | "lookup">("create");

  // Create Workspace Form State
  const [createWsName, setCreateWsName] = useState("");
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

  async function handleCreateWorkspace(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);

    // Client-side password policy validation
    if (createPassword.length < 8) {
      setCreateError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(createPassword)) {
      setCreateError("Password must contain at least one uppercase letter (A-Z).");
      return;
    }
    if (!/[a-z]/.test(createPassword)) {
      setCreateError("Password must contain at least one lowercase letter (a-z).");
      return;
    }
    if (!/\d/.test(createPassword)) {
      setCreateError("Password must contain at least one number (0-9).");
      return;
    }
    if (!/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(createPassword)) {
      setCreateError("Password must contain at least one special symbol (!@#$%^&*...).");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_name: createWsName.trim(),
          workspace_slug: null,
          admin_name: createAdminName.trim(),
          admin_email: createAdminEmail.trim().toLowerCase(),
          admin_password: createPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to register workspace."));
      }

      // Automatically authenticate the master administrator
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_role", data.role || "admin");
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("user_email", data.email);
      localStorage.setItem("user_slug", data.slug);
      localStorage.setItem("last_workspace_slug", data.workspace_slug);
      localStorage.setItem("workspace_name", data.workspace_name);
      localStorage.setItem("is_admin", "true");
      sessionStorage.setItem("admin_authenticated", "true");

      router.push("/admin");
    } catch (err: any) {
      setCreateError(err instanceof Error ? err.message : formatApiError(err, "Failed to create workspace."));
    } finally {
      setCreateLoading(false);
    }
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
    } catch {
      setLookupResult({
        found: false,
        message: "Unable to connect to discovery service. Please verify your connection.",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  const passStrength = getPasswordStrength(createPassword);

  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Left Branded Hero Section (Visible on lg and up) */}
      <section className="relative hidden min-h-screen flex-1 flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground lg:flex xl:p-12 selection:bg-white/20">
        {/* Ambient Grid and Orbital Circles */}
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="pointer-events-none absolute -right-20 top-1/4 size-96 rounded-full border border-primary-foreground/15 animate-float-slow" />
        <div className="pointer-events-none absolute -right-4 top-[32%] size-64 rounded-full border border-primary-foreground/15 animate-float-reverse" />
        <div className="pointer-events-none absolute top-1/3 -right-10 size-80 rounded-full bg-blue-400/20 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute bottom-12 left-10 size-72 rounded-full bg-indigo-500/20 blur-2xl" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center justify-between">
          <LeftBrandedBrandMark />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/80 hover:text-primary-foreground transition"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Central Narrative */}
        <div className="relative z-10 max-w-xl pb-8 xl:pb-16">
          <h1 className="text-balance text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
            Set up your firm&apos;s institutional workspace.
          </h1>

          <p className="mt-5 text-sm sm:text-base leading-relaxed text-primary-foreground/80 max-w-lg">
            Create a dedicated workspace for your team to review documents, manage members, and maintain compliance records.
          </p>

          <div className="mt-8 flex flex-col gap-3 text-xs text-primary-foreground/85">
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-300 shrink-0" strokeWidth={2.4} />
              <span>Centralized administrator controls & audit history</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-300 shrink-0" strokeWidth={2.4} />
              <span>Direct email invitations for team members</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-300 shrink-0" strokeWidth={2.4} />
              <span>Real-time review status updates</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-300 shrink-0" strokeWidth={2.4} />
              <span>Private workspace dedicated to your organization</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-primary-foreground/60 border-t border-primary-foreground/15 pt-4">
          <p>&copy; {new Date().getFullYear()} Northstar Compliance Systems. Enterprise Edition.</p>
          <div className="flex items-center gap-1.5 font-medium">
            <Activity className="size-3 text-emerald-400" />
            <span>Systems Normal</span>
          </div>
        </div>
      </section>

      {/* Right Form Section */}
      <section className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-5 py-10 sm:px-8 lg:w-[50%] lg:min-w-[520px] xl:w-[48%] overflow-y-auto">
        <div className="w-full max-w-[460px] py-4">
          {/* Mobile Navigation Header */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <BrandMark />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="size-3.5" />
              <span>Home</span>
            </Link>
          </div>

          {/* Desktop Back / Sign In Bar */}
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Home</span>
            </Link>
            <Link
              href="/login"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Already registered? Sign In &rarr;
            </Link>
          </div>

          {/* Card Container */}
          <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-primary/[0.04] transition-all">
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
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    Register Organization Workspace
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your organization and administrator details to get started.
                  </p>
                </div>

                {createError && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateError(null)}
                      className="font-bold opacity-70 hover:opacity-100 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <form onSubmit={handleCreateWorkspace} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-foreground mb-1.5">
                      Firm / Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={createWsName}
                      onChange={(e) => setCreateWsName(e.target.value)}
                      placeholder="e.g. Apex Wealth Partners"
                      className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-foreground mb-1.5">
                        Administrator Name
                      </label>
                      <input
                        type="text"
                        required
                        value={createAdminName}
                        onChange={(e) => setCreateAdminName(e.target.value)}
                        placeholder="Alex Morgan, CCO"
                        className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1.5">
                        Corporate Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={createAdminEmail}
                        onChange={(e) => setCreateAdminEmail(e.target.value)}
                        placeholder="alex@apexwealth.com"
                        className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
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
                        placeholder="Min 8 chars, mixed case, number, symbol"
                        className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 pr-10 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePass(!showCreatePass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {createLoading ? "Provisioning Organization..." : "Launch Organization Workspace →"}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border/60 text-center text-[11px] text-muted-foreground">
                    Already have a registered workspace?{" "}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                      Sign In
                    </Link>
                  </div>
                </form>
              </div>
            ) : (
              /* 2. Find Existing Workspace Tab */
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    Find Your Organization Workspace
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your work email to discover which workspace you belong to or accept a pending invitation.
                  </p>
                </div>

                <form onSubmit={handleLookupWorkspace} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Corporate Work Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={lookupEmail}
                        onChange={(e) => setLookupEmail(e.target.value)}
                        placeholder="colleague@firm.com"
                        className="w-full rounded-xl border border-input bg-background/80 pl-10 pr-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
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
      </section>
    </main>
  );
}
