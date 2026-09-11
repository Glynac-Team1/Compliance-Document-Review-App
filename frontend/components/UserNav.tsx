'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api'

interface UserProfile {
  name: string
  email: string
  role: string
  slug?: string
}

interface UserNavProps {
  variant?: 'header' | 'sidebar'
  collapsed?: boolean
  onLogout?: () => void
}

export default function UserNav({ variant = 'header', collapsed = false, onLogout }: UserNavProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/')
        return
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) {
          const data = await res.json()
          setUser(data)
          if (data.slug) {
            localStorage.setItem('user_slug', data.slug)
          }
          if (data.role) {
            localStorage.setItem('user_role', data.role)
          }
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_role')
          localStorage.removeItem('user_slug')
          router.push('/')
        }
      } catch (err) {
        console.error('Failed to load user profile', err)
      }
    }

    fetchUserProfile()
  }, [router])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_slug')
    if (onLogout) {
      onLogout()
    }
    router.push('/')
  }

  const displayName = user?.name || 'User'
  const displayEmail = user?.email || 'Authenticated'
  const displayRole = user?.role === 'officer' ? 'Compliance Officer' : 'Financial Advisor'
  const workspaceSlug = user?.slug || ''
  const workspacePath = workspaceSlug ? `/${user?.role === 'officer' ? 'compliance-officer' : 'advisor'}/${workspaceSlug}` : ''
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U'

  if (variant === 'sidebar') {
    if (collapsed) {
      return (
        <div ref={menuRef} className="relative flex justify-center w-full">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label="User account menu"
            title={`${displayName} (${displayRole})`}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm transition hover:ring-2 hover:ring-primary/20"
          >
            {initials}
          </button>

          {isOpen && (
            <div className="absolute bottom-0 left-full ml-3 w-64 rounded-xl border border-border bg-card p-2 shadow-xl ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-left-2">
              <div className="border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Session
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                {workspacePath && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">{workspacePath}</p>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <ShieldCheck className="size-3.5" />
                  <span>{displayRole}</span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
                >
                  <LogOut className="size-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div ref={menuRef} className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="User account menu"
          className="flex w-full items-center justify-between rounded-lg p-2 transition hover:bg-muted/70 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{displayRole}</p>
            </div>
          </div>
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="border-b border-border p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              {workspacePath && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">{workspacePath}</p>
              )}
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <ShieldCheck className="size-3.5" />
                <span>{displayRole}</span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
              >
                <LogOut className="size-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="User account menu"
        className="flex items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-muted/70"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
          {initials}
        </span>
        <span className="hidden text-sm sm:block">
          <span className="block font-semibold text-foreground">{displayName}</span>
          <span className="block text-xs text-muted-foreground">{displayRole}</span>
        </span>
        <ChevronDown className={`hidden size-4 text-muted-foreground sm:block transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Session
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            {workspacePath && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">{workspacePath}</p>
            )}
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              <span>{displayRole}</span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
            >
              <LogOut className="size-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
