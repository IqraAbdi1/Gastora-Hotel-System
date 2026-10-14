import { useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { formatUGX } from '../procurement/requestsModel'
import type { StockItem } from '../procurement/requestsModel'

export interface ReorderRow {
  item: StockItem
  /** Already being bought or still to arrive. */
  onOrder: number
  /** Suggested quantity: par, less what is on hand and on order. */
  qty: number
}

// One click to bring low items up to par. The storekeeper can untick an item or change a quantity first.
export default function ReorderDialog({
  rows,
  onClose,
  onDone,
}: {
  rows: ReorderRow[]
  onClose: () => void
  onDone: (id: string) => void
}) {
  const { topUp } = useRequests()
  const { features } = useFeatures()
  const [qty, setQty] = useState<Record<string, string>>({})
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const valueOf = (r: ReorderRow) => qty[r.item.id] ?? String(r.qty)
  const lines = rows
    .filter((r) => !off[r.item.id])
    .map((r) => ({ itemId: r.item.id, qty: Math.max(0, parseInt(valueOf(r), 10) || 0) }))
    .filter((l) => l.qty > 0)
  const total = lines.reduce((s, l) => s + l.qty * (rows.find((r) => r.item.id === l.itemId)?.item.unitCost ?? 0), 0)
  const chain = features.supplyChain

  function submit() {
    const res = topUp(lines)
    if (!res.ok) return setError(res.error)
    onDone(res.value)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top up to par</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-ink/60">
            ×
          </button>
        </div>
        <p className="mb-3 text-sm text-ink/60">
          {chain
            ? 'These items are at or below their reorder level. This raises one requisition against the Store budget. The general manager approves it, then procurement buys.'
            : 'These items are at or below their reorder level. This sends one request to management.'}{' '}
          Quantities are par, less what is on hand and already on order. Untick or change any of them.
        </p>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.item.id} className="flex items-center gap-3 rounded-lg border border-ink/10 p-2">
              <input
                type="checkbox"
                checked={!off[r.item.id]}
                onChange={(e) => setOff((o) => ({ ...o, [r.item.id]: !e.target.checked }))}
                aria-label={`Include ${r.item.name}`}
                className="h-4 w-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.item.name}</p>
                <p className="text-xs text-ink/50">
                  On hand {r.item.onHand} · reorder at {r.item.reorderAt} · par {r.item.par ?? 0}
                  {r.onOrder > 0 && ` · ${r.onOrder} already on order`}
                </p>
              </div>
              <input
                value={valueOf(r)}
                onChange={(e) => setQty((m) => ({ ...m, [r.item.id]: e.target.value }))}
                inputMode="numeric"
                aria-label={`Quantity of ${r.item.name}`}
                className="w-20 shrink-0 rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-right text-sm"
              />
              <span className="w-8 shrink-0 text-xs text-ink/50">{r.item.unit}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm text-ink/70">
          {lines.length} item{lines.length === 1 ? '' : 's'} · about {formatUGX(total)} at usual cost
        </p>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={lines.length === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {chain ? 'Raise requisition' : 'Send request to management'}
          </button>
        </div>
      </div>
    </div>
  )
}