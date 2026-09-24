"use client";

import { FormEvent } from "react";
import {
  UserPlus,
  ShieldCheck,
  Users,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  Copy,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { ResetLinkModalData, MemberToRemoveData } from "../types";

interface AdminModalsProps {
  // Invite Modal
  isInviteModalOpen: boolean;
  onCloseInviteModal: () => void;
  modalEmail: string;
  setModalEmail: (val: string) => void;
  modalRole: "advisor" | "officer";
  setModalRole: (val: "advisor" | "officer") => void;
  modalLoading: boolean;
  modalError: string;
  modalSuccessInvite: { email: string; token: string; role: string } | null;
  onResetInviteSuccess: () => void;
  onSubmitModalInvite: (e: FormEvent) => void;
  workspaceName?: string;

  // Reset Link Modal
  resetLinkModal: ResetLinkModalData | null;
  onCloseResetLinkModal: () => void;
  copiedResetUrl: boolean;
  onCopyResetUrl: () => void;

  // Remove Member Modal
  memberToRemove: MemberToRemoveData | null;
  onCloseRemoveMemberModal: () => void;
  isRemovingMember: boolean;
  onConfirmRemoveMember: () => void;
}

export default function AdminModals({
  isInviteModalOpen,
  onCloseInviteModal,
  modalEmail,
  setModalEmail,
  modalRole,
  setModalRole,
  modalLoading,
  modalError,
  modalSuccessInvite,
  onResetInviteSuccess,
  onSubmitModalInvite,
  workspaceName,
  resetLinkModal,
  onCloseResetLinkModal,
  copiedResetUrl,
  onCopyResetUrl,
  memberToRemove,
  onCloseRemoveMemberModal,
  isRemovingMember,
  onConfirmRemoveMember,
}: AdminModalsProps) {
  return (
    <>
      {/* 1. Invite Team Member Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={onCloseInviteModal}
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
                    {workspaceName || "Workspace"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseInviteModal}
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
                    onClick={onResetInviteSuccess}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    + Invite another colleague
                  </button>
                  <button
                    type="button"
                    onClick={onCloseInviteModal}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmitModalInvite} className="space-y-4">
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
                    onClick={onCloseInviteModal}
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

      {/* 2. Password Reset Link Modal */}
      {resetLinkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={onCloseResetLinkModal}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Password Reset Link
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[260px]">
                    {resetLinkModal.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseResetLinkModal}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Email dispatch notice */}
            {resetLinkModal.emailSent ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Email Dispatched</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  A reset instructions email has been dispatched via Brevo to{" "}
                  <span className="font-semibold text-foreground font-mono">
                    {resetLinkModal.email}
                  </span>
                  . You can also copy the direct link below if needed.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                A single-use password reset link has been generated. You can copy the link below to share it directly with{" "}
                <span className="font-semibold text-foreground">{resetLinkModal.email}</span>.
              </p>
            )}

            {/* URL Display with Copy Button */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-foreground">
                Reset Link URL
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition">
                <input
                  type="text"
                  readOnly
                  value={resetLinkModal.url}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs font-mono text-foreground outline-none select-all truncate"
                />
                <button
                  type="button"
                  onClick={onCopyResetUrl}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
                >
                  {copiedResetUrl ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Expires in 24 hours. Single-use only.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-end">
              <button
                type="button"
                onClick={onCloseResetLinkModal}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!isRemovingMember) onCloseRemoveMemberModal();
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Remove Team Member
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Confirm member removal
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={onCloseRemoveMemberModal}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">{memberToRemove.name}</span> (
              <span className="font-mono text-foreground">{memberToRemove.email}</span>) from the
              workspace? They will immediately lose access to all documents and workflows.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={onCloseRemoveMemberModal}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={onConfirmRemoveMember}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Member</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
