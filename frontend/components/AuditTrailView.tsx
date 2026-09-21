'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Eye,
  Lock,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'
import type { AuditLogEvent } from '@/types/document'

interface AuditTrailViewProps {
  documentId: string
  compact?: boolean
}

function formatActionLabel(action: string): string {
  switch (action.toLowerCase()) {
    case 'submitted':
      return 'Submitted for review'
    case 'viewed':
      return 'Document viewed'
    case 'claimed':
      return 'Review lock claimed'
    case 'decided':
      return 'Decision recorded'
    case 'resubmitted':
      return 'Revision resubmitted'
    default:
      return action.replace('_', ' ')
  }
}

function ActionIcon({ action }: { action: string }) {
  switch (action.toLowerCase()) {
    case 'submitted':
      return <FileText className="size-4 text-primary" />
    case 'viewed':
      return <Eye className="size-4 text-muted-foreground" />
    case 'claimed':
      return <Lock className="size-4 text-amber-600" />
    case 'decided':
      return <CheckCircle2 className="size-4 text-emerald-600" />
    case 'resubmitted':
      return <RefreshCw className="size-4 text-sky-600" />
    default:
      return <Clock className="size-4 text-muted-foreground" />
  }
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return isoString
  }
}

function formatRole(role?: string | null): string {
  if (!role) return 'User'
  if (role.toLowerCase() === 'officer') return 'Compliance Officer'
  if (role.toLowerCase() === 'advisor') return 'Advisor'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AuditTrailView({ documentId, compact = false }: AuditTrailViewProps) {
  const [events, setEvents] = useState<AuditLogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuditLog = async () => {
    if (!documentId) return
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required to view audit trail.')
        setLoading(false)
        return
      }

      const res = await fetch(`${getApiBaseUrl()}/documents/${documentId}/audit-log`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setEvents(data.audit_events || [])
      } else if (res.status === 403) {
        setError('Access denied. You do not have permission to view this document’s audit log.')
      } else if (res.status === 404) {
        setError('Document not found.')
      } else {
        setError('Failed to load audit trail.')
      }
    } catch {
      setError('Network error while loading audit log.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLog()
  }, [documentId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2 text-primary" />
        <p className="text-xs">Loading audit records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5">
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">Unable to display audit log</p>
          <p className="mt-0.5 text-muted-foreground">{error}</p>
          <button
            onClick={fetchAuditLog}
            className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RefreshCw className="size-3" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        <Clock className="size-6 mx-auto mb-2 text-muted-foreground/60" />
        <p className="font-semibold text-foreground">No audit entries recorded</p>
        <p className="mt-1">Events will appear here as actions are performed on this document.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <span className="text-xs font-semibold text-foreground">
            Audit Trail ({events.length} {events.length === 1 ? 'event' : 'events'})
          </span>
          <p className="text-[11px] text-muted-foreground">
            Chronological record of document activity
          </p>
        </div>
        <button
          onClick={fetchAuditLog}
          title="Refresh audit log"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
        >
          <RefreshCw className="size-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="relative border-l border-border/80 ml-3.5 space-y-4 pt-1">
        {events.map((event) => (
          <div key={event.id} className="relative pl-6">
            {/* Timeline bullet indicator */}
            <div className="absolute -left-[17px] top-0.5 flex size-8 items-center justify-center rounded-full border border-border bg-card shadow-xs">
              <ActionIcon action={event.action} />
            </div>

            {/* Event content */}
            <div className={`rounded-lg border border-border/70 bg-card ${compact ? 'p-2.5' : 'p-3'} shadow-xs`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {formatActionLabel(event.action)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {event.actor?.name || 'Unknown User'}
                </span>
                {event.actor?.email && (
                  <span className="text-[11px] text-muted-foreground/80">
                    ({event.actor.email})
                  </span>
                )}
                {event.actor?.role && (
                  <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {formatRole(event.actor.role)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
