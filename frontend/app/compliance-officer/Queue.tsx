'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircleCheck, Clock3, FileText, Filter, Gauge, Search } from 'lucide-react'

// The mini stat cards at the top
function Metric({ label, value, detail, icon: Icon, tone = 'default' }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${tone === 'warning' ? 'text-amber-600' : 'text-primary'}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

export default function Queue({ onReview }: { onReview: (doc: any) => void }) {
  const [documents, setDocuments] = useState<any[]>([])
  const [query, setQuery] = useState('')

  // 1. Fetch the real queue from the backend!
  useEffect(() => {
    const fetchQueue = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      
      try {
        const response = await fetch('http://localhost:8000/queue', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setDocuments(data.documents)
        }
      } catch (err) {
        console.error('Failed to fetch queue', err)
      }
    }
    fetchQueue()
  }, [])

  // 2. Filter logic for the search bar
  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const searchString = `${doc.name} ${doc.submitter}`.toLowerCase()
      return searchString.includes(query.toLowerCase())
    })
  }, [documents, query])
  
  // Calculate real metrics!
  const pendingCount = documents.filter(d => d.status === 'pending').length
  const reviewedCount = documents.filter(d => d.status !== 'pending').length

  return (
    <div className="mx-auto max-w-[1400px] p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations / incoming</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Documents pending review</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Triage uploaded materials, inspect AI findings, and record defensible compliance decisions.</p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted">
          <Filter className="size-4" />
          Export queue
        </button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pending review" value={pendingCount.toString()} detail="Awaiting officer decision" icon={Clock3} tone="warning" />
        <Metric label="High priority" value="0" detail="Requires attention today" icon={AlertTriangle} tone="warning" />
        <Metric label="Avg. review time" value="18m" detail="Down 12% this week" icon={Gauge} />
        <Metric label="Reviewed this month" value={reviewedCount.toString()} detail="Decisions recorded" icon={CircleCheck} />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Pending submissions <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{filtered.length}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Sorted by priority and upload date</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <span className="sr-only">Search documents</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents or advisors..." className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary sm:w-64" />
            </label>
          </div>
        </div>

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
              {filtered.map((doc) => (
                <tr key={doc.id} onClick={() => onReview(doc)} className="cursor-pointer transition hover:bg-muted/35">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{doc.name}</p>
                        <p className="mt-0.5 text-xs uppercase text-muted-foreground">{doc.file_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-foreground">{doc.submitter}</td>
                  <td className="px-4 py-4">
                    <p className="text-sm">{doc.uploaded}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 capitalize">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {doc.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); onReview(doc) }} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No documents found.</div>}
      </div>
    </div>
  )
}