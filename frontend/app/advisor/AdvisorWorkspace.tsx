'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Submissions from './Submissions'
import UploadModal from './UploadModal'
import UserNav from '@/components/UserNav'
import NotificationPopover from '@/components/NotificationPopover'
import { useLiveSync } from '@/lib/useLiveSync'
import { getApiBaseUrl } from '@/lib/api'
import { useToast } from '@/components/Toast'
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Filter,
  HelpCircle,
  Mail,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'

const resources = [
  {
    title: 'Investment communications guide',
    type: 'Compliance guide',
    detail: 'A practical checklist for creating clear, compliant client-facing investment communications.',
    icon: ShieldCheck,
  },
  {
    title: 'Advisor onboarding toolkit',
    type: 'Toolkit',
    detail: 'Templates and workflows to help new clients move from discovery to account opening.',
    icon: BookOpen,
  },
  {
    title: 'Quarterly review checklist',
    type: 'Best practice',
    detail: 'Prepare for productive quarterly reviews with this field-tested preparation checklist.',
    icon: CheckCircle2,
  },
  {
    title: 'Document submission standards',
    type: 'Policy',
    detail: 'Learn what Compliance looks for when reviewing documents and how to avoid revisions.',
    icon: FileText,
  },
]

function Resources() {
  const [selected, setSelected] = useState<(typeof resources)[number] | null>(null)

  return (
    <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Knowledge center</p>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Resources</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Tools and guidance to help you advise with confidence.</p>
        </div>
        <button className="hidden items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-semibold text-primary hover:bg-muted sm:inline-flex">
          <Plus className="size-4" />
          Suggest a resource
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2"
            placeholder="Search guides, policies, and templates"
            aria-label="Search resources"
          />
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium text-muted-foreground hover:bg-muted">
          <Filter className="size-4" />
          All types
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {resources.map((resource) => {
          const Icon = resource.icon
          return (
            <button
              key={resource.title}
              onClick={() => setSelected(resource)}
              className="group rounded-lg border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="mb-5 flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{resource.type}</p>
              <h2 className="font-semibold text-foreground">{resource.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.detail}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Open resource <ChevronRight className="size-3.5" />
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{selected.type}</p>
                <h2 className="mt-2 text-xl font-bold text-foreground">{selected.title}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close resource"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              {selected.detail} This resource is available to reference any time from your advisor portal.
            </p>
            <button onClick={() => setSelected(null)} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Support() {
  const [sent, setSent] = useState(false)

  return (
    <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">We&apos;re here to help</p>
      <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Support</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Get answers, contact our team, or submit a request to Compliance support.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <button className="rounded-lg border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
          <Mail className="size-5 text-primary" />
          <h2 className="mt-4 font-semibold">Email support</h2>
          <p className="mt-1 text-sm text-muted-foreground">Usually replies within one business day.</p>
        </button>
        <button className="rounded-lg border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="mt-4 font-semibold">Live chat</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chat with the advisor operations team.</p>
        </button>
        <button className="rounded-lg border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
          <HelpCircle className="size-5 text-primary" />
          <h2 className="mt-4 font-semibold">Help center</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse common questions and answers.</p>
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSent(true)
          }}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-foreground">Submit a support request</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell us what you need and we&apos;ll route it to the right team.</p>
          <label className="mt-5 block text-sm font-medium">
            Subject
            <input
              required
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="What can we help with?"
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Message
            <textarea
              required
              className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add details about your request"
            />
          </label>
          <button className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Send request
          </button>
          {sent && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4" />
              Your request was submitted successfully.
            </p>
          )}
        </form>

        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-bold">Frequently asked questions</h2>
          {['How long does Compliance review take?', 'What file types can I upload?', 'How do I request a document revision?'].map(
            (question) => (
              <button
                key={question}
                className="flex w-full items-center justify-between border-b border-border py-4 text-left text-sm font-medium hover:text-primary"
              >
                {question}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            )
          )}
        </div>
      </div>
    </section>
  )
}

interface AdvisorWorkspaceProps {
  slug?: string
}

export default function AdvisorWorkspace({ slug: _slug }: AdvisorWorkspaceProps) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/')
      return
    }
    const role = localStorage.getItem('user_role')
    if (role && role !== 'advisor') {
      const savedSlug = localStorage.getItem('user_slug') || 'workspace'
      router.replace(`/compliance-officer/${savedSlug}`)
      return
    }
  }, [router])

  const { toast } = useToast()
  const [screen, setScreen] = useState('Submissions')
  const [syncTrigger, setSyncTrigger] = useState(0)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useLiveSync({
    onSync: (_event, _docId) => {
      setSyncTrigger((prev) => prev + 1)
    },
  })

  const nav = ['Submissions', 'Resources', 'Support']

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-10">
            <button onClick={() => setScreen('Submissions')} className="flex items-center gap-3 text-primary">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileCheck2 className="size-5" />
              </span>
              <span className="font-sans text-[17px] font-bold tracking-tight">
                NORTHSTAR <span className="font-normal text-muted-foreground">ADVISORY</span>
              </span>
            </button>
            <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
              {nav.map((item) => (
                <button
                  key={item}
                  onClick={() => setScreen(item)}
                  className={`border-b-2 py-7 transition ${
                    screen === item ? 'border-primary text-primary' : 'border-transparent hover:text-primary'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <NotificationPopover
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markAsRead}
              onMarkAllRead={markAllAsRead}
              onSelectDocument={(docId) => {
                setScreen('Submissions')
                setSelectedDocId(docId)
              }}
            />
            <div className="h-7 w-px bg-border" />
            <UserNav variant="header" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {screen === 'Submissions' && (
          <Submissions
            onUpload={() => setIsUploadModalOpen(true)}
            refreshTrigger={syncTrigger}
            selectedDocId={selectedDocId}
          />
        )}
        {screen === 'Resources' && <Resources />}
        {screen === 'Support' && <Support />}

        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => setSyncTrigger((prev) => prev + 1)}
        />
      </div>
    </main>
  )
}
