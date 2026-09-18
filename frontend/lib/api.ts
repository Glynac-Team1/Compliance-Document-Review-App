export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || 'localhost'
    return `http://${host}:8000`
  }
  return 'http://localhost:8000'
}

export function formatApiError(detail: unknown, fallback: string = 'An error occurred'): string {
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const loc = Array.isArray((item as any).loc)
            ? (item as any).loc.filter((p: any) => p !== 'body').join('.')
            : ''
          const msg = (item as any).msg || (item as any).message || JSON.stringify(item)
          return loc ? `${loc}: ${msg}` : msg
        }
        return String(item)
      })
      .filter(Boolean)
    return messages.length > 0 ? messages.join('; ') : fallback
  }
  if (typeof detail === 'object') {
    return (detail as any).detail || (detail as any).message || (detail as any).msg || JSON.stringify(detail)
  }
  return String(detail)
}
