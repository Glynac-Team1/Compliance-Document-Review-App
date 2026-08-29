'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-primary-foreground">Northstar</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/55">Compliance</p>
      </div>
    </div>
  )
}

function RoleOption({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/[0.06] shadow-sm' : 'border-border bg-card hover:border-primary/40'}`} aria-pressed={selected}>
      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary' : 'border-input'}`}>{selected && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}</span>
      <span><span className="block text-xs font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{description}</span></span>
    </button>
  )
}

export default function Page() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<'Financial Advisor' | 'Compliance Officer'>('Financial Advisor')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setToast('')

    // Grab the values from the form
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')
    const name = formData.get('name') || "New User" // Only used for signup

    try {
      // Decision for /login or /signup
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup'

      // Send the request to FastAPI backend
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          role: role === 'Financial Advisor' ? 'advisor' : 'officer'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed")
      }

      // Save the real security token in the browser!
      localStorage.setItem("auth_token", data.token)

      // Securely route to the correct dashboard
      if (data.role === 'advisor') {
        router.push('/advisor')
      } else {
        router.push('/compliance-officer')
      }

    } catch (error: any) {
      setToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen bg-background lg:h-screen">
      <section className="relative hidden min-h-screen flex-1 overflow-hidden bg-primary p-8 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-12">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="hero-orbit pointer-events-none absolute -right-20 top-1/4 size-96 rounded-full border border-primary-foreground/10" />
        <div className="hero-orbit hero-orbit-delay pointer-events-none absolute -right-4 top-[32%] size-64 rounded-full border border-primary-foreground/10" />
        <div className="relative"><BrandMark /></div>
        <div className="relative max-w-xl pb-8 xl:pb-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.07] px-3 py-1.5 text-[11px] font-medium text-primary-foreground/75"><Sparkles className="size-3.5" />Intelligent review, built for trust</div>
          <h1 className="max-w-lg text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">Secure compliance review, <span className="text-primary-foreground/55">without the blind spots.</span></h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-primary-foreground/65">Northstar helps financial teams review documents with clarity, consistency, and an audit trail you can stand behind.</p>
          <div className="mt-10 flex items-center gap-6 text-xs text-primary-foreground/60"><span className="flex items-center gap-2"><Check className="size-3.5 text-primary-foreground/80" />AI-assisted findings</span><span className="flex items-center gap-2"><Check className="size-3.5 text-primary-foreground/80" />Decision-ready records</span></div>
        </div>
        <p className="relative text-[11px] text-primary-foreground/40">© 2024 Northstar Compliance Systems</p>
      </section>

      <section className="flex w-full items-center justify-center bg-muted/40 px-5 py-10 sm:px-8 lg:w-[48%] lg:min-w-[530px] xl:w-[46%]">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><BrandMark /></div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/[0.04] sm:p-9">
            <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Welcome to Northstar</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace account'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === 'login' ? 'Continue your secure review workflow.' : 'Start reviewing with confidence today.'}</p></div>
            <div className="mb-7 flex rounded-lg bg-muted p-1" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setToast('') }} className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Log In</button><button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setToast('') }} className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Sign Up</button></div>
            <form onSubmit={handleSubmit} className="auth-form flex flex-col gap-5" key={mode}>
              {mode === 'signup' && <label className="flex flex-col gap-2 text-xs font-semibold">Full name<input required name="name" type="text" placeholder="Jordan Davis" className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
              <label className="flex flex-col gap-2 text-xs font-semibold">Email address<input required name="email" type="email" placeholder="you@company.com" className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
              <label className="flex flex-col gap-2 text-xs font-semibold">Password<div className="relative"><input required name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm font-normal outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
              {mode === 'login' && <div className="-mt-2 flex justify-end"><button type="button" className="text-xs font-semibold text-primary hover:underline">Forgot password?</button></div>}
              {mode === 'signup' && <fieldset className="flex flex-col gap-2"><legend className="text-xs font-semibold">Your role</legend><div className="flex gap-2"><RoleOption selected={role === 'Financial Advisor'} title="Financial Advisor" description="Manage client materials" onClick={() => setRole('Financial Advisor')} /><RoleOption selected={role === 'Compliance Officer'} title="Compliance Officer" description="Review and approve" onClick={() => setRole('Compliance Officer')} /></div></fieldset>}
              <button disabled={loading} type="submit" className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-80">{loading ? <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <>{mode === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight className="size-4" /></>}</button>
            </form>
            <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="size-3.5" />Your data is encrypted and protected</div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Need help? <button className="font-semibold text-primary hover:underline">Contact support</button></p>
        </div>
      </section>
      {toast && <div role="status" className="fixed bottom-5 right-5 flex items-center gap-3 rounded-xl border border-primary/15 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-xl"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><UserRound className="size-3.5" /></span>{toast}</div>}
    </main>
  )
}

declare global { interface Window { setTimeout: typeof setTimeout } }
