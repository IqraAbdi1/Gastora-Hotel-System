import { useState } from 'react'
import type { DraftAction } from '../types'

type Props = { draft: DraftAction; onClose: () => void }

export default function DraftPanel({ draft, onClose }: Props) {
  const [body, setBody] = useState(draft.body)
  const [sent, setSent] = useState(false)

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Assistant draft (sample)</p>
          <h2 className="text-lg font-semibold">{draft.title}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-sm text-ink/60">To: {draft.recipient}</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-ink/15 bg-canvas p-3 text-sm outline-none focus:border-brand"
        />
        <p className="text-xs text-ink/60">Review and edit before sending. Nothing is sent until you press the button.</p>
      </div>
      <div className="border-t border-ink/10 p-4">
        {sent ? (
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            Sent (simulated). In the real system this goes out by SMS or WhatsApp and is recorded on the booking.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setSent(true)}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Send (simulated)
          </button>
        )}
      </div>
    </div>
  )
}