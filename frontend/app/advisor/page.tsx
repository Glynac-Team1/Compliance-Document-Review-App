'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getApiBaseUrl } from '@/lib/api'
import AdvisorWorkspace from './AdvisorWorkspace'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.replace('/')
      return
    }

    const savedSlug = localStorage.getItem('user_slug')
    if (savedSlug) {
      router.replace(`/advisor/${savedSlug}`)
      return
    }

    fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.slug) {
          localStorage.setItem('user_slug', data.slug)
          router.replace(`/advisor/${data.slug}`)
        }
      })
      .catch(() => {})
  }, [router])

  return <AdvisorWorkspace />
}
