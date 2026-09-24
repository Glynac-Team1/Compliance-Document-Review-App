"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  ShieldCheck,
  KeyRound,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  X,
} from "lucide-react";
import { getApiBaseUrl, formatApiError } from "@/lib/api";
import {
  Invitation,
  TeamMember,
  SupportRequestItem,
  CurrentUser,
  ToastData,
  ResetLinkModalData,
  MemberToRemoveData,
} from "./types";
import AdminAuthView from "./components/AdminAuthView";
import InvitationsTab from "./components/InvitationsTab";
import TeamDirectoryTab from "./components/TeamDirectoryTab";
import SupportRequestsTab from "./components/SupportRequestsTab";
import AdminModals from "./components/AdminModals";

export default function AdminConsolePage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Admin Sign-In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Admin Recovery State
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [newRecoveryKeyGenerated, setNewRecoveryKeyGenerated] = useState<string | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);

  // Admin Console State
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advisor" | "officer">("advisor");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invite" | "team" | "support">("invite");
  const [supportRequests, setSupportRequests] = useState<SupportRequestItem[]>([]);
  const [updatingSupportId, setUpdatingSupportId] = useState<string | null>(null);

  // Interactive Toast State
  const [toast, setToast] = useState<ToastData | null>(null);

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

  // Password Reset Link Modal State
  const [resetLinkModal, setResetLinkModal] = useState<ResetLinkModalData | null>(null);
  const [copiedResetUrl, setCopiedResetUrl] = useState(false);

  // Remove Member Confirmation Modal State
  const [memberToRemove, setMemberToRemove] = useState<MemberToRemoveData | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

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
        setResetLinkModal(null);
        if (!isRemovingMember) {
          setMemberToRemove(null);
        }
      }
    }
    if (isInviteModalOpen || resetLinkModal || memberToRemove) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isInviteModalOpen, resetLinkModal, memberToRemove, isRemovingMember]);

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
        setSupportRequests(Array.isArray(supportData) ? supportData : supportData.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch workspace data:", err);
    }
  }

  useEffect(() => {
    async function checkAdminStatus() {
      const token = localStorage.getItem("auth_token");
      const isAdminStored = localStorage.getItem("is_admin") === "true";
      const sessionAuth = sessionStorage.getItem("admin_authenticated") === "true";

      if (!token) {
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }

        const data = await res.json();
        setCurrentUser(data);

        if (data.is_admin || (isAdminStored && sessionAuth)) {
          setIsAdmin(true);
          sessionStorage.setItem("admin_authenticated", "true");
          await fetchWorkspaceData(token);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    }

    checkAdminStatus();
  }, []);

  // Poll workspace data periodically
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

  async function handleAdminRecovery(e: FormEvent) {
    e.preventDefault();
    setLoginError("");

    if (newAdminPassword.length < 8) {
      setToast({
        id: "rec-pass-len",
        type: "error",
        title: "Weak Password",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setToast({
        id: "rec-pass-mismatch",
        type: "error",
        title: "Password Mismatch",
        message: "The entered passwords do not match.",
      });
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/admin/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
          recovery_key: recoveryKey.trim(),
          new_password: newAdminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Recovery failed. Please check your recovery key."));
      }

      setNewRecoveryKeyGenerated(data.new_recovery_key);
      setToast({
        id: "admin-recovery-success",
        type: "success",
        title: "Password Updated",
        message: "Administrator password updated. Please save your new recovery key.",
      });
    } catch (err: any) {
      setToast({
        id: "admin-recovery-err",
        type: "error",
        title: "Recovery Failed",
        message: err.message || "Failed to recover administrator account.",
      });
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleResetUserPassword(memberId: string, memberEmail: string) {
    setActionInProgress(memberId);
    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/team/${memberId}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to generate password reset link."));
      }

      if (data.reset_url) {
        try {
          await navigator.clipboard.writeText(data.reset_url);
        } catch {
          // Non-blocking clipboard copy
        }
      }

      setCopiedResetUrl(false);
      setResetLinkModal({
        email: memberEmail,
        url: data.reset_url,
        emailSent: !!data.email_sent,
      });

      setToast({
        id: `reset-${memberId}`,
        type: "success",
        title: "Reset Link Ready",
        message: data.email_sent
          ? `Reset link dispatched to ${memberEmail}. Link copy dialog ready.`
          : `Reset link generated and ready to copy.`,
      });
    } catch (err: any) {
      setToast({
        id: `reset-err-${memberId}`,
        type: "error",
        title: "Reset Failed",
        message: err.message || "Failed to generate reset link.",
      });
    } finally {
      setActionInProgress(null);
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
    setModalLoading(true);
    setModalError("");

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
        token: data.invitation?.token || "",
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
    setMemberToRemove({
      id: memberId,
      name: memberName,
      email: memberEmail,
    });
  }

  async function executeRemoveMember(memberId: string, memberName: string, memberEmail: string) {
    setIsRemovingMember(true);
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

      setMemberToRemove(null);
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
      setIsRemovingMember(false);
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
        throw new Error(formatApiError(data.detail, "Failed to update support status."));
      }

      setToast({
        id: `support-status-${requestId}`,
        type: "success",
        title: "Status Updated",
        message: `Support ticket status changed to ${newStatus.replace("_", " ")}.`,
      });
      if (token) await fetchWorkspaceData(token);
    } catch (err: any) {
      setToast({
        id: `support-err-${requestId}`,
        type: "error",
        title: "Update Failed",
        message: err.message || "Failed to update status.",
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
    setIsAdmin(false);
    setCurrentUser(null);
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

  // 2. Unauthenticated or Non-Admin State -> Modular Admin Auth & Recovery Screen
  if (!isAdmin) {
    return (
      <AdminAuthView
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        showLoginPassword={showLoginPassword}
        setShowLoginPassword={setShowLoginPassword}
        loginLoading={loginLoading}
        loginError={loginError}
        onLogin={handleAdminLogin}
        showRecoveryForm={showRecoveryForm}
        setShowRecoveryForm={setShowRecoveryForm}
        recoveryEmail={recoveryEmail}
        setRecoveryEmail={setRecoveryEmail}
        recoveryKey={recoveryKey}
        setRecoveryKey={setRecoveryKey}
        newAdminPassword={newAdminPassword}
        setNewAdminPassword={setNewAdminPassword}
        confirmAdminPassword={confirmAdminPassword}
        setConfirmAdminPassword={setConfirmAdminPassword}
        showRecoveryPassword={showRecoveryPassword}
        setShowRecoveryPassword={setShowRecoveryPassword}
        recoveryLoading={recoveryLoading}
        onRecover={handleAdminRecovery}
        newRecoveryKeyGenerated={newRecoveryKeyGenerated}
        setNewRecoveryKeyGenerated={setNewRecoveryKeyGenerated}
        copiedRecoveryKey={copiedRecoveryKey}
        setCopiedRecoveryKey={setCopiedRecoveryKey}
      />
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

      {/* Top Header */}
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
        {/* Dynamic Overview Stats */}
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

        {/* Tab 1: Invitations Management */}
        {activeTab === "invite" && (
          <InvitationsTab
            invitations={invitations}
            workspaceName={currentUser?.workspace_name}
            email={email}
            setEmail={setEmail}
            role={role}
            setRole={setRole}
            loading={loading}
            onSendInvite={handleSendInvite}
            onTriggerModalInvite={handleTriggerInvite}
            resendingId={resendingId}
            actionInProgress={actionInProgress}
            onResendInvite={handleResendInvite}
            copiedToken={copiedToken}
            onCopyInviteLink={copyInviteLink}
            onPromptRevokeInvite={promptRevokeInvite}
          />
        )}

        {/* Tab 2: Team Directory */}
        {activeTab === "team" && (
          <TeamDirectoryTab
            team={team}
            currentUserId={currentUser?.id}
            workspaceName={currentUser?.workspace_name}
            actionInProgress={actionInProgress}
            openMenuMemberId={openMenuMemberId}
            setOpenMenuMemberId={setOpenMenuMemberId}
            onResetPassword={handleResetUserPassword}
            onRemoveMember={promptRemoveMember}
          />
        )}

        {/* Tab 3: Support Requests Queue */}
        {activeTab === "support" && (
          <SupportRequestsTab
            supportRequests={supportRequests}
            workspaceName={currentUser?.workspace_name}
            updatingSupportId={updatingSupportId}
            onUpdateSupportStatus={handleUpdateSupportStatus}
          />
        )}
      </main>

      {/* Admin Modals (Invite, Reset Link Copy, Remove Member Confirmation) */}
      <AdminModals
        isInviteModalOpen={isInviteModalOpen}
        onCloseInviteModal={() => setIsInviteModalOpen(false)}
        modalEmail={modalEmail}
        setModalEmail={setModalEmail}
        modalRole={modalRole}
        setModalRole={setModalRole}
        modalLoading={modalLoading}
        modalError={modalError}
        modalSuccessInvite={modalSuccessInvite}
        onResetInviteSuccess={() => {
          setModalSuccessInvite(null);
          setModalEmail("");
          setModalError("");
        }}
        onSubmitModalInvite={handleModalInvite}
        workspaceName={currentUser?.workspace_name}
        resetLinkModal={resetLinkModal}
        onCloseResetLinkModal={() => setResetLinkModal(null)}
        copiedResetUrl={copiedResetUrl}
        onCopyResetUrl={() => {
          if (resetLinkModal?.url) {
            navigator.clipboard.writeText(resetLinkModal.url);
            setCopiedResetUrl(true);
            setTimeout(() => setCopiedResetUrl(false), 2000);
          }
        }}
        memberToRemove={memberToRemove}
        onCloseRemoveMemberModal={() => setMemberToRemove(null)}
        isRemovingMember={isRemovingMember}
        onConfirmRemoveMember={() => {
          if (memberToRemove) {
            executeRemoveMember(memberToRemove.id, memberToRemove.name, memberToRemove.email);
          }
        }}
      />

      {/* Non-blocking Interactive Toast Notification */}
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
