"use client";

import { FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";

interface AdminAuthViewProps {
  loginEmail: string;
  setLoginEmail: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  showLoginPassword: boolean;
  setShowLoginPassword: (val: boolean) => void;
  loginLoading: boolean;
  loginError: string;
  onLogin: (e: FormEvent) => void;
  showRecoveryForm: boolean;
  setShowRecoveryForm: (val: boolean) => void;
  recoveryEmail: string;
  setRecoveryEmail: (val: string) => void;
  recoveryKey: string;
  setRecoveryKey: (val: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (val: string) => void;
  confirmAdminPassword: string;
  setConfirmAdminPassword: (val: string) => void;
  showRecoveryPassword: boolean;
  setShowRecoveryPassword: (val: boolean) => void;
  recoveryLoading: boolean;
  onRecover: (e: FormEvent) => void;
  newRecoveryKeyGenerated: string | null;
  setNewRecoveryKeyGenerated: (val: string | null) => void;
  copiedRecoveryKey: boolean;
  setCopiedRecoveryKey: (val: boolean) => void;
}

export default function AdminAuthView({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  showLoginPassword,
  setShowLoginPassword,
  loginLoading,
  loginError,
  onLogin,
  showRecoveryForm,
  setShowRecoveryForm,
  recoveryEmail,
  setRecoveryEmail,
  recoveryKey,
  setRecoveryKey,
  newAdminPassword,
  setNewAdminPassword,
  confirmAdminPassword,
  setConfirmAdminPassword,
  showRecoveryPassword,
  setShowRecoveryPassword,
  recoveryLoading,
  onRecover,
  newRecoveryKeyGenerated,
  setNewRecoveryKeyGenerated,
  copiedRecoveryKey,
  setCopiedRecoveryKey,
}: AdminAuthViewProps) {
  return (
    <div className="relative isolate min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden selection:bg-primary/20">
      {/* Background Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-blue-500/10 blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/4 size-[400px] rounded-full bg-indigo-500/10 blur-3xl -z-10"
      />

      <div className="relative z-10 w-full max-w-md">
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

          {newRecoveryKeyGenerated ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Password Reset Complete
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Your password has been updated. Save your new Master Recovery Key in a secure vault.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  New Master Recovery Key
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono font-bold text-foreground break-all">
                    {newRecoveryKeyGenerated}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newRecoveryKeyGenerated);
                      setCopiedRecoveryKey(true);
                      setTimeout(() => setCopiedRecoveryKey(false), 2500);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    {copiedRecoveryKey ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" />
                        <span>Copied</span>
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

              <button
                type="button"
                onClick={() => {
                  setNewRecoveryKeyGenerated(null);
                  setShowRecoveryForm(false);
                  setLoginPassword("");
                }}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 cursor-pointer"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          ) : showRecoveryForm ? (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Recover Admin Account
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Enter your email, Master Recovery Key, and choose a new password.
                </p>
              </div>

              <form onSubmit={onRecover} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Administrator email
                  <input
                    required
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Master Recovery Key
                  <input
                    required
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="rec_..."
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-xs font-mono font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  New Password
                  <div className="relative">
                    <input
                      required
                      type={showRecoveryPassword ? "text" : "password"}
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={showRecoveryPassword ? "Hide password" : "Show password"}
                    >
                      {showRecoveryPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Confirm New Password
                  <input
                    required
                    type={showRecoveryPassword ? "text" : "password"}
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-75 cursor-pointer"
                >
                  {recoveryLoading ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <>
                      <span>Reset Admin Password</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRecoveryForm(false)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition text-center cursor-pointer"
                >
                  Return to Sign In
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Sign in to Admin Console
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  This administrative console is strictly reserved for workspace administrators to manage invitations, team directories, and access policies.
                </p>
              </div>

              {loginError && (
                <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={onLogin} className="flex flex-col gap-4">
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

                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryForm(true);
                    setRecoveryEmail(loginEmail);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer text-center"
                >
                  Forgot admin password? Use recovery key
                </button>
              </form>
            </div>
          )}

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
