'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Filter, Search, X, Upload } from 'lucide-react'

const fallbackSubmissions = [
  { name: 'Q3 Marketing Brochure', date: 'Oct 24, 2024', type: 'PDF', status: 'Approved' },
  { name: 'Client Risk Assessment', date: 'Oct 22, 2024', type: 'DOCX', status: 'Pending' },
  { name: 'Investment Policy Statement', date: 'Oct 18, 2024', type: 'PDF', status: 'Needs Revision' },
  { name: 'Annual Financial Review', date: 'Oct 12, 2024', type: 'XLSX', status: 'Approved' },
  { name: 'Client Onboarding Form', date: 'Oct 08, 2024', type: 'DOCX', status: 'Rejected' },
]

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase()
  const styles =
    normalized === 'approved'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : normalized === 'pending' || normalized === 'in_review'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-red-50 text-red-700 ring-red-200'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export default function Submissions({ onUpload }: { onUpload: () => void }) {
  const [documents, setDocuments] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')
  const itemsPerPage = 5
  // Automatically go back to page 1 if the user searches for something
  useEffect(() => {
    setCurrentPage(1)

  }, [searchQuery, statusFilter])

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        const response = await fetch('http://localhost:8000/documents/mine', {
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

    fetchDocuments()
  }, [])

    //  master list (either from DB or fallback)
  const baseList = documents.length > 0 ? documents : fallbackSubmissions
  
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

  const [selectedDocument, setSelectedDocument] = useState<any | null>(null)
  const complianceComments: Record<string, string> = {
    'Q3 Marketing Brochure': 'Approved for client distribution.',
    'Client Risk Assessment': 'Compliance is reviewing the suitability rationale.',
  }
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
                {complianceComments[selectedDocument.name || selectedDocument.filename] ||
                  'Document received and queued for compliance review.'}
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                {selectedDocument.type || selectedDocument.file_type} · Uploaded {selectedDocument.date || selectedDocument.upload_date}
              </span>
              <button
                onClick={() => setSelectedDocument(null)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
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
                      <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                        Loading documents...
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
                            <button
                              onClick={() => setSelectedDocument(item)}
                              className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100"
                            >
                              View
                            </button>
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
    </section>
  )
}