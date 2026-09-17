"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Users,
  Copy,
  Check,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Building,
  Sparkles,
  KeyRound,
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

export default function AdminConsolePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advisor" | "officer">("advisor");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invite" | "team">("invite");

  async function loadData() {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/");
      return;
    }

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

  useEffect(() => {
    loadData();
  }, []);

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const token = localStorage.getItem("auth_token");
    const workspaceSlug = localStorage.getItem("last_workspace_slug") || "northstar";

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
        message: `Invitation generated for ${email}! Copy the onboarding link below to share.`,
      });
      setEmail("");
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to send invitation.",
      });
    } finally {
      setLoading(false);
    }
  }

  function copyInviteLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  const userRole = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  const userSlug = typeof window !== "undefined" ? localStorage.getItem("user_slug") : "workspace";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (userRole === "officer") {
                  router.push(`/compliance-officer/${userSlug}`);
                } else {
                  router.push(`/advisor/${userSlug}`);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <span className="font-bold tracking-tight text-foreground text-sm">
                Northstar Compliance
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Workspace Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("invite")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "invite"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Invitations ({invitations.length})
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "team"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Team Roster ({team.length})
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Banner */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Enterprise Workspace Onboarding
              </h1>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Roles are strictly assigned by company administrators. Employees receive a secure invitation link, configure their credentials, and join with pre-assigned permissions.
              </p>
            </div>
          </div>
        </div>

        {activeTab === "invite" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Invite Form */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserPlus className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Invite New Employee</h2>
                    <p className="text-[11px] text-muted-foreground">Assign a locked organizational role</p>
                  </div>
                </div>

                {feedback && (
                  <div
                    className={`mb-4 rounded-xl border p-3 text-xs font-medium ${
                      feedback.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-destructive/20 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Employee Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="employee@company.com"
                        className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Pre-assigned Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("advisor")}
                        className={`rounded-xl border p-2.5 text-left text-xs transition ${
                          role === "advisor"
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="font-semibold text-foreground">Advisor</div>
                        <div className="text-[10px] text-muted-foreground">Submit documents</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRole("officer")}
                        className={`rounded-xl border p-2.5 text-left text-xs transition ${
                          role === "officer"
                            ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="font-semibold text-foreground">Officer</div>
                        <div className="text-[10px] text-muted-foreground">Review & approve</div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? "Generating Secure Link..." : "Create Invitation Link"}
                  </button>
                </form>
              </div>
            </div>

            {/* Invitations List */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-bold text-foreground mb-4">
                  Sent Invitations ({invitations.length})
                </h2>

                {invitations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No invitations have been generated yet. Use the form to invite your first employee.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invitations.map((inv) => {
                      const isPending = inv.status === "pending";
                      const isAccepted = inv.status === "accepted";
                      const isOfficer = inv.role.toLowerCase() === "officer";

                      return (
                        <div
                          key={inv.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs transition hover:border-border"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
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
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>Created: {new Date(inv.created_at).toLocaleDateString()}</span>
                              <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {isPending && (
                            <button
                              onClick={() => copyInviteLink(inv.token)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              {copiedToken === inv.token ? (
                                <>
                                  <Check className="size-3.5 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  <span>Copy Invite Link</span>
                                </>
                              )}
                            </button>
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
          /* Team Roster Tab */
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-4">
              Active Workspace Members ({team.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Access Level</th>
                    <th className="pb-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {team.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30">
                      <td className="py-3 font-semibold text-foreground">{member.name}</td>
                      <td className="py-3 text-muted-foreground">{member.email}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            member.role.toLowerCase() === "officer"
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
                            <KeyRound className="size-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Member</span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
