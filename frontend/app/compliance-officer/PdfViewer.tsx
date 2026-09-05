'use client'
import { useState, useEffect } from 'react'
import { FileText, Loader2, Download, FileType } from 'lucide-react'

export default function PdfViewer({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUrl() {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(`http://localhost:8000/queue/${doc.id}/view`, {
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

  return (
    <section className="flex min-h-[620px] flex-1 flex-col bg-muted/35 lg:min-h-0">
      <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-border bg-card px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-destructive">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{doc.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Uploaded {doc.uploaded}</p>
          </div>
        </div>
        <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 sm:inline-flex uppercase">
          {doc.status}
        </span>
      </div>
      
      <div className="flex flex-1 items-center justify-center p-4">
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
