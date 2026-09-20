'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CircleCheck, Info, Sparkles, History, Loader2, ShieldCheck } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'
import { useToast } from '@/components/Toast'
import AuditTrailView from '@/components/AuditTrailView'
import type { DocumentItem, DocumentThread, DocumentThreadVersion, DocumentReview, AIAnalysis, ComplianceFlag } from '@/types/document'

export default function ReviewPanel({
  doc,
  onSuccess,
  onStatusChange,
}: {
  doc: DocumentItem
  onSuccess: () => void
  onStatusChange?: (status: string) => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'AI Assist' | 'Manual Decision' | 'Thread History' | 'Audit Log'>('AI Assist')
  const [decision, setDecision] = useState('Needs Revision')
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [threadData, setThreadData] = useState<DocumentThread | null>(null)
  const [isLoadingThread, setIsLoadingThread] = useState(false)

  const [claimStatus, setClaimStatus] = useState<'claiming' | 'claimed' | 'locked_by_other'>('claiming')
  const [lockMessage, setLockMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [analysisData, setAnalysisData] = useState<AIAnalysis | null>(doc?.ai_analysis || null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(!doc?.ai_analysis)
  const [analysisStatusMessage, setAnalysisStatusMessage] = useState<string | null>(null)

  const isReviewed = ['approved', 'rejected', 'needs_revision'].includes(doc?.status?.toLowerCase() || '')
  const currentVersion = threadData?.versions?.find((v) => v.document_id === doc?.id)
  const existingReview: DocumentReview | null = currentVersion?.review || (doc.officer_comment ? {
    decision: doc.status as any,
    comment: doc.officer_comment,
    decided_at: undefined,
    officer_name: doc.locked_by_officer_name || 'Compliance Officer',
  } : null)

  useEffect(() => {
    if (!doc?.id) return

    let isMounted = true
    let pollTimer: NodeJS.Timeout | null = null

    if (doc.ai_analysis) {
      setAnalysisData(doc.ai_analysis)
      setIsLoadingAnalysis(false)
    } else {
      setIsLoadingAnalysis(true)
    }

    const fetchAnalysis = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        const res = await fetch(`${getApiBaseUrl()}/documents/${doc.id}/analysis`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!isMounted) return

        if (res.status === 200) {
          const data = await res.json()
          setAnalysisData(data)
          setIsLoadingAnalysis(false)
          setAnalysisStatusMessage(null)
        } else if (res.status === 202) {
          // Worker is currently processing; poll again in 3 seconds
          setIsLoadingAnalysis(true)
          setAnalysisStatusMessage('AI analysis is running in the background...')
          pollTimer = setTimeout(fetchAnalysis, 3000)
        } else if (res.status === 503) {
          setIsLoadingAnalysis(false)
          setAnalysisStatusMessage('AI analysis service is temporarily unavailable.')
        } else if (res.status === 404) {
          // Document analysis record not yet created; retry shortly
          setIsLoadingAnalysis(true)
          setAnalysisStatusMessage('Initializing analysis pipeline...')
          pollTimer = setTimeout(fetchAnalysis, 3000)
        } else {
          setIsLoadingAnalysis(false)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to fetch analysis', err)
        setIsLoadingAnalysis(false)
      }
    }

    const fetchThread = async () => {
      setIsLoadingThread(true)
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch(`${getApiBaseUrl()}/documents/${doc.id}/thread`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok && isMounted) {
          const data = await res.json()
          setThreadData(data)
        }
      } catch (err) {
        console.error('Failed to load thread history', err)
      } finally {
        if (isMounted) setIsLoadingThread(false)
      }
    }

    const claimDoc = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch(`${getApiBaseUrl()}/documents/${doc.id}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!isMounted) return
        if (res.ok) {
          setClaimStatus('claimed')
          onStatusChange?.('in_review')
        } else if (res.status === 409) {
          const data = await res.json()
          setClaimStatus('locked_by_other')
          setLockMessage(data.detail || 'This document is already being reviewed by another officer.')
        }

      } catch (err) {
        console.error('Failed to claim document', err)
      }
    }

    if (!isReviewed) {
      claimDoc()
    }
    fetchAnalysis()
    fetchThread()

    return () => {
      isMounted = false
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [doc.id, doc.ai_analysis, isReviewed])

  // Periodic heartbeat while reviewing to keep lock active
  useEffect(() => {
    if (isReviewed || claimStatus !== 'claimed' || !doc?.id) return

    // Send heartbeat every 4 minutes (TTL is 30 minutes)
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch(`${getApiBaseUrl()}/documents/${doc.id}/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 409) {
          const data = await res.json()
          setClaimStatus('locked_by_other')
          setLockMessage(data.detail || 'Your review session timed out and another officer took over this document.')
        }
      } catch (err) {
        console.error('Failed to refresh review heartbeat', err)
      }
    }, 4 * 60 * 1000)

    return () => clearInterval(interval)
  }, [claimStatus, doc?.id])

  const aiData = analysisData || {
    summary: isLoadingAnalysis
      ? 'Analyzing document against compliance rules...'
      : (analysisStatusMessage || 'AI analysis is currently processing or unavailable.'),
    flags: [],
  }
  const aiFlags = aiData.flags || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (claimStatus === 'locked_by_other') return
    setIsSubmitting(true)
    setSubmitError(null)

    let backendDecision = 'needs_revision'
    if (decision === 'Approve') backendDecision = 'approve'
    if (decision === 'Reject') backendDecision = 'reject'
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${getApiBaseUrl()}/queue/${doc.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: backendDecision, comment: comments }),
      })

      if (response.ok) {
        toast.success(
          'Determination Saved',
          `Document determination recorded as ${decision.toLowerCase()}.`
        )
        onSuccess()
      } else {
        const err = await response.json()
        const msg = err.detail || 'Failed to record review determination.'
        setSubmitError(msg)
        toast.error('Submission Failed', msg)
        setIsSubmitting(false)
      }
    } catch {
      const msg = 'Network error while recording determination.'
      setSubmitError(msg)
      toast.error('Submission Failed', msg)
      setIsSubmitting(false)
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card lg:w-[420px] xl:w-[460px] 2xl:w-[500px] lg:border-l lg:border-t-0 h-full min-h-0 overflow-hidden">
      <div className="flex h-14 shrink-0 items-end gap-5 border-b border-border px-5 sm:px-6">
        <button
          onClick={() => setTab('AI Assist')}
          className={`h-14 border-b-2 px-1 text-sm font-semibold transition ${
            tab === 'AI Assist'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          AI Assist
        </button>
        <button
          onClick={() => setTab('Manual Decision')}
          className={`h-14 border-b-2 px-1 text-sm font-semibold transition ${
            tab === 'Manual Decision'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {isReviewed ? 'Determination' : 'Manual Decision'}
        </button>
        <button
          onClick={() => setTab('Thread History')}
          className={`flex h-14 items-center gap-1.5 border-b-2 px-1 text-sm font-semibold transition ${
            tab === 'Thread History'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="size-3.5" />
          <span>Thread History</span>
          {(threadData?.total_versions ?? 0) > 1 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              v{threadData?.total_versions}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('Audit Log')}
          className={`flex h-14 items-center gap-1.5 border-b-2 px-1 text-sm font-semibold transition ${
            tab === 'Audit Log'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="size-3.5" />
          <span>Audit Log</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'AI Assist' && (
          <div className="flex flex-col gap-7 p-5 sm:p-6">
            {(aiData.error_type === 'unsupported_for_ai' || aiData.manual_review_required || aiData.degraded) && (
              <div data-testid="degraded-state-banner" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {aiData.degraded
                        ? 'AI Assist Degraded / Fallback Mode'
                        : 'File Not Supported for Automated AI Analysis'}
                    </h3>
                    <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90 leading-5">
                      {aiData.degraded
                        ? 'AI Assist is running in degraded fallback mode (API rate-limited, key missing, or external service failure). Manual review is required for this document.'
                        : 'This document cannot be parsed for automated compliance checks (e.g. scanned or image-only PDF with no extractable text). Automated screening was bypassed; please proceed with manual revision.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('Manual Decision')}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                    >
                      Proceed with Manual Decision &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-primary/15 bg-primary/4 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">AI review summary</h2>
                </div>
                {isLoadingAnalysis && (
                  <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Processing</span>
                  </span>
                )}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{aiData.summary}</p>
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Compliance Flags</h2>
              </div>

              {aiFlags.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  <Info className="size-4 shrink-0" />
                  <span>
                    {isLoadingAnalysis
                      ? 'Evaluating document against rules...'
                      : aiData.degraded
                      ? 'Automated rule checking unavailable due to degraded service. Officer manual review required.'
                      : (aiData.error_type === 'unsupported_for_ai' || aiData.manual_review_required)
                      ? 'Automated rule checking bypassed due to unsupported file format. Manual revision/review required.'
                      : 'No flags detected.'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {aiFlags.map((flag: ComplianceFlag, index: number) => (
                    <div key={index} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle
                          className={`size-4 ${flag.severity?.toUpperCase() === 'HIGH' ? 'text-destructive' : 'text-amber-600'}`}
                        />
                        <span
                          className={`text-xs font-semibold ${
                            flag.severity?.toUpperCase() === 'HIGH' ? 'text-destructive' : 'text-amber-700'
                          }`}
                        >
                          {flag.severity?.toUpperCase()} severity
                        </span>
                      </div>

                      <dl className="flex flex-col gap-2.5 text-xs leading-5">
                        <div>
                          <dt className="inline font-semibold">Passage: </dt>
                          <dd className="inline text-muted-foreground">&quot;{flag.passage}&quot;</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold">Rule: </dt>
                          <dd className="inline text-muted-foreground">{flag.matched_rule_id}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold">Reason: </dt>
                          <dd className="inline text-muted-foreground">{flag.explanation}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'Manual Decision' && (
          isReviewed ? (
            <div className="flex min-h-full flex-col p-5 sm:p-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Review Determination</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This document has already been reviewed. Historical determinations are final and immutable.
                </p>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                      doc.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : doc.status === 'needs_revision'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : doc.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {doc.status?.replace('_', ' ')}
                  </span>
                </div>

                {existingReview ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">Decided by:</span>
                      <span className="font-medium text-foreground">{existingReview.officer_name || 'Compliance Officer'}</span>
                    </div>
                    {existingReview.decided_at && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground">Decided at:</span>
                        <span className="text-muted-foreground">{new Date(existingReview.decided_at).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reviewer Comments</span>
                      <p className="mt-2 text-sm text-foreground bg-muted/40 rounded-lg p-3 italic">
                        &ldquo;{existingReview.comment}&rdquo;
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Historical record finalized. View the Audit Log or Thread History for complete event details.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-full flex-col p-5 sm:p-6">
              <div>
                <h2 className="text-sm font-semibold">Final decision</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Review the AI findings and record your determination for this submission.
                </p>
              </div>

              {claimStatus === 'locked_by_other' && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">Under Active Review</p>
                      <p className="mt-1 leading-relaxed text-amber-800">
                        {lockMessage || 'This document is already being reviewed by another officer.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <fieldset disabled={claimStatus === 'locked_by_other'} className="mt-6 flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Decision
                </legend>

                {['Approve', 'Reject', 'Needs Revision'].map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-sm transition ${
                      claimStatus === 'locked_by_other'
                        ? 'cursor-not-allowed opacity-60 border-border bg-muted/20'
                        : 'cursor-pointer ' + (decision === option
                            ? 'border-primary bg-primary/4'
                            : 'border-border text-muted-foreground hover:bg-muted/50')
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={option}
                      disabled={claimStatus === 'locked_by_other'}
                      checked={decision === option}
                      onChange={(e) => setDecision(e.target.value)}
                      className="size-4 accent-primary"
                    />
                    {option}
                  </label>
                ))}
              </fieldset>

              <label className="mt-8 flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reviewer comments
                <textarea
                  required
                  disabled={claimStatus === 'locked_by_other'}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={claimStatus === 'locked_by_other' ? 'This document is already being reviewed by another officer...' : 'Add context for the submitter...'}
                  className="min-h-40 resize-y rounded-lg border border-input bg-background p-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none ring-primary placeholder:text-muted-foreground focus:ring-2 disabled:bg-muted/50 disabled:cursor-not-allowed"
                />
              </label>

              <div className="mt-auto flex flex-col gap-3 pt-8">
                <button
                  type="submit"
                  disabled={isSubmitting || claimStatus === 'locked_by_other'}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CircleCheck className="size-4" />
                  {claimStatus === 'locked_by_other' ? 'Under review by another officer' : isSubmitting ? 'Submitting...' : 'Submit decision'}
                </button>
              </div>

            </form>
          )
        )}

        {tab === 'Thread History' && (
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Revision Thread</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {threadData?.total_versions || 1} version(s) in this submission history
              </p>
            </div>

            {isLoadingThread ? (
              <div className="flex justify-center p-8 text-xs text-muted-foreground">Loading thread history...</div>
            ) : threadData?.versions?.length ? (
              <div className="relative ml-2 space-y-5 border-l border-border/80 pl-4">
                {threadData.versions.map((ver: DocumentThreadVersion) => {
                  const isCurrent = ver.document_id === doc.id
                  return (
                    <div key={ver.document_id} className="relative">
                      <div
                        className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card ${
                          isCurrent ? 'bg-primary ring-2 ring-primary/20' : 'bg-muted-foreground/40'
                        }`}
                      />

                      <div
                        className={`rounded-lg border p-4 transition ${
                          isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                              v{ver.version}
                            </span>
                            <span className="max-w-[140px] truncate text-xs font-semibold text-foreground">
                              {ver.filename}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              ver.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ver.status === 'needs_revision'
                                ? 'bg-amber-100 text-amber-800'
                                : ver.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>

                        {ver.review ? (
                          <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                            <div className="mb-1 flex items-center justify-between text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {ver.review.officer_name || 'Compliance Officer'}
                              </span>
                              <span>
                                {ver.review.decided_at
                                  ? new Date(ver.review.decided_at).toLocaleDateString()
                                  : ''}
                              </span>
                            </div>
                            <p className="italic text-muted-foreground">&ldquo;{ver.review.comment}&rdquo;</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Under active review</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No prior revision history found.</p>
            )}
          </div>
        )}

        {tab === 'Audit Log' && (
          <div className="p-5 sm:p-6">
            <AuditTrailView documentId={doc.id} />
          </div>
        )}
      </div>
    </aside>
  )
}
