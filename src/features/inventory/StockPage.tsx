import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import MoreMenu from '../../components/MoreMenu'
import type { MoreItem } from '../../components/MoreMenu'
import { useFeatures } from '../platform/featuresContext'
import { expiryState } from '../procurement/batches'
import { useRequests } from '../procurement/requestsContext'
import { MAIN_STORE_ID, STOCK_CATEGORIES, formatUGX } from '../procurement/requestsModel'
import type { StockItem } from '../procurement/requestsModel'
import DocumentDialog from '../receipts/DocumentDialog'
import { receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'
import ItemDialog from './ItemDialog'
import ItemHistoryDialog from './ItemHistoryDialog'
import ItemPanel from './ItemPanel'
import PendingReturnsDialog from './PendingReturnsDialog'
import ReorderDialog from './ReorderDialog'
import ReportLossDialog from './ReportLossDialog'
import StockEntryDialog from './StockEntryDialog'
import type { EntryMode } from './StockEntryDialog'
import StoresDialog from './StoresDialog'
import FilterBar from '../../components/FilterBar'
const PAGE = 15

const chip = 'rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25'

export default function StockPage() {
  const { can } = useAuth()
  const { tenant, features } = useFeatures()
  const { stock, stores, storeName, losses, onOrderOf, returns, batches, expiryWarn } = useRequests()
  const manage = can('manageStock')
  const buy = can('purchase') || manage
  const admin = can('changeSettings')
  const showStores = features.stores
  const showLosses = features.lossReports
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [store, setStore] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [expiryOnly, setExpiryOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<StockItem | null>(null)
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null)
  const [entry, setEntry] = useState<EntryMode | null>(null)
  const [reporting, setReporting] = useState<StockItem | null>(null)
  const [history, setHistory] = useState<StockItem | null>(null)
  const [managing, setManaging] = useState(false)
  const [topping, setTopping] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [notice, setNotice] = useState('')
  const [doc, setDoc] = useState<DocView | null>(null)

  const isLow = (s: StockItem) => s.onHand <= s.reorderAt
  const inStore = (s: StockItem) => !showStores || store === 'all' || (s.store ?? MAIN_STORE_ID) === store
  const waitingQty = (id: string) =>
    losses.filter((l) => l.itemId === id && l.status === 'Waiting approval').reduce((sum, l) => sum + l.qty, 0)
  const waitingReports = losses.filter((l) => l.status === 'Waiting approval').length
  const waitingReturns = returns.filter((r) => r.status === 'Pending').length

  // Items with a batch that is expired or close to its date. Only when the hotel has expiry dates on.
  const live = features.batchExpiry ? batches.filter((b) => b.qty > 0) : []
  const expiringIds = new Set(live.filter((b) => expiryState(b.expiry, expiryWarn) !== 'ok').map((b) => b.itemId))
  const expiredIds = new Set(live.filter((b) => expiryState(b.expiry, expiryWarn) === 'expired').map((b) => b.itemId))

  // The tiles and the reorder alert follow the store filter, so each store shows its own numbers.
  const scoped = stock.filter(inStore)
  const expiryItems = scoped.filter((s) => expiringIds.has(s.id))
  const list = scoped
    .filter((s) => !lowOnly || isLow(s))
    .filter((s) => !expiryOnly || expiringIds.has(s.id))
    .filter((s) => category === 'all' || (s.category ?? 'Other') === category)
    .filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const value = scoped.reduce((sum, s) => sum + s.onHand * s.unitCost, 0)
  const low = scoped.filter(isLow).length

  // Reorder: items at or below their level. Rule: the top-up is par, less what is on hand and already on order.
  const reorder = scoped.filter(isLow).map((s) => {
    const onOrder = onOrderOf(s.name)
    return { item: s, onOrder, qty: Math.max(0, (s.par ?? 0) - s.onHand - onOrder) }
  })
  const topUpRows = reorder.filter((r) => r.qty > 0)

  const showReturns = features.deptReturns && manage && waitingReturns > 0
  const showReports = showLosses && manage && waitingReports > 0
  const attention = reorder.length > 0 || showReturns || showReports || expiryItems.length > 0

  const more: MoreItem[] = []
  if (manage) {
    more.push({ label: 'Issue stock', onClick: () => setEntry('issue') })
    more.push({ label: 'Return to store', onClick: () => setEntry('return') })
    more.push({ label: 'Add item', onClick: () => setEditing('new') })
  }
  if (showStores && admin) more.push({ label: 'Manage stores', onClick: () => setManaging(true) })

  const tile = 'rounded-xl border border-ink/10 bg-surface px-4 py-3 text-left'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">Stock</h1>
          <p className="text-sm text-ink/60">What is in the store. Tap an item for its details.</p>
        </div>
        <div className="flex items-center gap-2">
          {buy && (
            <button type="button" onClick={() => setEntry('purchase')} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Record purchase
            </button>
          )}
          <MoreMenu items={more} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`${tile} border-brand/20 bg-surface`}>
          <p className="text-xl font-bold text-brand">{scoped.length}</p>
          <p className="text-xs text-ink/60">Items</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLowOnly(!lowOnly)
            setShown(PAGE)
          }}
          className={`${tile} ${
            low > 0
              ? 'border-warn/30 bg-surface'
              : 'border-good/25 bg-surface'
          }`}
        >
          <p className={`text-xl font-bold ${low > 0 ? 'text-warn' : 'text-good'}`}>{low}</p>
          <p className="text-xs text-ink/60">Low or out · tap to {lowOnly ? 'show all' : 'filter'}</p>
        </button>
        <div className={`${tile} border-good/25 bg-surface`}>
          <p className="text-xl font-bold text-good">{formatUGX(value)}</p>
          <p className="text-xs text-ink/60">Stock value (usual cost)</p>
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm font-medium text-good">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-good/70 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {attention && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand px-4 py-3 text-white shadow-sm">
          <p className="mr-1 text-sm font-semibold">Needs attention</p>
          {reorder.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setLowOnly(true)
                setShown(PAGE)
              }}
              className={chip}
            >
              {reorder.length} at or below reorder level
            </button>
          )}
          {expiryItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setExpiryOnly(true)
                setShown(PAGE)
              }}
              className={chip}
            >
              {expiryItems.length} item{expiryItems.length === 1 ? '' : 's'} expired or expiring
            </button>
          )}
          {showReturns && (
            <button type="button" onClick={() => setReviewing(true)} className={chip}>
              {waitingReturns} return{waitingReturns === 1 ? '' : 's'} waiting
            </button>
          )}
          {showReports && (
            <Link to="/inventory/losses" className={chip}>
              {waitingReports} write-off{waitingReports === 1 ? '' : 's'} waiting
            </Link>
          )}
          {manage && topUpRows.length > 0 && (
            <button
              type="button"
              onClick={() => setTopping(true)}
              className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-white/90"
            >
              Top up to par ({topUpRows.length})
            </button>
          )}
        </div>
      )}

      <FilterBar
        query={query}
        onQuery={(v) => {
          setQuery(v)
          setShown(PAGE)
        }}
        placeholder="Search item"
        active={(store !== 'all' ? 1 : 0) + (category !== 'all' ? 1 : 0)}
      >
        {showStores && stores.length > 1 && (
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
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setShown(PAGE)
          }}
          className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {STOCK_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FilterBar>
      {(lowOnly || expiryOnly) && (
        <div className="flex flex-wrap gap-2">
          {lowOnly && (
            <button
              type="button"
              onClick={() => setLowOnly(false)}
              className="rounded-full bg-warn/15 px-3 py-1 text-sm font-medium text-warn"
            >
              Low stock only ✕
            </button>
          )}
          {expiryOnly && (
            <button
              type="button"
              onClick={() => setExpiryOnly(false)}
              className="rounded-full bg-bad/15 px-3 py-1 text-sm font-medium text-bad"
            >
              Expired or expiring only ✕
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/5 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">On hand</th>
              <th className="px-4 py-2">Reorder / par</th>
              <th className="px-4 py-2">Usual cost</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {list.slice(0, shown).map((s) => {
              const waiting = waitingQty(s.id)
              const onOrder = onOrderOf(s.name)
              return (
                <tr key={s.id} onClick={() => setOpen(s)} className="cursor-pointer hover:bg-good/5">
                  <td className="px-4 py-2">
                    <button type="button" className="text-left font-medium text-brand hover:underline">
                      {s.name}
                    </button>
                    <p className="text-xs text-ink/50">
                      {s.category ?? 'Other'}
                      {showStores ? ` · ${storeName(s.store)}` : ''}
                    </p>
                    {waiting > 0 && <p className="text-xs text-warn">{waiting} write-off waiting approval</p>}
                    {expiredIds.has(s.id) ? (
                      <p className="text-xs text-bad">Expired stock: write it off</p>
                    ) : (
                      expiringIds.has(s.id) && <p className="text-xs text-warn">Expiring soon</p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.onHand} {s.unit}
                    {onOrder > 0 && <p className="text-xs text-brand">{onOrder} on order</p>}
                  </td>
                  <td className="px-4 py-2 text-ink/60">
                    {s.reorderAt} / {s.par ?? 0}
                  </td>
                  <td className="px-4 py-2 text-ink/60">{s.unitCost > 0 ? formatUGX(s.unitCost) : ''}</td>
                  <td className="px-4 py-2">
                    {s.onHand === 0 ? (
                      <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">Out</span>
                    ) : isLow(s) ? (
                      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Low</span>
                    ) : (
                      <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-semibold text-good">OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-sm text-ink/60">No items match.</p>}
      </div>
      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="w-full rounded-lg border border-ink/15 py-2 text-sm font-medium text-ink/70"
        >
          Show more ({list.length - shown})
        </button>
      )}

      {open && (
        <ItemPanel
          item={stock.find((x) => x.id === open.id) ?? open}
          canManage={manage}
          canReport={showLosses && manage && open.onHand - waitingQty(open.id) > 0}
          onClose={() => setOpen(null)}
          onReport={() => {
            setReporting(open)
            setOpen(null)
          }}
          onEdit={() => {
            setEditing(open)
            setOpen(null)
          }}
          onHistory={() => {
            setHistory(open)
            setOpen(null)
          }}
        />
      )}
      {editing && <ItemDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {reporting && <ReportLossDialog item={reporting} onClose={() => setReporting(null)} />}
      {history && <ItemHistoryDialog item={history} onClose={() => setHistory(null)} />}
      {managing && <StoresDialog onClose={() => setManaging(false)} />}
      {reviewing && (
        <PendingReturnsDialog
          onClose={() => setReviewing(false)}
          onDone={(r) => {
            setDoc(receiptDoc(r, tenant.name))
            setNotice(`Return note ${r.id} made. The stock is back in the store.`)
          }}
        />
      )}
      {topping && (
        <ReorderDialog
          rows={topUpRows}
          onClose={() => setTopping(false)}
          onDone={(id) =>
            setNotice(
              features.supplyChain
                ? `Requisition ${id} raised against the Store budget. The general manager approves it next.`
                : `Request ${id} sent to management.`,
            )
          }
        />
      )}
      {entry && (
        <StockEntryDialog
          mode={entry}
          onClose={() => setEntry(null)}
          onDone={(r) => setDoc(receiptDoc(r, tenant.name))}
        />
      )}
      {doc && <DocumentDialog doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}