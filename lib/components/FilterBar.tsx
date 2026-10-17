import { useState } from 'react'
import type { ReactNode } from 'react'

// One search box plus a "Filters" button that tucks the dropdowns away.
// Every list page uses it, so the toolbar looks and behaves the same everywhere.
export default function FilterBar({
  query,
  onQuery,
  placeholder,
  active = 0,
  children,
}: {
  query: string
  onQuery: (value: string) => void
  placeholder: string
  /** How many dropdown filters are set, shown on the button. */
  active?: number
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const has = !!children

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
        />
        {has && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold ${
              active > 0 ? 'border-brand bg-brand/10 text-brand' : 'border-ink/15 bg-white text-ink/70 hover:bg-ink/5'
            }`}
          >
            Filters{active > 0 ? ` (${active})` : ''} ▾
          </button>
        )}
      </div>
      {has && open && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-ink/10 bg-surface p-3">{children}</div>
      )}
    </div>
  )
}