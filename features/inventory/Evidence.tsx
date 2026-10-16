import { useState } from 'react'

// A small photo that opens full size when tapped.
export function EvidenceThumb({ src, label = 'Evidence' }: { src: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View photo"
        className="inline-block overflow-hidden rounded-lg border border-ink/15"
      >
        <img src={src} alt={label} className="h-12 w-12 object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt={label} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  )
}