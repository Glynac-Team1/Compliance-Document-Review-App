"use client";

import {
  KeyRound,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { TeamMember } from "../types";

interface TeamDirectoryTabProps {
  team: TeamMember[];
  currentUserId?: string;
  workspaceName?: string;
  actionInProgress: string | null;
  openMenuMemberId: string | null;
  setOpenMenuMemberId: (id: string | null) => void;
  onResetPassword: (memberId: string, memberEmail: string) => void;
  onRemoveMember: (memberId: string, memberName: string, memberEmail: string) => void;
}

export default function TeamDirectoryTab({
  team,
  currentUserId,
  workspaceName,
  actionInProgress,
  openMenuMemberId,
  setOpenMenuMemberId,
  onResetPassword,
  onRemoveMember,
}: TeamDirectoryTabProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            Active Workspace Members ({team.length})
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Live membership directory for {workspaceName || "Workspace"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[220px]">
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
              const isSelf = member.id === currentUserId;
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
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuMemberId(
                              openMenuMemberId === member.id ? null : member.id
                            )
                          }
                          disabled={actionInProgress === member.id}
                          className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition cursor-pointer"
                          aria-label="Member options"
                        >
                          <MoreVertical className="size-4" />
                        </button>

                        {openMenuMemberId === member.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenMenuMemberId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-xl z-40 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuMemberId(null);
                                  onResetPassword(member.id, member.email);
                                }}
                                disabled={actionInProgress === member.id}
                                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition text-left cursor-pointer"
                              >
                                <KeyRound className="size-3.5 text-muted-foreground" />
                                <span>Reset Password</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuMemberId(null);
                                  onRemoveMember(member.id, member.name, member.email);
                                }}
                                disabled={actionInProgress === member.id}
                                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition text-left cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Remove Member</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
