import { useState } from 'react'
import { useRequests } from '../procurement/requestsContext'
import type { Receipt, ReturnRequest } from '../procurement/requestsModel'

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function ReturnCard({ r, onDone }: { r: ReturnRequest; onDone: (receipt: Receipt) => void }) {
  const q = useRequests()
  const [counts, setCounts] = useState<string[]>(() => r.lines.map((l) => String(l.qty)))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const got = counts.map((c) => Math.max(0, parseInt(c, 10) || 0))
  const differs = got.some((g, n) => g !== r.lines[n].qty)

  function confirm() {
    const res = q.confirmReturn(r.id, got, note)
    if (res.ok === false) return setError(res.error)
    onDone(res.value)
  }

  function decline() {
    setError(q.declineReturn(r.id, note))
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-semibold">
          {r.id} · {r.department} <span className="font-normal text-ink/50">{time(r.at)}</span>
        </span>
        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Pending</span>
      </div>
      <p className="mt-1 text-xs text-ink/60">
        Raised by {r.by}
        {r.handedInBy && ` · handed in by ${r.handedInBy}`}
      </p>
      <p className="mt-1 text-ink/80">{r.note}</p>

      <div className="mt-3 space-y-2 rounded-lg bg-ink/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Count what actually arrived</p>
        {r.lines.map((l, n) => {
          const above = Math.max(0, got[n] - q.returnable(r.department, l.name))
          return (
            <label key={n} className="flex items-center justify-between gap-2">
              <span>
                {l.name} <span className="text-ink/50">(declared {l.qty})</span>
                {above > 0 && <span className="ml-1 text-xs font-semibold text-warn">+{above} above issued</span>}
              </span>
              <input
                value={counts[n]}
                onChange={(e) => setCounts((cs) => cs.map((c, k) => (k === n ? e.target.value : c)))}
                inputMode="numeric"
                aria-label={`Quantity of ${l.name} that arrived`}
                className="w-20 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
              />
            </label>
          )
        })}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={differs ? 'The count is different. What happened? (required)' : 'Note (optional), or the reason if you decline'}
        className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-bad">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
          {differs ? 'Confirm with this count' : 'Confirm and put in store'}
        </button>
        <button type="button" onClick={decline} className="rounded-lg border border-bad px-3 py-1.5 text-sm font-semibold text-bad">
          Decline
        </button>
      </div>
    </div>
  )
}

export default function PendingReturnsDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (receipt: Receipt) => void
}) {
  const { returns } = useRequests()
  const pending = returns.filter((r) => r.status === 'Pending')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-canvas">
        <div className="flex items-center justify-between bg-brand px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">Returns waiting for you</h2>
            <p className="mt-0.5 text-xs text-white/85">Count what arrived. Stock goes up only when you confirm.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-white/80 hover:text-white">
            ×
          </button>
        </div>
        <div className="space-y-3 p-4">
          {pending.length === 0 ? (
            <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">
              Nothing is waiting.
            </p>
          ) : (
            pending.map((r) => <ReturnCard key={r.id} r={r} onDone={onDone} />)
          )}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}