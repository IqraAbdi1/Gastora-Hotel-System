import { useState } from 'react'

export interface MoreItem {
  label: string
  onClick: () => void
}

// A small "More" menu so a page keeps one primary button and tucks the rest away.
export default function MoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg border border-ink/20 bg-surface px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
      >
        More ▾
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div role="menu" className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-ink/10 bg-surface p-1 shadow-lg">
            {items.map((i) => (
              <button
                key={i.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  i.onClick()
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                {i.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}