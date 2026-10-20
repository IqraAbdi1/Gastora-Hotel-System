import { useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { formatUGX, movementApproval } from '../procurement/requestsModel'
import type { Movement } from '../procurement/requestsModel'
import DocumentDialog from '../receipts/DocumentDialog'
import { receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'
import { useSearchParams } from 'react-router-dom'
type View = 'all' | Movement['kind']
const VIEWS: View[] = ['all', 'Received', 'Issued', 'Adjusted']
const PAGE = 20

const KIND_CHIP: Record<Movement['kind'], string> = {
  Received: 'bg-good/15 text-good',
  Issued: 'bg-warn/15 text-warn',
  Adjusted: 'bg-brand/10 text-brand',
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MovementsPage() {
  const { tenant, features } = useFeatures()
  const { movements, receipts, stores, losses } = useRequests()
  const showStores = features.stores && stores.length > 1
  const [view, setView] = useState<View>('all')
  const [store, setStore] = useState('all')
    const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('item') ?? '')
  const [shown, setShown] = useState(PAGE)
  const [doc, setDoc] = useState<DocView | null>(null)

  const list = movements
    .filter((m) => view === 'all' || m.kind === view)
    .filter((m) => !showStores || store === 'all' || m.store === store)
    .filter((m) => {
      const q = query.trim().toLowerCase()
      return (
        !q ||
        `${m.item} ${m.requestId ?? ''} ${m.receiptId ?? ''} ${m.by} ${m.reason ?? ''} ${m.from ?? ''} ${m.to ?? ''}`
          .toLowerCase()
          .includes(q)
      )
    })
    .sort((a, b) => b.at.localeCompare(a.at))

  const worth = (kind: Movement['kind']) =>
    list.filter((m) => m.kind === kind).reduce((s, m) => s + Math.abs(m.qty) * (m.cost ?? 0), 0)
  const adjustments = list.filter((m) => m.kind === 'Adjusted').length

  function open(receiptId?: string) {
    const r = receipts.find((x) => x.id === receiptId)
    if (r) setDoc(receiptDoc(r, tenant.name))
  }

  // Group the visible rows by day, newest first.
  const visible = list.slice(0, shown)
  const days: { label: string; rows: Movement[] }[] = []
  for (const m of visible) {
    const label = dayLabel(m.at)
    const last = days[days.length - 1]
    if (last && last.label === label) last.rows.push(m)
    else days.push({ label, rows: [m] })
  }

  const tile = 'rounded-xl border border-ink/10 bg-surface px-4 py-3'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">Stock movements</h1>
        <p className="text-sm text-ink/60">Everything that entered, left or was corrected in the store. Tap a line with a receipt to open it.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`${tile} border-good/25 bg-surface`}>
          <p className="text-xl font-bold text-good">{formatUGX(worth('Received'))}</p>
          <p className="text-xs text-ink/60">Came in</p>
        </div>
        <div className={`${tile} border-warn/30 bg-surface`}>
          <p className="text-xl font-bold text-warn">{formatUGX(worth('Issued'))}</p>
          <p className="text-xs text-ink/60">Went out</p>
        </div>
        <div className={`${tile} border-brand/20 bg-surface`}>
          <p className="text-xl font-bold text-brand">{adjustments}</p>
          <p className="text-xs text-ink/60">Corrections</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setView(v)
              setShown(PAGE)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              view === v ? 'bg-brand text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
            }`}
          >
            {v === 'all' ? 'All' : v}
          </button>
        ))}
      </div>

      <FilterBar
        query={query}
        onQuery={(v) => {
          setQuery(v)
          setShown(PAGE)
        }}
        placeholder="Search item, request ID, receipt, person or place"
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
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">No movements match.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/5 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2">From → to</th>
                <th className="px-4 py-2">By</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            {days.map((d) => (
              <tbody key={d.label} className="divide-y divide-ink/10">
                <tr>
                  <td colSpan={7} className="bg-surface px-4 py-1.5 text-xs font-semibold text-ink/60">
                    {d.label}
                  </td>
                </tr>
                {d.rows.map((m) => {
                  const out = m.kind === 'Issued' || (m.kind === 'Adjusted' && m.qty < 0)
                  const approval = movementApproval(m, losses)
                  return (
                    <tr
                      key={m.id}
                      onClick={() => open(m.receiptId)}
                      className={m.receiptId ? 'cursor-pointer hover:bg-good/5' : ''}
                    >
                      <td className="whitespace-nowrap px-4 py-2 text-ink/50">{clock(m.at)}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_CHIP[m.kind]}`}>{m.kind}</span>
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{m.item}</p>
                        {m.cost && m.cost > 0 ? <p className="text-xs text-ink/50">{formatUGX(m.cost)} each</p> : null}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${out ? 'text-warn' : 'text-good'}`}>
                        {out ? '−' : '+'}
                        {Math.abs(m.qty)}
                      </td>
                      <td className="px-4 py-2 text-ink/60">{m.from && m.to ? `${m.from} → ${m.to}` : ''}</td>
                      <td className="px-4 py-2 text-ink/60">
                        {m.by}
                        {m.requestId && <p className="text-xs text-ink/50">{m.requestId}</p>}
                      </td>
                      <td className="px-4 py-2 text-xs text-ink/60">
                        {m.reason}
                        {approval && <p>Approval: {approval}</p>}
                        {m.receiptId && (
                          <span className="mt-0.5 inline-block rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                            {m.receiptId}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="w-full rounded-lg border border-ink/15 py-2 text-sm font-medium text-ink/70"
        >
          Show more ({list.length - shown})
        </button>
      )}

      {doc && <DocumentDialog doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}