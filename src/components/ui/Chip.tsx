import type { ReactNode } from 'react'

// A filter chip with an optional count and colour dot. One look for every quick filter in the app.
export default function Chip({
  active,
  onClick,
  count,
  dot,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  /** A Tailwind background class for a small status dot, such as "bg-good". */
  dot?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        active
          ? 'border-brand bg-brand text-white shadow-sm'
          : 'border-ink/10 bg-surface text-ink/70 hover:border-brand/40 hover:bg-brand/5 hover:text-ink'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot} ${active ? 'ring-2 ring-white/40' : ''}`} aria-hidden="true" />}
      {children}
      {count !== undefined && <span className={`text-xs ${active ? 'text-white/80' : 'text-ink/50'}`}>{count}</span>}
    </button>
  )
}
