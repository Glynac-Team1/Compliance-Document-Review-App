"use client";

import { Mail } from "lucide-react";
import { SupportRequestItem } from "../types";

interface SupportRequestsTabProps {
  supportRequests: SupportRequestItem[];
  workspaceName?: string;
  updatingSupportId: string | null;
  onUpdateSupportStatus: (id: string, newStatus: string) => void;
}

export default function SupportRequestsTab({
  supportRequests,
  workspaceName,
  updatingSupportId,
  onUpdateSupportStatus,
}: SupportRequestsTabProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            Support Requests ({supportRequests.length})
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Tickets submitted by advisors in {workspaceName || "Workspace"}
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
                    onChange={(e) => onUpdateSupportStatus(req.id, e.target.value)}
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
  );
}
