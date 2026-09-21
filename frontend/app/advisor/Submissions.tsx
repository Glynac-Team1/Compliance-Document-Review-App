'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Filter, Search, X, Upload, RefreshCw, Loader2, History } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'
import { useToast } from '@/components/Toast'
import AuditLogModal from '@/components/AuditLogModal'
import type { DocumentItem, DocumentThread, DocumentThreadVersion } from '@/types/document'


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
    label = 'Pending'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

export default function Submissions({
  onUpload,
  refreshTrigger,
  selectedDocId,
}: {
  onUpload: () => void
  refreshTrigger?: number
  selectedDocId?: string | null
}) {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')
  const itemsPerPage = 5

  const [isLoading, setIsLoading] = useState(true)
  const [threadData, setThreadData] = useState<DocumentThread | null>(null)
  const [_isLoadingThread, setIsLoadingThread] = useState(false)
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [auditDoc, setAuditDoc] = useState<DocumentItem | null>(null)
  const resubmitInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`${getApiBaseUrl()}/documents/mine`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [refreshTrigger])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)

  useEffect(() => {
    if (selectedDocId && documents.length > 0) {
      const target = documents.find((d) => d.id === selectedDocId)
      if (target) {
        setSelectedDocument(target)
      } else {
        const fetchTarget = async () => {
          try {
            const token = localStorage.getItem('auth_token')
            if (!token) return
            const res = await fetch(`${getApiBaseUrl()}/documents/${selectedDocId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const data = await res.json()
              setSelectedDocument(data)
            }
          } catch (e) {
            console.error('Failed to fetch selected document', e)
          }
        }
        fetchTarget()
      }
    }
  }, [selectedDocId, documents])

  useEffect(() => {
    if (!selectedDocument?.id) {
      setThreadData(null)
      return
    }

    const fetchThread = async () => {
      setIsLoadingThread(true)
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch(`${getApiBaseUrl()}/documents/${selectedDocument.id}/thread`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setThreadData(data)
        }
      } catch (err) {
        console.error('Failed to load document thread', err)
      } finally {
        setIsLoadingThread(false)
      }
    }

    fetchThread()
  }, [selectedDocument, refreshTrigger])

  const handleResubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedDocument?.id) return

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const allowed = ['.pdf', '.docx', '.xlsx']
    if (!allowed.includes(ext)) {
      toast.error('Unsupported File Type', `Only PDF (.pdf), Word (.docx), and Excel (.xlsx) files are supported.`)
      if (resubmitInputRef.current) resubmitInputRef.current.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File Too Large', 'Document exceeds the maximum allowed size of 10 MB.')
      if (resubmitInputRef.current) resubmitInputRef.current.value = ''
      return
    }

    setIsResubmitting(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('previous_version_id', selectedDocument.id)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        toast.error('Authentication Required', 'Please log in to submit document revisions.')
        return
      }
      const res = await fetch(`${getApiBaseUrl()}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Resubmission failed')
      }
      toast.success(
        'Revision Submitted',
        'Your document revision was submitted and is now pending compliance review.'
      )
      await fetchDocuments()
      setSelectedDocument(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown resubmission error occurred'
      toast.error('Resubmission Failed', message)
    } finally {
      setIsResubmitting(false)
      if (resubmitInputRef.current) resubmitInputRef.current.value = ''
    }
  }

    // master list from DB
  const baseList = documents
  
  // filtered list based on the search bar
  const displayList = baseList.filter((doc) => {
    const docName = (doc.name || doc.filename || '').toLowerCase()
    const matchesSearch = docName.includes(searchQuery.toLowerCase())
    
    // Check if the dropdown is set to "All", or if it matches the document's specific status
    const docStatus = (doc.status || '').toLowerCase()
    const matchesFilter = statusFilter === 'All' || docStatus === statusFilter.toLowerCase()
    
    return matchesSearch && matchesFilter
  })
  const totalSubmitted = displayList.length
  const totalApproved = displayList.filter((doc) => (doc.status || '').toLowerCase() === 'approved').length
  const totalNeedsReview = displayList.filter((doc) => (doc.status || '').toLowerCase() !== 'approved').length

    // --- PAGINATION MATH ---
  const totalPages = Math.max(1, Math.ceil(displayList.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  
  // This is the tiny chunk of 5 documents we will actually draw on the screen
  const paginatedList = displayList.slice(startIndex, endIndex)

  return (
    <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
      {selectedDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compliance-review-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Compliance review</p>
                <h2 id="compliance-review-title" className="mt-2 text-xl font-bold text-foreground">
                  {selectedDocument.name || selectedDocument.filename}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDocument(null)}
                aria-label="Close compliance review"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-muted/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">Officer&apos;s comment</span>
                <StatusBadge status={selectedDocument.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {selectedDocument.officer_comment ||
                  (selectedDocument.status?.toLowerCase() === 'in_review'
                    ? 'Currently being reviewed by a compliance officer.'
                    : 'Document received and queued for compliance review.')}
              </p>

            </div>

            {threadData && threadData.versions?.length > 1 && (
              <div className="mt-4 rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="size-3.5 text-primary" />
                  <span>Revision Thread ({threadData.total_versions} versions)</span>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                  {threadData.versions.map((ver: DocumentThreadVersion) => (
                    <div
                      key={ver.document_id}
                      className={`flex items-center justify-between rounded-md p-2 text-xs transition ${
                        ver.document_id === selectedDocument.id ? 'bg-primary/5 font-medium' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">v{ver.version}</span>
                        <span className="max-w-[180px] truncate text-foreground">{ver.filename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={ver.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                {selectedDocument.type || selectedDocument.file_type} · Uploaded {selectedDocument.date || selectedDocument.upload_date}
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={resubmitInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx"
                  className="hidden"
                  onChange={handleResubmit}
                />
                {selectedDocument.status?.toLowerCase() === 'needs_revision' && (
                  <button
                    onClick={() => resubmitInputRef.current?.click()}
                    disabled={isResubmitting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isResubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Resubmit Revision
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAuditDoc(selectedDocument)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  Audit Log
                </button>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Advisor portal</p>
          <h1 className="font-sans text-3xl font-bold tracking-tight text-primary sm:text-4xl">My submissions</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review and manage the documents you&apos;ve submitted for compliance.
          </p>
        </div>
        <button
          onClick={onUpload}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Upload className="size-4" />
          Upload document
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex gap-3 lg:flex-col">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
            <p className="mt-2 text-2xl font-bold text-primary">{totalSubmitted}</p>
            <p className="mt-1 text-xs text-muted-foreground">documents</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved</p>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{totalApproved}</p>
            <p className="mt-1 text-xs text-emerald-700">documents</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Needs review</p>
            <p className="mt-2 text-2xl font-bold text-amber-800">{totalNeedsReview}</p>
            <p className="mt-1 text-xs text-amber-700">documents</p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-52 rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder="Search documents"
                    aria-label="Search documents"
                />
              </div>
<div className="relative">
  <Filter className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="h-9 appearance-none rounded-md border border-input bg-card pl-9 pr-8 text-sm font-medium text-muted-foreground outline-none hover:bg-muted focus:ring-2 focus:ring-primary cursor-pointer"
  >
    <option value="All">All statuses</option>
    <option value="pending">Pending</option>
    <option value="in_review">In Review</option>
    <option value="approved">Approved</option>
    <option value="needs_revision">Needs Revision</option>
    <option value="rejected">Rejected</option>
  </select>
</div>
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">{displayList.length} documents</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-muted/45 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Document name</th>
                    <th className="px-5 py-3.5">Upload date</th>
                    <th className="px-5 py-3.5">File type</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="size-5 animate-spin text-primary" />
                          <p className="text-sm">Loading your submissions...</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                        <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <FileText className="size-5" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">No submissions found</p>
                          <p className="mt-1 mb-4 text-xs text-muted-foreground">
                            {searchQuery || statusFilter !== 'All'
                              ? 'No documents match your filter criteria.'
                              : 'You have not submitted any documents for compliance review yet.'}
                          </p>
                          {!searchQuery && statusFilter === 'All' && (
                            <button
                              onClick={onUpload}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                            >
                              <Upload className="size-3.5" />
                              Upload your first document
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((item, index) => {
                      const docName = item.name || item.filename
                      const docDate = item.date || item.upload_date
                      const docType = item.type || item.file_type

                      return (
                        <tr className="group hover:bg-muted/30" key={item.id || docName || index}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-primary">
                                <FileText className="size-4" />
                              </span>
                              <span className="font-medium text-foreground">{docName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{docDate}</td>
                          <td className="px-5 py-4">
                            <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{docType}</span>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAuditDoc(item)
                                }}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                Audit Log
                              </button>
                              <button
                                onClick={() => setSelectedDocument(item)}
                                className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
  <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
    <span>
      Showing {displayList.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, displayList.length)} of {displayList.length}
    </span>
    <div className="flex gap-1">
      <button 
        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page" 
        className="rounded p-1.5 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button 
        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages}
        aria-label="Next page" 
        className="rounded p-1.5 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  </div>
          </div>
        </div>
      </div>

      {auditDoc && (
        <AuditLogModal
          isOpen={!!auditDoc}
          onClose={() => setAuditDoc(null)}
          documentId={auditDoc.id}
          documentTitle={auditDoc.name || auditDoc.filename}
        />
      )}
    </section>
  )
}