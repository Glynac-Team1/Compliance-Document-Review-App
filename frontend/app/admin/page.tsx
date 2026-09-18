"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Copy,
  Check,
  KeyRound,
  Trash2,
  LogOut,
  ShieldAlert,
  XCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  workspace_name: string;
  workspace_slug: string;
  token: string;
  invite_url: string;
  expires_at: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  created_at: string;
  slug: string;
}

interface CurrentUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  slug: string;
  workspace_name: string;
  workspace_slug: string;
  is_admin: boolean;
}

export default function AdminConsolePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advisor" | "officer">("advisor");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [latestInvite, setLatestInvite] = useState<{ email: string; token: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"invite" | "team">("invite");

  async function fetchWorkspaceData(token: string) {
    try {
      const [invRes, teamRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/admin/invitations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiBaseUrl()}/admin/team`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData.team || []);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  }

  async function verifyAuthAndInit() {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const meRes = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meRes.ok) {
        localStorage.removeItem("auth_token");
        router.push("/login");
        return;
      }

      const meData = await meRes.json();
      setCurrentUser(meData);

      if (!meData.is_admin) {
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      setIsAdmin(true);
      setCheckingAuth(false);
      await fetchWorkspaceData(token);
    } catch (err) {
      console.error("Auth verification failed:", err);
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    verifyAuthAndInit();
  }, []);

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const token = localStorage.getItem("auth_token");
    const workspaceSlug = currentUser?.workspace_slug || localStorage.getItem("last_workspace_slug") || "northstar";

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          workspace_slug: workspaceSlug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to issue invitation.");
      }

      setFeedback({
        type: "success",
        message: `Invitation email dispatched to ${email}! The employee will receive a secure onboarding link to accept the invite and set their password.`,
      });
      setLatestInvite({
        email: email.trim().toLowerCase(),
        token: data.token,
        role: data.role,
      });
      setEmail("");
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to send invitation.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeInvite(invitationId: string, inviteeEmail: string) {
    if (!confirm(`Are you sure you want to revoke the invitation for ${inviteeEmail}? They will no longer be able to onboard.`)) {
      return;
    }
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setActionInProgress(invitationId);
    setFeedback(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations/${invitationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to revoke invitation.");
      }

      setFeedback({
        type: "success",
        message: `Invitation for ${inviteeEmail} was revoked.`,
      });
      await fetchWorkspaceData(token);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to revoke invitation.",
      });
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string, memberEmail: string) {
    if (!confirm(`Are you sure you want to remove ${memberName} (${memberEmail}) from this workspace? They will lose access immediately.`)) {
      return;
    }
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setActionInProgress(memberId);
    setFeedback(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/team/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to remove member.");
      }

      setFeedback({
        type: "success",
        message: `${memberName} has been removed from the workspace.`,
      });
      await fetchWorkspaceData(token);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to remove member.",
      });
    } finally {
      setActionInProgress(null);
    }
  }

  function handleSignOut() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_slug");
    router.push("/");
  }

  function handleLogoClick() {
    if (currentUser?.role === "officer" && currentUser?.slug) {
      router.push(`/compliance-officer/${currentUser.slug}`);
    } else if (currentUser?.role === "advisor" && currentUser?.slug) {
      router.push(`/advisor/${currentUser.slug}`);
    } else {
      router.push("/");
    }
  }

  function copyInviteLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Verifying administrator credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="relative isolate min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-destructive/10 blur-3xl"
        />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="size-7" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">
            Administrator Privileges Required
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            The workspace administration console is restricted to designated compliance administrators. Your current account (<span className="font-semibold text-foreground font-mono">{currentUser?.email}</span>) does not have administrative rights for <strong className="text-foreground">{currentUser?.workspace_name || "this workspace"}</strong>.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleLogoClick}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
            >
              Return to Workspace Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="w-full rounded-xl border border-border py-2.5 text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer"
            >
              Sign Out / Switch Administrator Account
            </button>
            <button
              onClick={() => {
                handleSignOut();
                router.push("/?tab=create");
              }}
              className="w-full text-center text-xs font-semibold text-primary hover:underline cursor-pointer pt-1"
            >
              Launch a New Organization Workspace →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 overflow-x-hidden">
      {/* Subtle Transparent Blue Accents for Professional Institutional Depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[680px] rounded-full bg-blue-500/10 blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -right-40 size-[500px] rounded-full bg-sky-500/10 blur-3xl -z-10"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 text-left group hover:opacity-90 transition cursor-pointer"
              title="Return to your role workspace"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-foreground text-sm block leading-none">
                  {currentUser?.workspace_name || "Northstar Compliance"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                  app.compliance/{currentUser?.workspace_slug || "workspace"}
                </span>
              </div>
            </button>
            <span className="hidden sm:inline-block h-4 w-px bg-border/80" />
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <KeyRound className="size-3" /> Admin Console
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tab switch */}
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1">
              <button
                onClick={() => setActiveTab("invite")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "invite"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Invitations ({invitations.length})
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "team"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Team Directory ({team.length})
              </button>
            </div>

            {/* Direct Dashboard Link */}
            <button
              onClick={handleLogoClick}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer shadow-sm"
            >
              <span>{currentUser?.role === "officer" ? "Review Queue" : "Advisor Space"}</span>
              <ArrowRight className="size-3.5" />
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-destructive transition cursor-pointer"
              title="Sign out of workspace"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 w-full space-y-6">
        {/* Executive Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Workspace Organization
            </span>
            <p className="text-sm font-bold text-foreground mt-1 truncate">
              {currentUser?.workspace_name}
            </p>
            <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Operational
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Active Directory
            </span>
            <p className="text-sm font-bold text-foreground mt-1">
              {team.length} {team.length === 1 ? "Member" : "Members"}
            </p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              {team.filter((m) => m.is_admin).length} Administrator
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Pending Onboarding
            </span>
            <p className="text-sm font-bold text-foreground mt-1">
              {invitations.filter((i) => i.status === "pending").length} Invitations
            </p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              7-day token expiration
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Access Architecture
            </span>
            <p className="text-sm font-bold text-foreground mt-1">
              Role Segregation
            </p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Invite-First Zero-Trust
            </span>
          </div>
        </div>

        {/* Clean State Welcome Card (Displayed when workspace is freshly created) */}
        {invitations.length === 0 && (
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.05] via-primary/[0.02] to-transparent p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-2">
                  <Sparkles className="size-3.5" /> Workspace Initialized
                </div>
                <h2 className="text-base font-bold text-foreground">
                  Welcome to {currentUser?.workspace_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                  Your organization workspace is provisioned. As primary administrator, dispatch onboarding invitations below to assign locked roles for your team.
                </p>
              </div>
              <button
                onClick={() => {
                  const input = document.getElementById("invite-email-input");
                  if (input) input.focus();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm shrink-0 cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Invite First Team Member</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-xs">
              <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 space-y-1">
                <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="size-4" /> Compliance Officers
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Pre-assign compliance officers to grant review queue access, document approval/rejection authority, and immutable FINRA/SEC audit log inspection.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 space-y-1">
                <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Users className="size-4" /> Financial Advisors
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Pre-assign advisors to allow drafting client presentations, running machine-verified policy scans, and submitting materials for compliance sign-off.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`rounded-2xl border p-4 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{feedback.message}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {latestInvite && (
                <>
                  <a
                    href={`/accept-invite?token=${latestInvite.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Test Onboarding Link</span>
                  </a>
                  <button
                    onClick={() => copyInviteLink(latestInvite.token)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    {copiedToken === latestInvite.token ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>Copy</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setFeedback(null)}
                className="text-muted-foreground hover:text-foreground font-bold px-2 py-1 cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {activeTab === "invite" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invite Form */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserPlus className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Invite Team Member</h2>
                    <p className="text-[11px] text-muted-foreground">Pre-assign a locked workspace role</p>
                  </div>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Employee Corporate Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        id="invite-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="colleague@firm.com"
                        className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Pre-assigned Workspace Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("advisor")}
                        className={`rounded-xl border p-2.5 text-left text-xs transition cursor-pointer ${
                          role === "advisor"
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="font-semibold text-foreground">Advisor</div>
                        <div className="text-[10px] text-muted-foreground">Drafts materials & scans</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRole("officer")}
                        className={`rounded-xl border p-2.5 text-left text-xs transition cursor-pointer ${
                          role === "officer"
                            ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold ring-1 ring-amber-500"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="font-semibold text-foreground">Officer</div>
                        <div className="text-[10px] text-muted-foreground">Review & approval queue</div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Dispatching Invitation..." : "Send Secure Invitation Link →"}
                  </button>
                </form>
              </div>
            </div>

            {/* Invitations List */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Sent Invitations ({invitations.length})
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Cryptographic single-use invitations with 7-day TTL
                    </p>
                  </div>
                </div>

                {invitations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Mail className="size-6" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">No pending invitations</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                      Use the invitation form to onboard your compliance officers and financial advisors.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invitations.map((inv) => {
                      const isPending = inv.status === "pending";
                      const isAccepted = inv.status === "accepted";
                      const isRevoked = inv.status === "revoked";
                      const isOfficer = inv.role.toLowerCase() === "officer";

                      return (
                        <div
                          key={inv.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 text-xs transition ${
                            isRevoked
                              ? "border-border/40 bg-muted/10 opacity-60"
                              : "border-border/70 bg-muted/20 hover:border-border"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{inv.email}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  isOfficer
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {isOfficer ? "Officer" : "Advisor"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  isAccepted
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : isRevoked
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>Sent: {new Date(inv.created_at).toLocaleDateString()}</span>
                              <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2">
                              <a
                                href={`/accept-invite?token=${inv.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
                                title="Open invitation link to test user onboarding flow"
                              >
                                <ExternalLink className="size-3.5" />
                                <span>Test Email Link</span>
                              </a>
                              <button
                                onClick={() => copyInviteLink(inv.token)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer"
                              >
                                {copiedToken === inv.token ? (
                                  <>
                                    <Check className="size-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleRevokeInvite(inv.id, inv.email)}
                                disabled={actionInProgress === inv.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15 transition disabled:opacity-50 cursor-pointer"
                                title="Revoke invitation"
                              >
                                <XCircle className="size-3.5" />
                                <span>{actionInProgress === inv.id ? "Revoking..." : "Revoke"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Team Directory Tab */
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Active Workspace Members ({team.length})
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Live membership directory for {currentUser?.workspace_name}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Access Level</th>
                    <th className="pb-3 font-semibold">Joined</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {team.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    const isOfficer = member.role.toLowerCase() === "officer";

                    return (
                      <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 font-semibold text-foreground">
                          {member.name}
                          {isSelf && (
                            <span className="ml-2 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                              You (Admin)
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground font-mono">{member.email}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              isOfficer
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3">
                          {member.is_admin ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                              <KeyRound className="size-3" /> Administrator
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Standard Member</span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          {isSelf ? (
                            <span className="text-[11px] text-muted-foreground italic">
                              Workspace Owner
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name, member.email)}
                              disabled={actionInProgress === member.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/15 transition disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                              <span>{actionInProgress === member.id ? "Removing..." : "Remove"}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
