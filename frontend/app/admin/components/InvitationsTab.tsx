"use client";

import { FormEvent } from "react";
import {
  UserPlus,
  Users,
  ShieldCheck,
  Mail,
  RotateCcw,
  Copy,
  Check,
  XCircle,
  Trash2,
  Loader2,
  Building2,
} from "lucide-react";
import { Invitation } from "../types";

interface InvitationsTabProps {
  invitations: Invitation[];
  workspaceName?: string;
  email: string;
  setEmail: (val: string) => void;
  role: "advisor" | "officer";
  setRole: (val: "advisor" | "officer") => void;
  loading: boolean;
  onSendInvite: (e: FormEvent) => void;
  onTriggerModalInvite: () => void;
  resendingId: string | null;
  actionInProgress: string | null;
  onResendInvite: (id: string, email: string) => void;
  copiedToken: string | null;
  onCopyInviteLink: (token: string) => void;
  onPromptRevokeInvite: (id: string, email: string) => void;
}

export default function InvitationsTab({
  invitations,
  workspaceName,
  email,
  setEmail,
  role,
  setRole,
  loading,
  onSendInvite,
  onTriggerModalInvite,
  resendingId,
  actionInProgress,
  onResendInvite,
  copiedToken,
  onCopyInviteLink,
  onPromptRevokeInvite,
}: InvitationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Card if 0 invitations */}
      {invitations.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary mb-2">
                <Building2 className="size-3.5" />
                <span>Workspace Initialized</span>
              </div>
              <h2 className="text-base font-bold text-foreground">
                Welcome to {workspaceName || "Workspace"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Your organization workspace is provisioned. As primary administrator, invite compliance officers and financial advisors to begin reviewing and submitting documents.
              </p>
            </div>
            <button
              type="button"
              onClick={onTriggerModalInvite}
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

          <form onSubmit={onSendInvite} className="space-y-4">
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
                  Use the invitation form to onboard compliance officers and financial advisors to {workspaceName || "your workspace"}.
                </p>
                <button
                  type="button"
                  onClick={onTriggerModalInvite}
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
                            onClick={() => onResendInvite(inv.id, inv.email)}
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
                            onClick={() => onCopyInviteLink(inv.token)}
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
                            onClick={() => onPromptRevokeInvite(inv.id, inv.email)}
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
                            onClick={() => onPromptRevokeInvite(inv.id, inv.email)}
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
    </div>
  );
}
