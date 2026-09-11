'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PdfViewer from "./PdfViewer"
import Queue from './Queue'
import ReviewPanel from './ReviewPanel'
import UserNav from '@/components/UserNav'
import NotificationPopover from '@/components/NotificationPopover'
import { useLiveSync, AppNotification } from '@/lib/useLiveSync'
import { getApiBaseUrl } from '@/lib/api'
import {
  ArrowLeft,
  BarChart3,
  FileCheck2,
  LayoutList,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

type Document = any

type Screen = 'queue' | 'recent' | 'analytics' | 'settings'

function Brand({
  collapsed,
  onToggle,
}: {
  collapsed?: boolean
  onToggle?: () => void
}) {
  if (collapsed) {
    return (
      <div className="flex h-16 shrink-0 flex-col items-center justify-center border-b border-border/60">
        <button
          onClick={onToggle}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition shadow-sm"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 px-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight truncate">Northstar</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Compliance
          </p>
        </div>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="size-4" />
        </button>
      )}
    </div>
  )
}

function Nav({
  screen,
  setScreen,
  refreshTrigger,
  collapsed,
  onSelectNav,
}: {
  screen: Screen
  setScreen: (screen: Screen) => void
  refreshTrigger?: number
  collapsed?: boolean
  onSelectNav?: () => void
}) {
  const [queueCount, setQueueCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch(`${getApiBaseUrl()}/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          // Only count pending or in_review documents for the badge
          const pending = data.documents.filter((d: any) => {
            const s = (d.status || '').toLowerCase()
            return s === 'pending' || s === 'in_review'
          })
          setQueueCount(pending.length)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  const items = [
    ['queue', 'Review queue', LayoutList],
    ['recent', 'Recently reviewed', FileCheck2],
    ['analytics', 'Analytics', BarChart3],
    ['settings', 'Settings', Settings],
  ] as const

  const handleClick = (id: Screen) => {
    setScreen(id)
    if (onSelectNav) onSelectNav()
  }

  return (
    <nav className="flex flex-col gap-1.5 px-2 py-3" aria-label="Workspace navigation">
      {items.map(([id, label, Icon]) => {
        const isActive = screen === id
        if (collapsed) {
          return (
            <button
              key={id}
              onClick={() => handleClick(id)}
              className={`relative mx-auto flex size-10 items-center justify-center rounded-xl transition ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={label}
              aria-label={label}
            >
              <Icon className="size-4 shrink-0" />
              {id === 'queue' && queueCount !== null && queueCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-sm">
                  {queueCount > 99 ? '99+' : queueCount}
                </span>
              )}
            </button>
          )
        }

        return (
          <button
            key={id}
            onClick={() => handleClick(id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              isActive
                ? 'bg-primary/8 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
            {id === 'queue' && queueCount !== null && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {queueCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

function Review({
  doc,
  onBack,
  onOpenMobileNav,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onSelectDocument,
  onStatusChange,
}: {
  doc: Document
  onBack: () => void
  onOpenMobileNav: () => void
  notifications: AppNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onSelectDocument: (documentId: string) => void
  onStatusChange?: (status: string) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Pinned Review Header Sub-bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onOpenMobileNav}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back to review queue</span>
            <span className="sm:hidden">Back</span>
          </button>
          <span className="text-border">/</span>
          <span className="max-w-[180px] sm:max-w-[280px] md:max-w-[360px] truncate text-xs font-semibold text-foreground">
            {doc.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-emerald-600 md:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            Live synced
          </span>
          <NotificationPopover
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onSelectDocument={onSelectDocument}
          />
        </div>
      </div>

      {/* Split Viewer and Review Panel Area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
        <PdfViewer doc={doc} />
        <ReviewPanel doc={doc} onSuccess={onBack} onStatusChange={onStatusChange} />
      </div>
    </div>
  )
}

function DashboardView({
  children,
  screen,
  onOpenMobileNav,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onSelectDocument,
}: {
  children: React.ReactNode
  screen: Screen
  onOpenMobileNav: () => void
  notifications: AppNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onSelectDocument: (documentId: string) => void
}) {
  const titleMap: Record<Screen, string> = {
    queue: 'Review queue',
    recent: 'Recently reviewed',
    analytics: 'Analytics',
    settings: 'Workspace settings',
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileNav}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-semibold">{titleMap[screen]}</p>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 text-xs text-emerald-600 sm:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            Live synced
          </span>
          <NotificationPopover
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onSelectDocument={onSelectDocument}
          />
          <div className="lg:hidden">
            <UserNav variant="header" />
          </div>
        </div>
      </header>

      {/* Main scrollable body for dashboard views */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function Placeholder({ screen }: { screen: Screen }) {
  const titles: Record<Screen, string> = {
    queue: 'Review queue',
    recent: 'Recently reviewed',
    analytics: 'Team analytics',
    settings: 'Workspace settings',
  }

  return (
    <div className="mx-auto max-w-[1100px] p-5 lg:p-8">
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <SlidersHorizontal className="size-5" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{titles[screen]}</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          This workspace view is ready for your team’s operational data. Connect it to your document service
          to see live activity, trends, and reviewer preferences here.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-semibold">Coming next</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Live {screen} data and saved filters.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-semibold">Designed for audit</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Every action is traceable and exportable.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-semibold">Role-aware</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Views adapt to reviewer permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface OfficerWorkspaceProps {
  slug?: string
}

export default function OfficerWorkspace({ slug }: OfficerWorkspaceProps) {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('queue')
  const [selected, setSelected] = useState<Document | null>(null)
  const [queueSyncTrigger, setQueueSyncTrigger] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('officer_sidebar_collapsed')
    if (saved === 'true') {
      setIsCollapsed(true)
    }
  }, [])

  const handleToggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('officer_sidebar_collapsed', String(next))
      return next
    })
  }

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useLiveSync({
    onSync: (_event, _docId) => {
      setQueueSyncTrigger((prev) => prev + 1)
    },
  })

  const handleOpenReview = (doc: any) => {
    setSelected(doc)
    if (doc?.id) {
      try {
        localStorage.setItem('officer_active_doc_id', doc.id)
        const url = new URL(window.location.href)
        url.searchParams.set('doc', doc.id)
        window.history.replaceState(null, '', url.toString())
      } catch (e) {
        console.error(e)
      }
    }
  }

  const handleCloseReview = () => {
    setSelected(null)
    try {
      localStorage.removeItem('officer_active_doc_id')
      const url = new URL(window.location.href)
      url.searchParams.delete('doc')
      window.history.replaceState(null, '', url.toString())
    } catch (e) {
      console.error(e)
    }
    setQueueSyncTrigger((prev) => prev + 1)
  }

  const handleStatusChange = (newStatus: string) => {
    setSelected((prev: any) => {
      if (!prev) return null
      return { ...prev, status: newStatus }
    })
    setQueueSyncTrigger((prev) => prev + 1)
  }

  const handleSelectDocument = async (documentId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const res = await fetch(`${getApiBaseUrl()}/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const doc = await res.json()
        handleOpenReview(doc)
      } else if (res.status === 404) {
        localStorage.removeItem('officer_active_doc_id')
      }
    } catch (e) {
      console.error('Failed to load document for review', e)
    }
  }

  // Restore active document on reload
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const docId = params.get('doc') || localStorage.getItem('officer_active_doc_id')
      if (docId) {
        handleSelectDocument(docId)
      }
    } catch (e) {
      console.error('Failed to restore active document on mount', e)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/')
      return
    }
    const role = localStorage.getItem('user_role')
    if (role && role !== 'officer') {
      const savedSlug = localStorage.getItem('user_slug') || 'workspace'
      router.replace(`/advisor/${savedSlug}`)
      return
    }
  }, [router])

  return (
    <main className="relative h-screen max-h-screen w-full overflow-hidden bg-background text-foreground flex">
      {/* Mobile Backdrop Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Panel - Absolute, full height, does not scroll with page content */}
      <aside
        className={`absolute inset-y-0 left-0 z-50 lg:z-30 flex flex-col border-r border-border bg-card shadow-sm transition-all duration-300 ease-in-out ${
          mobileNavOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'lg:w-16' : 'lg:w-60'
        }`}
      >
        <Brand
          collapsed={isCollapsed}
          onToggle={handleToggleSidebar}
        />

        <div className="flex-1 min-h-0 overflow-y-auto py-1">
          <Nav
            screen={screen}
            setScreen={(newScreen) => {
              setScreen(newScreen)
              if (selected) {
                handleCloseReview()
              }
              setMobileNavOpen(false)
            }}
            refreshTrigger={queueSyncTrigger}
            collapsed={isCollapsed}
          />
        </div>

        {/* Officer who is logged in - Pinned to bottom, ALWAYS visible on one screen */}
        <div className={`mt-auto shrink-0 border-t border-border ${isCollapsed ? 'p-2' : 'p-3'}`}>
          <UserNav variant="sidebar" collapsed={isCollapsed} />
        </div>
      </aside>

      {/* Main Content Area - Offsets dynamically for absolute left panel */}
      <div
        className={`flex h-screen max-h-screen flex-1 flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-16' : 'lg:pl-60'
        }`}
      >
        {selected ? (
          <Review
            doc={selected}
            onBack={handleCloseReview}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markAsRead}
            onMarkAllRead={markAllAsRead}
            onSelectDocument={handleSelectDocument}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <DashboardView
            screen={screen}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markAsRead}
            onMarkAllRead={markAllAsRead}
            onSelectDocument={handleSelectDocument}
          >
            {screen === 'queue' ? (
              <Queue onReview={handleOpenReview} initialTab="unreviewed" refreshTrigger={queueSyncTrigger} />
            ) : screen === 'recent' ? (
              <Queue onReview={handleOpenReview} initialTab="reviewed" refreshTrigger={queueSyncTrigger} />
            ) : (
              <Placeholder screen={screen} />
            )}
          </DashboardView>
        )}
      </div>
    </main>
  )
}
