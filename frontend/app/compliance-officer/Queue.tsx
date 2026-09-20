'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Clock3, FileText, Filter, Search, UserCheck } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'
import AuditLogModal from '@/components/AuditLogModal'
import type { DocumentItem } from '@/types/document'

export type QueueTab = 'unreviewed' | 'reviewed' | 'all'

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
  active = false,
  onClick,
}: {
  label: string
  value: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'warning'
  active?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 transition ${
        onClick ? 'cursor-pointer hover:border-primary/50' : ''
      } ${active ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${tone === 'warning' ? 'text-amber-600' : 'text-primary'}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase()
  let styles = 'bg-amber-50 text-amber-700 ring-amber-200'
  let label = status ? status.replace('_', ' ') : 'Pending'

  if (normalized === 'approved') {
    styles = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    label = 'Approved'
  } else if (normalized === 'rejected') {
    styles = 'bg-rose-50 text-rose-700 ring-rose-200'
    label = 'Rejected'
  } else if (normalized === 'needs_revision') {
    styles = 'bg-sky-50 text-sky-700 ring-sky-200'
    label = 'Needs Revision'
  } else if (normalized === 'in_review') {
    styles = 'bg-blue-50 text-blue-700 ring-blue-200'
    label = 'In Review'
  } else if (normalized === 'pending') {
    styles = 'bg-amber-50 text-amber-700 ring-amber-200'
    label = 'Pending Review'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

interface QueueProps {
  onReview: (doc: DocumentItem) => void
  initialTab?: QueueTab
  refreshTrigger?: number
}

export default function Queue({ onReview, initialTab = 'unreviewed', refreshTrigger }: QueueProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [activeTab, setActiveTab] = useState<QueueTab>(initialTab)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const [isLoading, setIsLoading] = useState(true)
  const [auditDoc, setAuditDoc] = useState<DocumentItem | null>(null)

  // Reset pagination when active tab, status filter, or search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, statusFilter, query])

  // Synchronize when initialTab changes from parent
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
      setStatusFilter('all')
    }
  }, [initialTab])

  // Fetch queue items from backend
  const fetchQueue = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      const response = await fetch(`${getApiBaseUrl()}/queue`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (err) {
      console.error('Failed to fetch queue', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [refreshTrigger])


  const handleRelease = async (docId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const res = await fetch(`${getApiBaseUrl()}/documents/${docId}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        fetchQueue()
      }
    } catch (err) {
      console.error('Failed to release lock', err)
    }
  }

  // Derived counts from real queue data
  const pendingCount = useMemo(() => {
    return documents.filter((d) => (d.status || '').toLowerCase() === 'pending').length
  }, [documents])

  const inReviewCount = useMemo(() => {
    return documents.filter((d) => (d.status || '').toLowerCase() === 'in_review').length
  }, [documents])

  const flaggedCount = useMemo(() => {
    return documents.filter((d) => {
      const flags = d.ai_analysis?.flags
      return Array.isArray(flags) && flags.length > 0
    }).length
  }, [documents])

  const reviewedCount = useMemo(() => {
    return documents.filter((d) => {
      const s = (d.status || '').toLowerCase()
      return s === 'approved' || s === 'rejected' || s === 'needs_revision'
    }).length
  }, [documents])

  const totalCount = documents.length

  // Filtered dataset
  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const docStatus = (doc.status || '').toLowerCase()
      const isUnreviewed = docStatus === 'pending' || docStatus === 'in_review'
      const isReviewed = docStatus === 'approved' || docStatus === 'rejected' || docStatus === 'needs_revision'

      // 1. Primary tab filter
      if (activeTab === 'unreviewed' && !isUnreviewed) return false
      if (activeTab === 'reviewed' && !isReviewed) return false

      // 2. Specific status dropdown filter
      if (statusFilter !== 'all' && docStatus !== statusFilter.toLowerCase()) {
        return false
      }

      // 3. Search query
      const searchString = `${doc.name || ''} ${doc.submitter || ''}`.toLowerCase()
      return searchString.includes(query.toLowerCase())
    })
  }, [documents, activeTab, statusFilter, query])

  // Status dropdown options based on active tab
  const statusOptions = useMemo(() => {
    if (activeTab === 'unreviewed') {
      return [
        { value: 'all', label: 'All needs review' },
        { value: 'pending', label: 'Pending review' },
        { value: 'in_review', label: 'In review' },
      ]
    }
    if (activeTab === 'reviewed') {
      return [
        { value: 'all', label: 'All reviewed' },
        { value: 'approved', label: 'Approved' },
        { value: 'needs_revision', label: 'Needs revision' },
        { value: 'rejected', label: 'Rejected' },
      ]
    }
    return [
      { value: 'all', label: 'All statuses' },
      { value: 'pending', label: 'Pending review' },
      { value: 'in_review', label: 'In review' },
      { value: 'approved', label: 'Approved' },
      { value: 'needs_revision', label: 'Needs revision' },
      { value: 'rejected', label: 'Rejected' },
    ]
  }, [activeTab])

  // Pagination math (5 documents per page, matching Advisor Submissions)
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedList = filtered.slice(startIndex, endIndex)

  return (
    <div className="mx-auto max-w-[1400px] p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations / incoming</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Compliance Review Queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Triage uploaded materials, inspect AI findings, and record defensible compliance decisions.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pending review"
          value={pendingCount.toString()}
          detail="Awaiting officer decision"
          icon={Clock3}
          tone="warning"
          active={activeTab === 'unreviewed' && statusFilter === 'pending'}
          onClick={() => {
            setActiveTab('unreviewed')
            setStatusFilter('pending')
          }}
        />
        <Metric
          label="In review"
          value={inReviewCount.toString()}
          detail="Claimed by officers"
          icon={UserCheck}
          active={activeTab === 'unreviewed' && statusFilter === 'in_review'}
          onClick={() => {
            setActiveTab('unreviewed')
            setStatusFilter('in_review')
          }}
        />
        <Metric
          label="AI flags detected"
          value={flaggedCount.toString()}
          detail="Submissions with rule flags"
          icon={AlertTriangle}
          tone={flaggedCount > 0 ? 'warning' : 'default'}
        />
        <Metric
          label="Reviewed decisions"
          value={reviewedCount.toString()}
          detail="Decisions recorded"
          icon={CircleCheck}
          active={activeTab === 'reviewed'}
          onClick={() => {
            setActiveTab('reviewed')
            setStatusFilter('all')
          }}
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        {/* Segmented Tab Bar */}
        <div className="flex border-b border-border bg-muted/20 px-4 pt-2">
          <button
            onClick={() => {
              setActiveTab('unreviewed')
              setStatusFilter('all')
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'unreviewed'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Needs Review
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                activeTab === 'unreviewed'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('reviewed')
              setStatusFilter('all')
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'reviewed'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Reviewed
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                activeTab === 'reviewed'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {reviewedCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('all')
              setStatusFilter('all')
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            All Submissions
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                activeTab === 'all'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {totalCount}
            </span>
          </button>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {activeTab === 'unreviewed'
                ? 'Submissions awaiting review'
                : activeTab === 'reviewed'
                ? 'Reviewed submissions'
                : 'All submissions'}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {filtered.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === 'unreviewed'
                ? 'Sorted by submission date; pending compliance officer evaluation'
                : activeTab === 'reviewed'
                ? 'Historical decisions recorded for regulatory audit'
                : 'Combined submission registry'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 appearance-none rounded-md border border-input bg-card pl-9 pr-8 text-xs font-medium text-muted-foreground outline-none hover:bg-muted focus:ring-2 focus:ring-primary cursor-pointer"
                aria-label="Filter by status"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <span className="sr-only">Search documents</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents or advisors..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary sm:w-64"
              />
            </label>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Submitted by</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedList.map((doc) => {
                const isReviewed = ['approved', 'rejected', 'needs_revision'].includes(
                  (doc.status || '').toLowerCase()
                )
                const isLockedByOther = Boolean(doc.is_locked_by_other)
                const isLockedByMe = Boolean(doc.is_locked_by_me)

                return (
                  <tr
                    key={doc.id}
                    onClick={() => {
                      if (!isLockedByOther) {
                        onReview(doc)
                      }
                    }}
                    className={`transition ${
                      isLockedByOther
                        ? 'opacity-75 bg-muted/15 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-muted/35'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{doc.name}</p>
                          <p className="mt-0.5 text-xs uppercase text-muted-foreground">{doc.file_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-foreground">{doc.submitter}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{doc.uploaded}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={doc.status} />
                        {isLockedByOther && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <Clock3 className="size-3 shrink-0" />
                            Being reviewed by {doc.locked_by_officer_name || 'another officer'}
                          </span>
                        )}
                        {isLockedByMe && doc.status === 'in_review' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                            <UserCheck className="size-3 shrink-0" />
                            Claimed by you
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAuditDoc(doc)
                          }}
                          title="View Audit Log"
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                        >
                          Audit Log
                        </button>
                        {isReviewed ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onReview(doc)
                            }}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                          >
                            View Record
                          </button>
                        ) : isLockedByOther ? (
                          <button
                            disabled
                            title={`This document is already being reviewed by ${doc.locked_by_officer_name || 'another officer'}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                          >
                            <Clock3 className="size-3" />
                            In Review
                          </button>
                        ) : isLockedByMe ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRelease(doc.id)
                              }}
                              title="Release lock and return to pending"
                              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                            >
                              Release
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onReview(doc)
                              }}
                              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 cursor-pointer"
                            >
                              Resume Review
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onReview(doc)
                            }}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/[0.06] cursor-pointer"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading compliance queue...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {query || statusFilter !== 'all'
              ? 'No documents match your filter criteria.'
              : activeTab === 'unreviewed'
              ? 'No pending submissions awaiting review.'
              : activeTab === 'reviewed'
              ? 'No reviewed submissions recorded yet.'
              : 'No documents found in the queue.'}
          </div>
        ) : null}

        {/* Pagination Bar - Aligned with advisor submissions style */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>
            Showing {filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || filtered.length === 0}
              aria-label="Previous page" 
              className="rounded p-1.5 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button 
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || filtered.length === 0}
              aria-label="Next page" 
              className="rounded p-1.5 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {auditDoc && (
        <AuditLogModal
          isOpen={!!auditDoc}
          onClose={() => setAuditDoc(null)}
          documentId={auditDoc.id}
          documentTitle={auditDoc.name || auditDoc.original_filename || auditDoc.filename}
        />
      )}
    </div>
  )
}