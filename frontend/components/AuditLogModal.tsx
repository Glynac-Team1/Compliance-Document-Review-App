'use client'

import { useEffect } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import AuditTrailView from './AuditTrailView'

interface AuditLogModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentTitle?: string
}

export default function AuditLogModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
}: AuditLogModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-log-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 id="audit-log-title" className="text-base font-bold text-foreground">
                Audit Trail
              </h2>
              {documentTitle && (
                <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                  {documentTitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close audit log"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
          <AuditTrailView documentId={documentId} />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-border/70 px-5 py-3.5 sm:px-6 bg-muted/20 rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
