'use client'

import { useEffect, useRef, useState } from 'react'
import Submissions from './Submissions'
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'

const submissions = [
  { name: 'Q3 Marketing Brochure', date: 'Oct 24, 2024', type: 'PDF', status: 'Approved' },
  { name: 'Client Risk Assessment', date: 'Oct 22, 2024', type: 'DOCX', status: 'Pending' },
  { name: 'Investment Policy Statement', date: 'Oct 18, 2024', type: 'PDF', status: 'Needs Revision' },
  { name: 'Annual Financial Review', date: 'Oct 12, 2024', type: 'XLSX', status: 'Approved' },
  { name: 'Client Onboarding Form', date: 'Oct 08, 2024', type: 'DOCX', status: 'Rejected' },
]

const notifications = [
  { title: "Your document 'Q3 Marketing Brochure' was Approved by Compliance", time: '2 hours ago', tone: 'success' },
  { title: "Action required: update 'Investment Policy Statement'", time: 'Yesterday', tone: 'warning' },
  { title: "Your document 'Client Risk Assessment' is under review", time: 'Oct 22, 2024', tone: 'info' },
  { title: "Your document 'Annual Financial Review' was Approved", time: 'Oct 12, 2024', tone: 'success' },
]

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

export default function Page() {
    const [user, setUser] = useState({ name: 'Loading...', role: '' })

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      
      try {
        const response = await fetch('http://localhost:8000/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setUser(data)
        }
      } catch (err) {
        console.error("Failed to fetch user profile")
      }
    }
    fetchUser()
  }, [])
  
  // math function to grab the first letter of their first and last name
  const initials = user.name === 'Loading...' ? '..' : user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  const [panelOpen, setPanelOpen] = useState(true)
  const [screen, setScreen] = useState('Submissions')
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploaded, setUploaded] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        alert('Security error: No authentication token found. Please log in again.')
        return
      }

      const response = await fetch('http://localhost:8000/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const data = await response.json()
      console.log('Backend Response:', data)

      setUploaded(true)
      setTimeout(() => setUploaded(false), 3000)
    } catch (error: any) {
      alert('Upload failed: ' + error.message)
    }
  }

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
            <button
              aria-label={panelOpen ? 'Collapse notifications' : 'Expand notifications'}
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen(!panelOpen)}
              className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Bell className="size-5" />
              <span className="absolute right-1 top-1 size-2.5 rounded-full bg-red-500 ring-2 ring-card" />
            </button>
            <div className="h-7 w-px bg-border" />
            <button className="flex items-center gap-2 text-left">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-sm sm:block">
                    <span className="block font-semibold text-foreground">{user.name}</span>
                    <span className="block text-xs text-muted-foreground capitalize">{user.role}</span>
                  </span>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {screen === 'Submissions' && <Submissions onUpload={() => fileInput.current?.click()} />}
        {screen === 'Resources' && <Resources />}
        {screen === 'Support' && <Support />}

        <input ref={fileInput} className="hidden" type="file" onChange={handleFileUpload} />

        {panelOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-slate-300 bg-card text-slate-900 lg:block" aria-label="Notifications">
            <div className="flex items-center justify-between border-b border-slate-300 px-5 py-5">
              <h2 className="text-base font-bold">Notifications</h2>
              <button
                aria-label="Collapse notifications"
                onClick={() => setPanelOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Recent updates</span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">3 new</span>
              </div>
              <div className="space-y-3">
                {notifications.map((note, index) => (
                  <div className="relative flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 shadow-sm" key={note.title}>
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        note.tone === 'success' ? 'bg-emerald-500' : note.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm leading-5 text-slate-800">{note.title}</p>
                      <p className="mt-1.5 text-xs text-slate-600">{note.time}</p>
                    </div>
                    {index < 3 && <span className="absolute right-2 top-4 size-1.5 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
              <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                View all notifications <ChevronRight className="size-3.5" />
              </button>
            </div>
          </aside>
        )}
      </div>

      {uploaded && (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg">
          Document selected and ready for review.
        </div>
      )}
    </main>
  )
}
