"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowRight,
  Users,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Building2,
  X,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { getApiBaseUrl, formatApiError } from "@/lib/api";

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
  access_level?: string;
  created_at: string;
  slug: string;
}
interface SupportRequestItem {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  advisor_id: string;
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

  // Admin Sign-In Form State (for unauthenticated or non-admin visitors)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Admin Console State
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advisor" | "officer">("advisor");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invite" | "team" | "support">("invite");
  const [supportRequests, setSupportRequests] = useState<SupportRequestItem[]>([]);
  const [updatingSupportId, setUpdatingSupportId] = useState<string | null>(null);

  // Interactive Toast State
  const [toast, setToast] = useState<{
    id: string;
    type: "confirm" | "success" | "error" | "info";
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: "destructive" | "primary";
    onConfirm?: () => void;
  } | null>(null);

  useEffect(() => {
    if (toast && (toast.type === "success" || toast.type === "info")) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [modalEmail, setModalEmail] = useState("");
  const [modalRole, setModalRole] = useState<"advisor" | "officer">("advisor");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccessInvite, setModalSuccessInvite] = useState<{
    email: string;
    token: string;
    role: string;
  } | null>(null);

  function handleTriggerInvite() {
    setModalEmail("");
    setModalRole("advisor");
    setModalError("");
    setModalSuccessInvite(null);
    setIsInviteModalOpen(true);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsInviteModalOpen(false);
      }
    }
    if (isInviteModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isInviteModalOpen]);

  async function fetchWorkspaceData(token: string) {
    try {
      const [invRes, teamRes, supportRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/admin/invitations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiBaseUrl()}/admin/team`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiBaseUrl()}/support/admin/requests`, {
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
      if (supportRes.ok) {
        const supportData = await supportRes.json();
        setSupportRequests(supportData || []);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  }

  async function verifyAuthAndInit() {
    const adminActive = sessionStorage.getItem("admin_authenticated");
    const token = localStorage.getItem("auth_token");
    if (adminActive !== "true" || !token) {
      setIsAdmin(false);
      setCheckingAuth(false);
      return;
    }

    try {
      const meRes = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meRes.ok) {
        sessionStorage.removeItem("admin_authenticated");
        localStorage.removeItem("auth_token");
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      const meData = await meRes.json();
      setCurrentUser(meData);

      if (!meData.is_admin) {
        sessionStorage.removeItem("admin_authenticated");
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      setIsAdmin(true);
      setCheckingAuth(false);
      await fetchWorkspaceData(token);
    } catch (err) {
      console.error("Auth verification failed:", err);
      sessionStorage.removeItem("admin_authenticated");
      setIsAdmin(false);
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    verifyAuthAndInit();
  }, []);

  // Real-time synchronization: poll workspace data every 8s and when window gains focus
  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const interval = setInterval(() => {
      fetchWorkspaceData(token);
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchWorkspaceData(token);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [isAdmin]);

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Authentication failed. Please check your email and password."));
      }

      if (!data.is_admin) {
        throw new Error(
          `Account '${loginEmail}' does not have administrative rights for ${data.workspace_name || "this workspace"}.`
        );
      }

      sessionStorage.setItem("admin_authenticated", "true");
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("is_admin", "true");
      if (data.role) localStorage.setItem("user_role", data.role);
      if (data.slug) localStorage.setItem("user_slug", data.slug);
      if (data.workspace_slug) localStorage.setItem("last_workspace_slug", data.workspace_slug);
      if (data.workspace_name) localStorage.setItem("workspace_name", data.workspace_name);

      setCurrentUser(data);
      setIsAdmin(true);
      setLoginPassword("");
      await fetchWorkspaceData(data.token);
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate administrator.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const token = localStorage.getItem("auth_token");
    const workspaceSlug = currentUser?.workspace_slug;

    if (!workspaceSlug) {
      setFeedback({
        type: "error",
        message: "Workspace not resolved. Please refresh or sign in again.",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          role,
          workspace_slug: workspaceSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to dispatch invitation."));
      }

      setFeedback({
        type: "success",
        message: `Invitation email dispatched via Brevo to ${email}! The employee will receive a secure onboarding link to activate their account.`,
      });
      setEmail("");
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred while sending the invitation.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleModalInvite(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);

    const token = localStorage.getItem("auth_token");
    const workspaceSlug = currentUser?.workspace_slug;

    if (!workspaceSlug) {
      setModalError("Workspace not resolved. Please refresh or sign in again.");
      setModalLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: modalEmail.trim(),
          role: modalRole,
          workspace_slug: workspaceSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to dispatch invitation."));
      }

      setModalSuccessInvite({
        email: modalEmail.trim(),
        token: data.token,
        role: modalRole,
      });
      setFeedback({
        type: "success",
        message: `Invitation email dispatched via Brevo to ${modalEmail.trim()}! The employee will receive a secure onboarding link to activate their account.`,
      });
      setModalEmail("");
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred while sending the invitation.");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleResendInvite(invitationId: string, inviteEmail: string) {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setResendingId(invitationId);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations/${invitationId}/resend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to resend invitation email."));
      }

      setToast({
        id: `resend-success-${invitationId}`,
        type: "success",
        title: "Invitation Email Resent",
        message: `A fresh invitation email has been dispatched via Brevo to ${inviteEmail}.`,
      });
      await fetchWorkspaceData(token);
    } catch (err: any) {
      setToast({
        id: `resend-error-${invitationId}`,
        type: "error",
        title: "Resend Failed",
        message: err.message || "An unexpected error occurred while resending the email.",
      });
    } finally {
      setResendingId(null);
    }
  }

  function promptRevokeInvite(invitationId: string, inviteEmail: string) {
    setToast({
      id: `revoke-${invitationId}`,
      type: "confirm",
      title: "Revoke Onboarding Invitation",
      message: `Are you sure you want to revoke the onboarding invitation for ${inviteEmail}?`,
      confirmLabel: "Revoke Invitation",
      confirmVariant: "destructive",
      onConfirm: () => executeRevokeInvite(invitationId, inviteEmail),
    });
  }

  async function executeRevokeInvite(invitationId: string, inviteEmail: string) {
    setActionInProgress(invitationId);
    setToast(null);
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/invitations/${invitationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to revoke invitation."));
      }

      setToast({
        id: `revoke-success-${invitationId}`,
        type: "success",
        title: "Invitation Revoked",
        message: `Invitation for ${inviteEmail} was successfully revoked.`,
      });
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setToast({
        id: `revoke-error-${invitationId}`,
        type: "error",
        title: "Revocation Failed",
        message: err.message || "Failed to revoke invitation.",
      });
    } finally {
      setActionInProgress(null);
    }
  }

  function promptRemoveMember(memberId: string, memberName: string, memberEmail: string) {
    setToast({
      id: `remove-${memberId}`,
      type: "confirm",
      title: "Remove Team Member",
      message: `Are you sure you want to remove ${memberName} (${memberEmail}) from the workspace? They will immediately lose access.`,
      confirmLabel: "Remove Member",
      confirmVariant: "destructive",
      onConfirm: () => executeRemoveMember(memberId, memberName, memberEmail),
    });
  }

  async function executeRemoveMember(memberId: string, memberName: string, memberEmail: string) {
    setActionInProgress(memberId);
    setToast(null);
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/team/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to remove team member."));
      }

      setToast({
        id: `remove-success-${memberId}`,
        type: "success",
        title: "Member Removed",
        message: `${memberName} was removed from the workspace directory.`,
      });
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setToast({
        id: `remove-error-${memberId}`,
        type: "error",
        title: "Removal Failed",
        message: err.message || "Failed to remove member.",
      });
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleUpdateSupportStatus(requestId: string, newStatus: string) {
    setUpdatingSupportId(requestId);
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${getApiBaseUrl()}/support/admin/requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to update request status."));
      }

      setSupportRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      setToast({
        id: `support-update-error-${requestId}`,
        type: "error",
        title: "Update Failed",
        message: err.message || "Failed to update the request status.",
      });
    } finally {
      setUpdatingSupportId(null);
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem("admin_authenticated");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("is_admin");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_slug");
    setCurrentUser(null);
    setIsAdmin(false);
    setInvitations([]);
    setTeam([]);
    setFeedback(null);
    setLoginPassword("");
  }

  function copyInviteLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  // 1. Loading Authentication State
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

  // 2. Unauthenticated or Non-Admin State -> Administrator Login Screen
  if (!isAdmin) {
    return (
      <div className="relative isolate min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden selection:bg-primary/20">
        {/* Subtle Background Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-blue-500/10 blur-3xl -z-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-1/4 size-[400px] rounded-full bg-indigo-500/10 blur-3xl -z-10"
        />

        <div className="relative z-10 w-full max-w-md">
          {/* Card Branding */}
          <div className="rounded-2xl border border-border bg-card p-7 sm:p-9 shadow-xl shadow-primary/[0.03]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">
                    Administrator Portal
                  </h1>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
                    Compliance Console
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                <KeyRound className="size-3" /> Admin Auth
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Sign in to Admin Console
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                This administrative console is strictly reserved for workspace administrators to manage invitations, team directories, and access policies.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Admin Login Form */}
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Corporate administrator email
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3.5 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Master password
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    required
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loginLoading}
                className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-75 cursor-pointer"
              >
                {loginLoading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                ) : (
                  <>
                    <span>Authenticate as Administrator</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Context Navigation Links */}
            <div className="mt-6 pt-5 border-t border-border flex flex-col gap-2.5 text-center text-xs">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-primary transition font-medium"
              >
                Looking for employee workspace? Go to Advisor / Officer Sign In →
              </Link>
              <Link
                href="/"
                className="text-[11px] text-muted-foreground hover:underline"
              >
                Launch a New Organization Workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Administrator Console
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 overflow-x-hidden">
      {/* Subtle Transparent Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[680px] rounded-full bg-blue-500/10 blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -right-40 size-[500px] rounded-full bg-sky-500/10 blur-3xl -z-10"
      />

      {/* Top Header (Strictly Administrative - No Dashboard Links) */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 text-left">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-foreground text-sm block leading-none">
                  {currentUser?.workspace_name}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mt-1 font-medium">
                  Workspace Administration
                </span>
              </div>
            </div>
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
              <button
                onClick={() => setActiveTab("support")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "support"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Support ({supportRequests.length})
              </button>
            </div>

            {/* Quick Invite Button */}
            <button
              type="button"
              onClick={handleTriggerInvite}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition cursor-pointer"
            >
              <UserPlus className="size-3.5" />
              <span className="hidden sm:inline">Invite Member</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-destructive transition cursor-pointer"
              title="Sign out of administrator console"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 w-full space-y-6">
        {/* Real Dynamic Overview Stats */}
        {(() => {
          const pendingCount = invitations.filter((i) => i.status?.toLowerCase() === "pending").length;
          const acceptedCount = invitations.filter((i) => i.status?.toLowerCase() === "accepted").length;
          const revokedCount = invitations.filter((i) => i.status?.toLowerCase() === "revoked").length;
          const officerCount = team.filter((m) => m.role?.toLowerCase() === "officer").length;
          const advisorCount = team.filter((m) => m.role?.toLowerCase() === "advisor").length;

          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Workspace
                </span>
                <p className="text-sm font-bold text-foreground mt-1 truncate">
                  {currentUser?.workspace_name || "Workspace"}
                </p>
                <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Workspace
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
                  {advisorCount} {advisorCount === 1 ? "Advisor" : "Advisors"}, {officerCount} {officerCount === 1 ? "Officer" : "Officers"}
                </span>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Pending Onboarding
                </span>
                <p className="text-sm font-bold text-foreground mt-1">
                  {pendingCount} {pendingCount === 1 ? "Invitation" : "Invitations"}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {acceptedCount > 0 || revokedCount > 0
                    ? `${acceptedCount} accepted, ${revokedCount} revoked`
                    : "Awaiting employee acceptance"}
                </span>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Compliance Officers
                </span>
                <p className="text-sm font-bold text-foreground mt-1">
                  {officerCount} {officerCount === 1 ? "Officer" : "Officers"}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {team.filter((m) => m.is_admin).length === 1 ? "1 Administrator" : `${team.filter((m) => m.is_admin).length} Administrators`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Clean State Welcome Card (Displayed when no invitations sent yet) */}
        {invitations.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary mb-2">
                  <Building2 className="size-3.5" />
                  <span>Workspace Initialized</span>
                </div>
                <h2 className="text-base font-bold text-foreground">
                  Welcome to {currentUser?.workspace_name || "Workspace"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                  Your organization workspace is provisioned. As primary administrator, invite compliance officers and financial advisors to begin reviewing and submitting documents.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerInvite}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm shrink-0 cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Invite First Team Member</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-xs">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="size-4" /> Compliance Officers
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Review queue access, document approval/rejection authority, and SEC/FINRA audit log inspection.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Users className="size-4" /> Financial Advisors
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Draft client communications, run pre-submission compliance checks, and track review status.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-150 ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition cursor-pointer text-xs"
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Tab Content */}
        {activeTab === "invite" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invite Dispatch Panel */}
            <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  Invite Team Member
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                Invite a colleague by work email and assign their functional role in this workspace.
              </p>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-email-input"
                    className="block text-xs font-semibold text-foreground mb-1.5"
                  >
                    Work email address
                  </label>
                  <input
                    id="invite-email-input"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Assigned role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("advisor")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                        role === "advisor"
                          ? "border-primary bg-primary/[0.06] text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <Users className="size-4 mb-1" />
                      <div className="font-semibold text-foreground text-xs">Advisor</div>
                      <div className="text-[10px] text-muted-foreground">Draft & submit</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("officer")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                        role === "officer"
                          ? "border-primary bg-primary/[0.06] text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <ShieldCheck className="size-4 mb-1" />
                      <div className="font-semibold text-foreground text-xs">Officer</div>
                      <div className="text-[10px] text-muted-foreground">Review & approve</div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Sending Invitation..." : "Send Invitation Link →"}
                </button>
              </form>
            </div>

            {/* Sent Invitations Table */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Invitations ({invitations.length})
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Manage active, accepted, and revoked onboarding invitations
                    </p>
                  </div>
                </div>

                {invitations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Mail className="size-6" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">No invitations yet</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                      Use the invitation form to onboard compliance officers and financial advisors to {currentUser?.workspace_name || "your workspace"}.
                    </p>
                    <button
                      type="button"
                      onClick={handleTriggerInvite}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Invite First Team Member</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invitations.map((inv) => {
                      const isPending = inv.status.toLowerCase() === "pending";
                      const isAccepted = inv.status.toLowerCase() === "accepted";
                      const isRevoked = inv.status.toLowerCase() === "revoked";
                      const isOfficer = inv.role.toLowerCase() === "officer";

                      return (
                        <div
                          key={inv.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-background/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground font-mono">
                                {inv.email}
                              </span>
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
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isAccepted
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : isRevoked
                                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {isRevoked ? "Revoked (Token Inactive)" : inv.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                              <span>Sent: {new Date(inv.created_at).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                              {isRevoked && (
                                <span className="text-destructive font-medium">• Access Link Disabled</span>
                              )}
                            </div>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                onClick={() => handleResendInvite(inv.id, inv.email)}
                                disabled={resendingId === inv.id || actionInProgress === inv.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition disabled:opacity-50 cursor-pointer"
                                title="Resend invitation email via Brevo"
                              >
                                {resendingId === inv.id ? (
                                  <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Sending...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="size-3.5" />
                                    <span>Resend Email</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => copyInviteLink(inv.token)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                                title="Copy onboarding link"
                              >
                                {copiedToken === inv.token ? (
                                  <>
                                    <Check className="size-3.5 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => promptRevokeInvite(inv.id, inv.email)}
                                disabled={actionInProgress === inv.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15 transition disabled:opacity-50 cursor-pointer"
                                title="Revoke invitation"
                              >
                                <XCircle className="size-3.5" />
                                <span>{actionInProgress === inv.id ? "Revoking..." : "Revoke"}</span>
                              </button>
                            </div>
                          )}

                          {isRevoked && (
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                onClick={() => promptRevokeInvite(inv.id, inv.email)}
                                disabled={actionInProgress === inv.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15 transition disabled:opacity-50 cursor-pointer"
                                title="Permanently delete this revoked invitation record"
                              >
                                <Trash2 className="size-3.5" />
                                <span>{actionInProgress === inv.id ? "Purging..." : "Purge Record"}</span>
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                            {member.is_admin && <KeyRound className="size-3 text-primary" />}
                            <span>
                              {member.access_level ||
                                (member.is_admin
                                  ? "Workspace Administrator"
                                  : member.role?.toLowerCase() === "officer"
                                  ? "Compliance Officer"
                                  : "Financial Advisor")}
                            </span>
                          </span>
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
                              onClick={() => promptRemoveMember(member.id, member.name, member.email)}
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

        {activeTab === "support" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Support Requests ({supportRequests.length})
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Tickets submitted by advisors in {currentUser?.workspace_name}
                </p>
              </div>
            </div>

            {supportRequests.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                  <Mail className="size-6" />
                </div>
                <p className="text-xs font-semibold text-foreground">No support requests yet</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                  Tickets submitted by advisors will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {supportRequests.map((req) => {
                  const statusColor =
                    req.status === "resolved"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : req.status === "in_progress"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400";

                  return (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-background/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground">{req.subject}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                            {req.category.replace("_", " ")}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
                            {req.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground max-w-xl">{req.message}</p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <select
                          value={req.status}
                          disabled={updatingSupportId === req.id}
                          onChange={(e) => handleUpdateSupportStatus(req.id, e.target.value)}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="submitted">Submitted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Invite Team Member Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Invite Team Member
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {currentUser?.workspace_name || "Workspace"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {modalSuccessInvite ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Invitation Dispatched</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    An onboarding link was generated for{" "}
                    <span className="font-semibold text-foreground font-mono">
                      {modalSuccessInvite.email}
                    </span>{" "}
                    as{" "}
                    <span className="font-semibold text-foreground">
                      {modalSuccessInvite.role === "officer" ? "Compliance Officer" : "Financial Advisor"}
                    </span>
                    .
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setModalSuccessInvite(null);
                      setModalEmail("");
                      setModalError("");
                    }}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    + Invite another colleague
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleModalInvite} className="space-y-4">
                {modalError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Work email address
                  </label>
                  <input
                    required
                    autoFocus
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Assigned role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalRole("advisor")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                        modalRole === "advisor"
                          ? "border-primary bg-primary/[0.06] text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <Users className="size-4 mb-1" />
                      <div className="font-semibold text-foreground text-xs">Advisor</div>
                      <div className="text-[10px] text-muted-foreground">Draft & submit</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalRole("officer")}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                        modalRole === "officer"
                          ? "border-primary bg-primary/[0.06] text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <ShieldCheck className="size-4 mb-1" />
                      <div className="font-semibold text-foreground text-xs">Officer</div>
                      <div className="text-[10px] text-muted-foreground">Review & approve</div>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !modalEmail}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {modalLoading ? (
                      <>
                        <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Invitation</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Interactive Toast Notification (Non-blocking confirmation & feedback) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-[420px] animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
              toast.type === "confirm"
                ? "border-amber-500/30 bg-card/95 text-foreground"
                : toast.type === "success"
                ? "border-emerald-500/30 bg-card/95 text-foreground"
                : toast.type === "error"
                ? "border-destructive/30 bg-card/95 text-destructive"
                : "border-border bg-card/95 text-foreground"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {toast.type === "confirm" && (
                  <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4" />
                  </div>
                )}
                {toast.type === "success" && (
                  <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                  </div>
                )}
                {toast.type === "error" && (
                  <div className="flex size-8 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                    <ShieldAlert className="size-4" />
                  </div>
                )}
                {toast.type === "info" && (
                  <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CheckCircle2 className="size-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold leading-tight tracking-tight text-foreground">
                    {toast.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                    aria-label="Dismiss toast"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="text-xs mt-1 leading-relaxed text-muted-foreground">
                  {toast.message}
                </p>

                {toast.type === "confirm" && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setToast(null)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (toast.onConfirm) toast.onConfirm();
                      }}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm transition cursor-pointer ${
                        toast.confirmVariant === "destructive"
                          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {toast.confirmLabel || "Confirm"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
