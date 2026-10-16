import { useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { formatUGX, receiptTitle, receiptTotal } from '../procurement/requestsModel'
import type { Receipt, ReceiptKind } from '../procurement/requestsModel'
import DocumentDialog from '../receipts/DocumentDialog'
import { receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'

type Filter = 'all' | ReceiptKind
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'GRN', label: 'Goods received' },
  { id: 'DIRECT', label: 'Direct purchases' },
  { id: 'ISSUE', label: 'Issue notes' },
  { id: 'RETURN', label: 'Returns' },
]
const CHIP: Record<ReceiptKind, string> = {
  GRN: 'bg-brand/10 text-brand',
  DIRECT: 'bg-good/15 text-good',
  ISSUE: 'bg-warn/15 text-warn',
  RETURN: 'bg-ink/10 text-ink/70',
}
const ACCENT: Record<ReceiptKind, string> = {
  GRN: 'border-l-brand',
  DIRECT: 'border-l-good',
  ISSUE: 'border-l-warn',
  RETURN: 'border-l-ink/40',
}
const PAGE = 10

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** The stores a note touched, written once each. */
const storesOf = (r: Receipt) => [...new Set(r.lines.map((l) => l.store).filter((s): s is string => !!s))]

export default function ReceiptsPage() {
  const { tenant, features } = useFeatures()
  const { receipts, stores } = useRequests()
  const showStores = features.stores && stores.length > 1
  const [filter, setFilter] = useState<Filter>('all')
  const [store, setStore] = useState('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [doc, setDoc] = useState<DocView | null>(null)

  const list = receipts
    .filter((r) => filter === 'all' || r.kind === filter)
    .filter((r) => !showStores || store === 'all' || storesOf(r).includes(store))
    .filter((r) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      const hay = `${r.id} ${r.requestId ?? ''} ${r.poId ?? ''} ${r.supplier ?? ''} ${r.department ?? ''} ${r.reference ?? ''} ${r.raisedBy ?? ''} ${r.handedInBy ?? ''} ${r.returnId ?? ''} ${storesOf(r).join(' ')} ${r.lines
        .map((l) => l.name)
        .join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => b.at.localeCompare(a.at))

  const inValue = list.filter((r) => r.kind !== 'ISSUE').reduce((s, r) => s + receiptTotal(r), 0)
  const outValue = list.filter((r) => r.kind === 'ISSUE').reduce((s, r) => s + receiptTotal(r), 0)
  const tile = 'rounded-xl border p-3'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-sm text-ink/60">Every note the store has made. Tap one to view and print.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`${tile} border-brand/20 bg-linear-to-br from-brand/10 to-good/10`}>
          <p className="text-xl font-bold text-brand">{list.length}</p>
          <p className="text-xs text-ink/60">Notes shown</p>
        </div>
        <div className={`${tile} border-good/25 bg-linear-to-br from-good/15 to-brand/10`}>
          <p className="text-xl font-bold text-good">{formatUGX(inValue)}</p>
          <p className="text-xs text-ink/60">Stock in (bought, delivered, returned)</p>
        </div>
        <div className={`${tile} border-warn/30 bg-linear-to-br from-warn/20 to-warn/5`}>
          <p className="text-xl font-bold text-warn">{formatUGX(outValue)}</p>
          <p className="text-xs text-ink/60">Stock out (issued)</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id)
              setShown(PAGE)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f.id ? 'bg-brand text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <FilterBar
        query={query}
        onQuery={(v) => {
          setQuery(v)
          setShown(PAGE)
        }}
        placeholder="Search number, request ID, supplier, person, item"
        active={store !== 'all' ? 1 : 0}
      >
        {showStores && (
          <select
            value={store}
            onChange={(e) => {
              setStore(e.target.value)
              setShown(PAGE)
            }}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </FilterBar>

      {list.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">No receipts match.</p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, shown).map((r) => {
            const total = receiptTotal(r)
            const where = features.stores ? storesOf(r).join(', ') : ''
            const above = r.lines.some((l) => l.above)
            const counted = r.lines.some((l) => l.declared !== undefined)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDoc(receiptDoc(r, tenant.name))}
                className={`flex w-full flex-wrap items-center gap-3 rounded-xl border border-l-4 border-ink/10 bg-surface p-4 text-left text-sm hover:bg-ink/5 ${ACCENT[r.kind]}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {r.id} <span className="font-normal text-ink/50">{time(r.at)}</span>
                  </span>
                  <span className="block text-ink/60">
                    {r.supplier ?? r.department ?? ''}
                    {r.requestId && ` · ${r.requestId}`}
                    {r.poId && ` · ${r.poId}`}
                    {r.raisedBy && ` · raised by ${r.raisedBy}`}
                    {r.handedInBy && ` · handed in by ${r.handedInBy}`}
                    {where && ` · ${where}`}
                  </span>
                  <span className="block truncate">{r.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span>
                </span>
                {total > 0 && <span className="text-ink/60">{formatUGX(total)}</span>}
                {above && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Above issued</span>}
                {counted && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Counted differently</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[r.kind]}`}>{receiptTitle[r.kind]}</span>
              </button>
            )
          })}
          {list.length > shown && (
            <button
              type="button"
              onClick={() => setShown(shown + PAGE)}
              className="w-full rounded-lg border border-ink/15 py-2 text-sm font-medium text-ink/70"
            >
              Show more ({list.length - shown})
            </button>
          )}
        </div>
      )}

      {doc && <DocumentDialog doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}