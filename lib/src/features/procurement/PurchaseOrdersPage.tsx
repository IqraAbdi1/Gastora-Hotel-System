import { useState } from 'react'
import DocumentDialog from '../receipts/DocumentDialog'
import { poDoc, receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from './requestsContext'
import { formatUGX, sameName } from './requestsModel'
import type { PurchaseOrder, Receipt } from './requestsModel'

type View = 'all' | PurchaseOrder['status']
const VIEWS: View[] = ['all', 'Ordered', 'Part received', 'Received']
const PAGE = 10

const CHIP: Record<PurchaseOrder['status'], string> = {
  Ordered: 'bg-brand/10 text-brand',
  'Part received': 'bg-warn/15 text-warn',
  Received: 'bg-good/15 text-good',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function PurchaseOrdersPage() {
  const { orders, receipts, requests, stock } = useRequests()
  const { tenant } = useFeatures()
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [doc, setDoc] = useState<DocView | null>(null)

  const unitOf = (name: string) => stock.find((s) => sameName(s.name, name))?.unit ?? 'piece'

  const list = orders
    .filter((o) => view === 'all' || o.status === view)
    .filter((o) => {
      const q = query.trim().toLowerCase()
      return !q || `${o.id} ${o.requestId} ${o.supplier}`.toLowerCase().includes(q)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const link = 'rounded-lg border border-brand/40 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Purchase orders</h1>
        <p className="text-sm text-ink/60">
          Raised by procurement from approved requisitions. Each one shows its request ID. A short delivery keeps the
          balance open on the same order. Tap View to open or print.
        </p>
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
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Search PO, request ID or supplier"
          className="min-w-48 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
        />
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">No purchase orders match.</p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, shown).map((o) => {
            const grns = (o.grnIds ?? (o.grnId ? [o.grnId] : []))
              .map((id) => receipts.find((r) => r.id === id))
              .filter((r): r is Receipt => !!r)
            const department = requests.find((r) => r.id === o.requestId)?.department
            return (
              <div key={o.id} className="rounded-xl border border-ink/10 bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {o.id} <span className="font-normal text-ink/50">for {o.requestId}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[o.status]}`}>{o.status}</span>
                </div>
                <p className="text-ink/60">
                  {o.supplier} · {o.by} · {time(o.createdAt)}
                  {o.total > 0 && ` · ${formatUGX(o.total)}`}
                </p>
                <p className="mt-1">
                  {o.items
                    .map((i, n) => (o.got ? `${o.got[n] ?? 0} of ${i.qty} × ${i.name}` : `${i.qty} × ${i.name}`))
                    .join(', ')}
                </p>
                {o.status === 'Part received' && (
                  <p className="mt-1 text-xs text-warn">Part of this order has arrived. The balance is still on order.</p>
                )}
                {o.closedShort && (
                  <p className="mt-1 text-xs text-ink/60">
                    Closed short by {o.closedShort.by}, {time(o.closedShort.at)}: {o.closedShort.reason}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDoc(poDoc(o, tenant.name, unitOf, department))}
                    className={link}
                  >
                    View {o.id}
                  </button>
                  {grns.map((grn) => (
                    <button key={grn.id} type="button" onClick={() => setDoc(receiptDoc(grn, tenant.name))} className={link}>
                      View {grn.id}
                    </button>
                  ))}
                </div>
              </div>
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