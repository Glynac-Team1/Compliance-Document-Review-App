'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getApiBaseUrl } from '@/lib/api'

export interface AppNotification {
  id: string
  document_id?: string | null
  message: string
  is_read: boolean
  created_at: string
}

interface UseLiveSyncOptions {
  onSync?: (event: string, documentId?: string) => void
}

export function useLiveSync({ onSync }: UseLiveSyncOptions = {}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const onSyncRef = useRef(onSync)

  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const res = await fetch(`${getApiBaseUrl()}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      await fetch(`${getApiBaseUrl()}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('Failed to mark notification read', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)

      await fetch(`${getApiBaseUrl()}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('Failed to mark all notifications read', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time Server-Sent Events (SSE) connection
  useEffect(() => {
    let eventSource: EventSource | null = null
    let isCancelled = false

    const connect = () => {
      const token = localStorage.getItem('auth_token')
      if (!token || isCancelled) return

      const sseUrl = `${getApiBaseUrl()}/notifications/stream?token=${encodeURIComponent(token)}`
      eventSource = new EventSource(sseUrl)

      eventSource.onopen = () => {
        setIsConnected(true)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            setIsConnected(true)
          } else if (data.type === 'notification') {
            fetchNotifications()
            if (onSyncRef.current) {
              onSyncRef.current('notification', data.document_id)
            }
          } else if (data.type === 'sync') {
            fetchNotifications()
            if (onSyncRef.current) {
              onSyncRef.current(data.event, data.document_id)
            }
          }
        } catch (err) {
          // Keepalive or empty message
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
        // Attempt reconnection after 5 seconds
        if (!isCancelled) {
          setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      isCancelled = true
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    refetchNotifications: fetchNotifications,
  }
}
