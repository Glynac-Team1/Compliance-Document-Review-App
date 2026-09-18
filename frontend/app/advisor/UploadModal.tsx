'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  Loader2,
  Shield,
  FileSpreadsheet,
  FileCheck2,
  RefreshCw,
} from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'
import { useToast } from '@/components/Toast'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (filename: string) => void
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex !== -1 ? filename.slice(dotIndex).toLowerCase() : ''
}

function getFormatBadge(ext: string) {
  switch (ext) {
    case '.pdf':
      return { label: 'PDF Document', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900' }
    case '.docx':
      return { label: 'Word Document', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900' }
    case '.xlsx':
      return { label: 'Excel Spreadsheet', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' }
    default:
      return { label: 'Unknown Format', color: 'bg-muted text-muted-foreground border-border' }
  }
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const { toast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isUploading) {
        handleClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isUploading])

  function handleClose() {
    if (isUploading) return
    setSelectedFile(null)
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  function validateFile(file: File): boolean {
    const ext = getFileExtension(file.name)
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(
        'Unsupported File Type',
        `'${file.name}' has an unsupported extension (${ext || 'unknown'}). Only PDF (.pdf), Word (.docx), and Excel (.xlsx) files are accepted.`
      )
      return false
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        'File Size Limit Exceeded',
        `'${file.name}' (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 10 MB.`
      )
      return false
    }

    return true
  }

  function handleFileSelected(file: File) {
    if (!validateFile(file)) {
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSelectedFile(file)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
  }

  async function handleSubmit() {
    if (!selectedFile || isUploading) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        toast.error('Authentication Required', 'No active session token found. Please log in again.')
        return
      }

      const response = await fetch(`${getApiBaseUrl()}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed.')
      }

      const data = await response.json()
      const docName = data.filename || selectedFile.name

      toast.success(
        'Document Submitted',
        `${docName} has been queued for automated policy checks and officer review.`
      )

      onSuccess(docName)
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.'
      toast.error('Upload Error', message)
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  const fileExt = selectedFile ? getFileExtension(selectedFile.name) : ''
  const badgeInfo = getFormatBadge(fileExt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-base font-bold text-foreground">
                Submit Document for Review
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Queued for automated compliance analysis and officer sign-off
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx"
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Modal Body */}
        <div className="mt-5 space-y-4">
          {!selectedFile ? (
            /* Step 1: Upfront Guidance & Drag-and-Drop Picker */
            <>
              {/* Guidance Cards */}
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Accepted Document Formats
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-border/80 bg-card p-2.5 text-center">
                    <span className="font-semibold text-foreground block">PDF (.pdf)</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Presentations & Tear Sheets</span>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-card p-2.5 text-center">
                    <span className="font-semibold text-foreground block">Word (.docx)</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Marketing Copy & Letters</span>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-card p-2.5 text-center">
                    <span className="font-semibold text-foreground block">Excel (.xlsx)</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Fee & Return Schedules</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>Maximum file size: <strong>10 MB</strong></span>
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Shield className="size-3" /> Tenant Encrypted
                  </span>
                </div>
              </div>

              {/* Drag-and-Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/20'
                }`}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                  <Upload className="size-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Drag and drop your document here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or <span className="text-primary font-medium hover:underline">browse files</span> from your computer
                </p>
              </div>
            </>
          ) : (
            /* Step 2: Post-Selection Confirmation Screen */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected File Confirmation
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <RefreshCw className="size-3" />
                  <span>Choose different file</span>
                </button>
              </div>

              {/* File Preview Card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card border border-border shadow-sm text-primary">
                    {fileExt === '.xlsx' ? (
                      <FileSpreadsheet className="size-5 text-emerald-600" />
                    ) : (
                      <FileText className="size-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badgeInfo.color}`}>
                        {badgeInfo.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    disabled={isUploading}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition"
                    title="Remove file"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Verified Status */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Valid format and size. Ready to submit to the compliance review queue.
                </span>
              </div>

              {/* Compliance Notice */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                By submitting, this document will be ingested into your organization&apos;s workspace and checked against corporate SEC/FINRA policy guidelines.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-border/70">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {selectedFile && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Submitting Document...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="size-3.5" />
                  <span>Submit for Compliance Review</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
