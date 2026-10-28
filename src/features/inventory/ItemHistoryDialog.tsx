import { useState } from 'react'
import { useRequests } from '../procurement/requestsContext'
import { formatUGX, lossValue, movementApproval, sameName } from '../procurement/requestsModel'
import type { StockItem } from '../procurement/requestsModel'
import { EvidenceThumb } from './Evidence'
import { useFeatures } from '../platform/featuresContext'
const PAGE = 10
const TONE = { Issued: 'text-warn', Received: 'text-good', Adjusted: 'text-brand' }

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Everything that has happened to one item: movements, changes to its details, and write-offs.
export default function ItemHistoryDialog({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { movements, itemLog, losses, storeName } = useRequests()
  const { features } = useFeatures()
  const [shown, setShown] = useState(PAGE)

  const moves = movements.filter((m) => sameName(m.item, item.name)).sort((a, b) => b.at.localeCompare(a.at))
  const changes = itemLog.filter((c) => c.itemId === item.id).sort((a, b) => b.at.localeCompare(a.at))
  const writeOffs = losses.filter((l) => l.itemId === item.id).sort((a, b) => b.at.localeCompare(a.at))

  const heading = 'mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
      <div className="my-6 w-full max-w-xl space-y-4 rounded-xl bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{item.name}</h2>
            <p className="text-sm text-ink/60">
                            {item.onHand} {item.unit} on hand{features.stores ? ` in ${storeName(item.store)}` : ''} · reorder at {item.reorderAt} · par {item.par ?? 0} · usual cost{' '}
              {formatUGX(item.unitCost)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink/70"
          >
            Close
          </button>
        </div>

        <div>
          <p className={heading}>Movements ({moves.length})</p>
          {moves.length === 0 ? (
            <p className="text-sm text-ink/60">No movements yet.</p>
          ) : (
            <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 text-sm">
              {moves.slice(0, shown).map((m) => {
                const approval = movementApproval(m, losses)
                return (
                  <li key={m.id} className="px-3 py-2">
                    <p>
                      <span className={`font-semibold ${TONE[m.kind]}`}>{m.kind}</span>{' '}
                      <span className="font-medium">
                        {m.kind === 'Issued' || m.qty < 0 ? '−' : '+'}
                        {Math.abs(m.qty)} {item.unit}
                      </span>
                      <span className="text-ink/50"> · {time(m.at)}</span>
                    </p>
                    <p className="text-xs text-ink/60">
                      {m.reason}
                      {m.from && m.to ? ` · ${m.from} → ${m.to}` : ''}
                      {approval ? ` · Approval: ${approval}` : ''} · {m.by}
                      {m.receiptId ? ` · ${m.receiptId}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          {moves.length > shown && (
            <button
              type="button"
              onClick={() => setShown(shown + PAGE)}
              className="mt-2 w-full rounded-lg border border-ink/15 py-1.5 text-sm font-medium text-ink/70"
            >
              Show more ({moves.length - shown})
            </button>
          )}
        </div>

        <div>
          <p className={heading}>Changes to this item ({changes.length})</p>
          {changes.length === 0 ? (
            <p className="text-sm text-ink/60">No changes recorded.</p>
          ) : (
            <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 text-sm">
              {changes.map((c) => (
                <li key={c.id} className="px-3 py-2">
                  <span className="font-medium">{c.field}</span>{' '}
                  {c.from ? (
                    <>
                      {c.from} → {c.to}
                    </>
                  ) : (
                    c.to
                  )}
                  <span className="block text-xs text-ink/60">
                    {c.by} · {time(c.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className={heading}>Damaged and lost ({writeOffs.length})</p>
          {writeOffs.length === 0 ? (
            <p className="text-sm text-ink/60">No write-offs.</p>
          ) : (
            <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 text-sm">
              {writeOffs.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-3 py-2">
                  {l.evidence && <EvidenceThumb src={l.evidence} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {l.id} · {l.qty} {l.unit} · {l.reason} · {formatUGX(lossValue(l))}
                    </p>
                    <p className="text-xs text-ink/60">
                      {l.status === 'Posted' ? 'Written off' : l.status}
                      {l.reversal ? ` by ${l.reversal.by}: ${l.reversal.note}` : ''}
                      {l.review ? ` · ${l.review.verdict} by ${l.review.by}` : ''} · {l.by} · {time(l.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}