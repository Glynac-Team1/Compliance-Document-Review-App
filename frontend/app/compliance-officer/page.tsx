'use client'
import PdfViewer from "./PdfViewer"


import { useState, useEffect } from 'react'
import {

  Activity,
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  LayoutList,
  Maximize2,
  Menu,
  Minus,
  RotateCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ZoomIn,
} from 'lucide-react'
import Queue from './Queue'
import ReviewPanel from './ReviewPanel'

type Document = any

type Screen = 'queue' | 'recent' | 'analytics' | 'settings'

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className="size-5" />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight">Northstar</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Compliance
        </p>
      </div>
    </div>
  )
}

function Nav({
  screen,
  setScreen,
}: {
  screen: Screen
  setScreen: (screen: Screen) => void
}) {
  const [queueCount, setQueueCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        const res = await fetch('http://localhost:8000/queue', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          // Only count pending or in_review documents for the badge
          const pending = data.documents.filter((d: any) => 
            d.status.toLowerCase() !== 'approved' && d.status.toLowerCase() !== 'rejected'
          )
          setQueueCount(pending.length)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 10000)
    return () => clearInterval(interval)
  }, [])

  const items = [
    ['queue', 'Review queue', LayoutList],
    ['recent', 'Recently reviewed', FileCheck2],
    ['analytics', 'Analytics', BarChart3],
    ['settings', 'Settings', Settings],
  ] as const

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Workspace navigation">
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => setScreen(id)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
            screen === id
              ? 'bg-primary/8 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Icon className="size-4" />
          <span>{label}</span>
          {id === 'queue' && queueCount !== null && (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {queueCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

function Shell({
  children,
  screen,
  setScreen,
}: {
  children: React.ReactNode
  screen: Screen
  setScreen: (screen: Screen) => void
}) {
  const titleMap: Record<Screen, string> = {
    queue: 'Review queue',
    recent: 'Recently reviewed',
    analytics: 'Analytics',
    settings: 'Workspace settings',
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <Brand />
        <Nav screen={screen} setScreen={setScreen} />

        <div className="mt-auto border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              JD
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Jordan Davis</p>
              <p className="truncate text-[11px] text-muted-foreground">Compliance Officer</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-sm font-semibold">{titleMap[screen]}</p>
          </div>

          <div className="flex items-center gap-4">
              <span className="hidden items-center gap-1.5 text-xs text-emerald-600 sm:flex"><span className="relative flex size-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span></span>Live synced</span>
            <button
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              aria-label="Notifications"
            >
              <Activity className="size-4" />
            </button>
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground lg:hidden">
              JD
            </div>
          </div>
        </header>

        {children}
      </section>
    </main>
  )
}

function Review({ doc, onBack }: { doc: Document; onBack: () => void }) {
  return (
    <main className="flex min-h-screen flex-col bg-background lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to review queue
        </button>
        <span className="text-border">/</span>
        <span className="max-w-[220px] truncate text-xs text-muted-foreground">{doc.name}</span>
      </div>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <PdfViewer doc={doc} />
        <ReviewPanel doc={doc} onSuccess={onBack} />
      </div>
    </main>
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

export default function Page() {
  const [screen, setScreen] = useState<Screen>('queue')
  const [selected, setSelected] = useState<Document | null>(null)

  return selected ? (
    <Review doc={selected} onBack={() => setSelected(null)} />
  ) : (
    <Shell screen={screen} setScreen={setScreen}>
      {screen === 'queue' ? <Queue onReview={setSelected} /> : <Placeholder screen={screen} />}
    </Shell>
  )
}
