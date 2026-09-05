'use client'

import { useState } from 'react'
import { AlertTriangle, CircleCheck, Info, Sparkles } from 'lucide-react'

export default function ReviewPanel({ doc, onSuccess }: { doc: any; onSuccess: () => void }) {
  const [tab, setTab] = useState<'AI Assist' | 'Manual Decision'>('AI Assist')
  const [decision, setDecision] = useState('Needs Revision')
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const aiData = doc.ai_analysis || {
    summary: 'AI analysis is currently processing or unavailable.',
    flags: [],
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    let backendDecision = 'needs_revision'
    if (decision === 'Approve') backendDecision = 'approve'
    if (decision === 'Reject') backendDecision = 'reject'
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`http://localhost:8000/queue/${doc.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: backendDecision, comment: comments }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        setIsSubmitting(false)
      }
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card lg:w-[40%] lg:border-l lg:border-t-0">
      <div className="flex h-14 shrink-0 items-end gap-6 border-b border-border px-5 sm:px-6">
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
          Manual Decision
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'AI Assist' ? (
          <div className="flex flex-col gap-7 p-5 sm:p-6">
            <div className="rounded-lg border border-primary/15 bg-primary/4 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">AI review summary</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{aiData.summary}</p>
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Compliance Flags</h2>
              </div>

              {aiData.flags.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  <Info className="size-4" />
                  <span>No flags detected.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {aiData.flags.map((flag: any, index: number) => (
                    <div key={index} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle
                          className={`size-4 ${flag.severity === 'HIGH' ? 'text-destructive' : 'text-amber-600'}`}
                        />
                        <span
                          className={`text-xs font-semibold ${
                            flag.severity === 'HIGH' ? 'text-destructive' : 'text-amber-700'
                          }`}
                        >
                          {flag.severity} severity
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
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-full flex-col p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">Final decision</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Review the AI findings and record your determination for this submission.
              </p>
            </div>

            <fieldset className="mt-8 flex flex-col gap-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Decision
              </legend>

              {['Approve', 'Reject', 'Needs Revision'].map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm transition ${
                    decision === option
                      ? 'border-primary bg-primary/4'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option}
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
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add context for the submitter..."
                className="min-h-40 resize-y rounded-lg border border-input bg-background p-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none ring-primary placeholder:text-muted-foreground focus:ring-2"
              />
            </label>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              >
                <CircleCheck className="size-4" />
                {isSubmitting ? 'Submitting...' : 'Submit decision'}
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  )
}
