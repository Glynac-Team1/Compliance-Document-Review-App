'use client'
import { useState, useEffect } from 'react'
import { FileText, Loader2, Download, FileType } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'

export default function PdfViewer({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUrl() {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`${getApiBaseUrl()}/queue/${doc.id}/view`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUrl(data.url)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchUrl()
  }, [doc.id])

  const fileExt = doc.file_type?.toLowerCase() || 'unknown'
  const canRenderInline = ['pdf', 'txt', 'md'].includes(fileExt)

  // Dynamically determine the display name for the fallback card
  let fileTypeName = 'Document'
  if (fileExt === 'docx' || fileExt === 'doc') fileTypeName = 'Word Document'
  else if (fileExt === 'xlsx' || fileExt === 'xls' || fileExt === 'csv') fileTypeName = 'Excel Spreadsheet'
  else if (fileExt === 'pptx' || fileExt === 'ppt') fileTypeName = 'PowerPoint Presentation'

  const normalizedStatus = (doc.status || '').toLowerCase()
  let statusBadgeStyles = 'bg-amber-50 text-amber-700 ring-amber-200'
  let statusBadgeLabel = doc.status ? doc.status.replace('_', ' ') : 'Pending'

  if (normalizedStatus === 'approved') {
    statusBadgeStyles = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    statusBadgeLabel = 'Approved'
  } else if (normalizedStatus === 'rejected') {
    statusBadgeStyles = 'bg-rose-50 text-rose-700 ring-rose-200'
    statusBadgeLabel = 'Rejected'
  } else if (normalizedStatus === 'needs_revision') {
    statusBadgeStyles = 'bg-sky-50 text-sky-700 ring-sky-200'
    statusBadgeLabel = 'Needs Revision'
  } else if (normalizedStatus === 'in_review') {
    statusBadgeStyles = 'bg-blue-50 text-blue-700 ring-blue-200'
    statusBadgeLabel = 'In Review'
  } else if (normalizedStatus === 'pending') {
    statusBadgeStyles = 'bg-amber-50 text-amber-700 ring-amber-200'
    statusBadgeLabel = 'Pending Review'
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-muted/35 overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-destructive">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs sm:text-sm font-semibold">{doc.name}</p>
            <p className="text-[11px] text-muted-foreground">Uploaded {doc.uploaded}</p>
          </div>
        </div>
        <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset sm:inline-flex uppercase ${statusBadgeStyles}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {statusBadgeLabel}
        </span>
      </div>
      
      <div className="flex flex-1 min-h-0 items-center justify-center p-2 sm:p-4 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin mb-4" />
            <p className="text-sm">Retrieving secure document link...</p>
          </div>
        ) : url ? (
          canRenderInline ? (
            <iframe 
              src={url} 
              className="w-full h-full rounded-lg border border-border bg-white shadow-sm"
              title="Document Viewer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center max-w-md p-8 rounded-xl border border-border bg-card shadow-sm">
              <FileType className="size-12 mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">{fileTypeName}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Browsers cannot securely render .{fileExt} files inline. The AI has already analyzed this file, but to read it manually you must download it.
              </p>
              <a 
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Download className="size-4" />
                Download {doc.name}
              </a>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            <FileText className="size-12 mb-4 opacity-20" />
            <p>Could not load document securely.</p>
          </div>
        )}
      </div>
    </section>
  )
}
