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
