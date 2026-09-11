'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  FileText,
  CheckCircle2,
  X,
  Inbox,
  Filter,
} from 'lucide-react'
import { AppNotification } from '@/lib/useLiveSync'

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSec < 45) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return 'Recently'
  }
}

type TabType = 'all' | 'unread' | 'read'

interface NotificationPanelProps {
  notifications: AppNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onSelectDocument?: (documentId: string) => void
}

export default function NotificationPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onSelectDocument,
}: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const panelRef = useRef<HTMLDivElement>(null)

  // Filter list by selected tab
  const filteredList = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.is_read)
    }
    if (activeTab === 'read') {
      return notifications.filter((n) => n.is_read)
    }
    return notifications
  }, [notifications, activeTab])

  const readCount = useMemo(() => {
    return notifications.filter((n) => n.is_read).length
  }, [notifications])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Prevent background scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Dynamic Bell Icon Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} new)`
            : 'Notifications'
        }
        aria-expanded={isOpen}
        className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-600 ring-2 ring-card" />
          </span>
        )}
      </button>

      {/* Slide-over Notification Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over Content */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div
              ref={panelRef}
              className="w-screen max-w-md border-l border-border bg-card text-card-foreground shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-panel-title"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bell className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        id="notification-panel-title"
                        className="text-base font-semibold tracking-tight text-foreground"
                      >
                        Notifications
                      </h2>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Real-time updates on compliance documents & reviews
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notification panel"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Action Bar & Tabs */}
              <div className="border-b border-border bg-muted/20 px-6 py-3">
                <div className="flex items-center justify-between gap-2">
                  {/* Segmented Filter Tabs */}
                  <div className="flex items-center rounded-lg bg-muted/60 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${
                        activeTab === 'all'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('unread')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                        activeTab === 'unread'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Unread
                      {unreadCount > 0 && (
                        <span className="flex size-1.5 rounded-full bg-red-600" />
                      )}
                      <span>({unreadCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('read')}
                      className={`rounded-md px-3 py-1.5 font-medium transition ${
                        activeTab === 'read'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Read ({readCount})
                    </button>
                  </div>

                  {/* Mark All As Read */}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition"
                    >
                      <CheckCheck className="size-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {filteredList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {activeTab === 'unread' ? (
                        <CheckCircle2 className="size-6 text-emerald-600" />
                      ) : (
                        <Inbox className="size-6" />
                      )}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-foreground">
                      {activeTab === 'unread'
                        ? 'All caught up!'
                        : activeTab === 'read'
                        ? 'No read notifications'
                        : 'No notifications yet'}
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      {activeTab === 'unread'
                        ? 'You have viewed all active compliance notifications.'
                        : activeTab === 'read'
                        ? 'Notifications marked as read will appear here.'
                        : "You'll be notified automatically when documents are submitted or review decisions are made."}
                    </p>
                    {activeTab !== 'all' && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className="mt-4 text-xs font-semibold text-primary hover:underline"
                      >
                        View all notifications ({notifications.length})
                      </button>
                    )}
                  </div>
                ) : (
                  filteredList.map((item) => {
                    const isUnread = !item.is_read
                    return (
                      <div
                        key={item.id}
                        className={`group relative flex flex-col gap-2 p-5 transition ${
                          isUnread
                            ? 'bg-primary/[0.04] hover:bg-primary/[0.08]'
                            : 'bg-card hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Read/Unread Indicator Pill */}
                            <span
                              className={`mt-1 size-2 shrink-0 rounded-full ${
                                isUnread
                                  ? 'bg-primary ring-2 ring-primary/20'
                                  : 'bg-muted-foreground/30'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm leading-snug ${
                                  isUnread
                                    ? 'font-semibold text-foreground'
                                    : 'font-normal text-muted-foreground'
                                }`}
                              >
                                {item.message}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {formatTimeAgo(item.created_at)}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    isUnread
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {isUnread ? 'Unread' : 'Read'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Action: Mark single read */}
                          {isUnread && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onMarkRead(item.id)
                              }}
                              title="Mark as read"
                              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition shadow-sm"
                            >
                              <Check className="size-3" />
                              <span className="hidden sm:inline">Mark read</span>
                            </button>
                          )}
                        </div>

                        {/* Deep link button if document is associated */}
                        {item.document_id && onSelectDocument && (
                          <div className="mt-1 flex items-center pl-5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isUnread) onMarkRead(item.id)
                                onSelectDocument(item.document_id!)
                                setIsOpen(false)
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                            >
                              <FileText className="size-3.5" />
                              View document details & review thread →
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Panel Footer */}
              <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {notifications.length}{' '}
                  {notifications.length === 1 ? 'notification' : 'notifications'} total
                </span>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="font-semibold text-primary hover:underline"
                  >
                    Mark {unreadCount} unread as read
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="size-3.5" />
                    All caught up
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
