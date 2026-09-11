'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toast: {
    success: (title: string, description?: string, duration?: number) => void
    error: (title: string, description?: string, duration?: number) => void
    warning: (title: string, description?: string, duration?: number) => void
    info: (title: string, description?: string, duration?: number) => void
    dismiss: (id: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 4500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const newToast: ToastMessage = { id, type, title, description, duration }

      setToasts((prev) => [...prev, newToast])

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id)
        }, duration)
      }
    },
    [dismiss]
  )

  const toast = {
    success: (title: string, description?: string, duration?: number) =>
      addToast('success', title, description, duration),
    error: (title: string, description?: string, duration?: number) =>
      addToast('error', title, description, duration),
    warning: (title: string, description?: string, duration?: number) =>
      addToast('warning', title, description, duration),
    info: (title: string, description?: string, duration?: number) =>
      addToast('info', title, description, duration),
    dismiss,
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="region"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-50 flex max-w-sm w-full flex-col gap-2 pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-md text-foreground transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'success'
                ? 'border-emerald-500/30'
                : t.type === 'error'
                ? 'border-destructive/40'
                : t.type === 'warning'
                ? 'border-amber-500/30'
                : 'border-border'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' && <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="size-4 text-destructive" />}
              {t.type === 'warning' && <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />}
              {t.type === 'info' && <Info className="size-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight text-foreground">{t.title}</p>
              {t.description && (
                <p className="text-[11px] text-muted-foreground mt-1 leading-normal break-words">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:text-foreground transition"
              aria-label="Close notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
