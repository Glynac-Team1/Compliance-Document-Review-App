import re

with open("frontend/app/compliance-officer/page.tsx", "r") as f:
    content = f.read()

content = content.replace("import { useState } from 'react'", "import { useState, useEffect } from 'react'")

new_nav = """function Nav({
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
}"""

content = re.sub(r'function Nav\(\{.*?</nav>\n  \)\n\}', new_nav, content, flags=re.DOTALL)

with open("frontend/app/compliance-officer/page.tsx", "w") as f:
    f.write(content)
