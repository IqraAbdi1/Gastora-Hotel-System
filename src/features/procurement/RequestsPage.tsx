import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import DocumentDialog from '../receipts/DocumentDialog'
import { poDoc, receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'
import ItemPanel from '../inventory/ItemPanel'
import NewRequestDialog from './NewRequestDialog'
import DepartmentReturns from './DepartmentReturns'
import { useRequests } from './requestsContext'
import FilterBar from '../../components/FilterBar'
import {
  departments,
  formatUGX,
  inScope,
  isClosed,
  receiptTitle,
  requestTotal,
  sameName,
  statusLabel,
  statusStyles,
  waitingOn,
} from './requestsModel'
import type { Department, Scope, SupplyRequest } from './requestsModel'

type View = 'waiting' | 'open' | 'closed' | 'all'
const VIEWS: { id: View; label: string }[] = [
  { id: 'waiting', label: 'Waiting for me' },
  { id: 'open', label: 'In progress' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]
const PAGE = 8

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const items = (xs: { qty: number; name: string }[]) => xs.map((i) => `${i.qty} × ${i.name}`).join(', ')

// With a department, this is that department's own Supplies page.
// With a scope, it is the store's (Inventory) or purchasing's (Procurement) workload.
export default function RequestsPage({ department, scope }: { department?: Department; scope?: Scope }) {
  const { user, can } = useAuth()
  const { features } = useFeatures()
  const { requests, needsMe } = useRequests()
  const chain = features.supplyChain
  const full = features.budgetApproval
  // Someone who only asks (an attendant) sees their own requests, not everyone's.
  const handler =
    can('endorseRequest') ||
    can('approveRequest') ||
    can('approveOverBudget') ||
    can('purchase') ||
    can('storeKeep') ||
    can('markBought')
  const views = handler ? VIEWS : VIEWS.filter((v) => v.id !== 'waiting')
  const [picked, setPicked] = useState<View>(handler ? 'waiting' : 'open')
  const view: View = !handler && picked === 'waiting' ? 'open' : picked
  const [deptFilter, setDeptFilter] = useState<Department | 'all'>('all')
  const dept = department ?? deptFilter
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [creating, setCreating] = useState(false)

  const inPage = (r: SupplyRequest) => (!scope || inScope(r, scope)) && (!department || r.department === department)
  const waiting = requests.filter((r) => inPage(r) && needsMe(r)).length

  const matches = (r: SupplyRequest) => {
    if (!inPage(r)) return false
    if (!handler && r.requester !== user?.name) return false
    if (view === 'waiting' && !needsMe(r)) return false
    if (view === 'open' && isClosed(r.status)) return false
    if (view === 'closed' && !isClosed(r.status)) return false
    if (dept !== 'all' && r.department !== dept) return false
    const q = query.trim().toLowerCase()
    if (q) {
      const hay = `${r.id} ${r.requester} ${r.reason} ${r.items.map((i) => i.name).join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }

  const list = requests
    .filter(matches)
    .sort((a, b) => Number(b.urgency === 'Urgent') - Number(a.urgency === 'Urgent') || b.createdAt.localeCompare(a.createdAt))

  const title = department
    ? `${department} supplies`
    : scope === 'store' && chain
      ? 'Store requests'
      : scope === 'finance'
        ? 'Finance approvals'
        : 'Requests'
  const blurb =
    scope === 'finance'
      ? 'Over-budget requisitions wait here for Finance. Accounting, payroll and the ledger are handled in Trademate.'
      : scope === 'store' && chain
        ? 'Issue what is in the store, receive ordered goods and issue them to departments.'
        : scope === 'purchasing' && chain
          ? 'Approve requisitions. Procurement then raises the purchase order and buys.'
          : chain
            ? 'Endorsed, checked against the store, then approved, bought, received and issued.'
            : 'Ask for what you need. Management replies.'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          <p className="text-sm text-ink/60">{blurb}</p>
        </div>
        {can('raiseRequest') && scope !== 'finance' && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            New request
          </button>
        )}
      </div>

      {department && <DepartmentReturns department={department} />}
      {full && (scope === 'purchasing' || scope === 'finance') && handler && <BudgetPanel />}

      <div className="flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setPicked(v.id)
              setShown(PAGE)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              view === v.id ? 'bg-brand text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
            }`}
          >
            {v.label}
            {v.id === 'waiting' && waiting > 0 && ` (${waiting})`}
          </button>
        ))}
        {deptFilter !== 'all' && !department && (
          <button
            type="button"
            onClick={() => setDeptFilter('all')}
            className="rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand"
          >
            {deptFilter} ✕
          </button>
        )}
      </div>

      <FilterBar
        query={query}
        onQuery={(v) => {
          setQuery(v)
          setShown(PAGE)
        }}
        placeholder="Search request ID, item, person or reason"
        active={deptFilter !== 'all' ? 1 : 0}
      >
        {!department && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value as Department | 'all')}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
            <option value="Store">Store (reorder top-ups)</option>
          </select>
        )}
      </FilterBar>

      {list.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">
          {view === 'waiting' ? 'Nothing is waiting for you.' : 'No requests match.'}
        </p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, shown).map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
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

      {creating && <NewRequestDialog department={department} onClose={() => setCreating(false)} />}
    </div>
  )
}

function BudgetPanel() {
  const { can } = useAuth()
  const { budgets, budgetStatus, setBudget } = useRequests()
  const edit = can('changeSettings')
  return (
    <details className="rounded-xl border border-ink/10 bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold">Department budgets this month</summary>
      <div className="mt-3 space-y-3">
        {budgets.map((b) => {
          const s = budgetStatus(b.id)
          const usedPct = s.monthly ? Math.min(100, Math.round((s.spent / s.monthly) * 100)) : 0
          const pendingPct = s.monthly ? Math.min(100 - usedPct, Math.round((s.pending / s.monthly) * 100)) : 0
          return (
            <div key={b.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="text-ink/60">
                  Left {formatUGX(s.remaining)} of {formatUGX(s.monthly)}
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-ink/10">
                <div className="bg-brand" style={{ width: `${usedPct}%` }} />
                <div className="bg-warn/60" style={{ width: `${pendingPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink/50">
                Approved {formatUGX(s.spent)}. Waiting {formatUGX(s.pending)}.
              </p>
              {edit && (
                <label className="mt-1 block text-xs text-ink/60">
                  Monthly amount
                  <input
                    key={b.monthly}
                    defaultValue={b.monthly}
                    inputMode="numeric"
                    onBlur={(e) => setBudget(b.id, parseInt(e.target.value, 10) || 0)}
                    className="ml-2 w-36 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}

function RequestCard({ r }: { r: SupplyRequest }) {
  const { features, tenant } = useFeatures()
  const { can } = useAuth()
  const navigate = useNavigate()
  const q = useRequests()
  const full = features.budgetApproval
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [delivery, setDelivery] = useState('')
  const [doc, setDoc] = useState<DocView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supplier, setSupplier] = useState('')
  const [costs, setCosts] = useState<string[]>(() =>
    r.items.map((i) => String(i.unitCost || q.stock.find((s) => sameName(s.name, i.name))?.unitCost || '')),
  )
  // What arrived now, typed per item. Empty means "everything still on order".
  const [arrived, setArrived] = useState<Record<number, string>>({})
  const [closeShort, setCloseShort] = useState(false)
  const [shortReason, setShortReason] = useState('')
  const [expiries, setExpiries] = useState<Record<number, string>>({})
  const [batchNos, setBatchNos] = useState<Record<number, string>>({})
  // The item whose history panel is open.
  const [panelFor, setPanelFor] = useState<string | null>(null)

  const total = requestTotal(r)
  const mine = q.needsMe(r)
  const over = q.isOverBudget(r)
  const budget = q.budgetStatus(r.department, r.id)
  const atStore = r.status === 'Endorsed' && mine
  const have = r.items.map((i) => q.stockOf(i.name))
  const shortQty = r.items.map((i, n) => Math.max(0, i.qty - have[n]))
  const allInStock = shortQty.every((s) => s === 0)
  const anyInStock = have.some((h) => h > 0)
  const typed = costs.map((c) => Math.max(0, parseInt(c, 10) || 0))
  const draftTotal = shortQty.reduce((s, qty, n) => s + qty * typed[n], 0)
  const activeSuppliers = q.suppliers.filter((s) => s.active)
  const chosen = supplier || activeSuppliers[0]?.name || ''

  const order = r.poId ? q.orders.find((o) => o.id === r.poId) : undefined
  const myReceipts = q.receipts.filter((x) => x.requestId === r.id)
  const unitOf = (name: string) => q.stock.find((s) => sameName(s.name, name))?.unit ?? 'piece'

  // Short deliveries: how much of each line has arrived so far, and what is still due.
  const arrivedSoFar = r.items.map((_, n) => order?.got?.[n] ?? 0)
  const stillDue = r.items.map((i, n) => Math.max(0, i.qty - arrivedSoFar[n]))
  const gotNow = stillDue.map((due, n) => Math.min(due, Math.max(0, parseInt(arrived[n] ?? String(due), 10) || 0)))
  const missingAfter = gotNow.some((g, n) => g < stillDue[n])
  const partDelivered = arrivedSoFar.some((g) => g > 0)

  // Item history: the side panel is open to everyone; the full Movements page only to store roles.
  const panelItem = panelFor ? q.stock.find((s) => sameName(s.name, panelFor)) : undefined
  const canOpenMovements = can('storeKeep') || can('changeSettings')

  function run(result: string | null) {
    setError(result)
    if (!result) {
      setNote('')
      setDelivery('')
      setArrived({})
      setCloseShort(false)
      setShortReason('')
      setExpiries({})
      setBatchNos({})
    }
  }

  function receiveNow() {
    if (closeShort && missingAfter && !shortReason.trim()) {
      return setError('Write why the rest will not be delivered.')
    }
    run(
      q.receive(r.id, {
        reference: delivery.trim() || undefined,
        got: gotNow,
        closeShort: closeShort && missingAfter ? shortReason.trim() : undefined,
        expiries: r.items.map((_, n) => expiries[n] ?? ''),
        batchNos: r.items.map((_, n) => batchNos[n] ?? ''),
      }),
    )
  }

  const receiveLabel =
    missingAfter && closeShort ? 'Receive and close short' : missingAfter ? 'Receive part delivery' : 'Goods received'

  const btn = 'rounded-lg px-3 py-1.5 text-sm font-semibold'
  const primary = `${btn} bg-brand text-white`
  const danger = `${btn} border border-bad text-bad`
  const quiet = `${btn} border border-ink/30 text-ink/70`
  const chip = 'rounded-lg border border-brand/40 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5'
  const canReject = mine && (r.status === 'With head' || r.status === 'Requisition' || r.status === 'Needs finance')
  const partlyIssued = (r.issuedEarly?.length ?? 0) > 0
  const receiving = mine && r.status === 'Ordered'
  const section = 'rounded-lg border border-ink/10 px-3 py-2'
  const sectionTitle = 'cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink/50'

  return (
    <div className="rounded-xl border border-ink/10 bg-surface">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 p-4 text-left">
        <span className="flex-1">
          <span className="block text-xs font-medium text-ink/50">{r.id}</span>
          <span className="block font-semibold">{items(r.items)}</span>
          <span className="block text-sm text-ink/60">
            {r.department} · {r.requester} · {time(r.createdAt)}
            {total > 0 && ` · ${formatUGX(total)}`}
            {partlyIssued && ' · part issued from store'}
          </span>
        </span>
        {r.urgency === 'Urgent' && !isClosed(r.status) && (
          <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">Urgent</span>
        )}
        {over && !isClosed(r.status) && (
          <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">Over budget</span>
        )}
        {order?.status === 'Part received' && (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Part received</span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[r.status]}`}>
          {statusLabel(r.status)}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink/10 p-4 text-sm">
          {(r.reason || waitingOn[r.status]) && (
            <div className="rounded-lg bg-surface px-3 py-2">
              {r.reason && <p className="text-ink/80">{r.reason}</p>}
              {waitingOn[r.status] && <p className="text-xs font-medium text-ink/60">{waitingOn[r.status]}</p>}
            </div>
          )}

          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10">
            {r.items.map((i, n) => {
              const known = q.stock.some((s) => sameName(s.name, i.name))
              return (
                <li key={n} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">
                    {i.qty} × {i.name}
                  </span>
                  <span className="flex items-center gap-3">
                    {atStore ? (
                      <span className={shortQty[n] === 0 ? 'text-good' : have[n] > 0 ? 'text-warn' : 'text-bad'}>
                        {shortQty[n] === 0 ? `${have[n]} in store` : `${have[n]} in store · need ${shortQty[n]} more`}
                      </span>
                    ) : order && partDelivered ? (
                      <span className={arrivedSoFar[n] >= i.qty ? 'text-good' : 'text-warn'}>
                        received {arrivedSoFar[n]} of {i.qty}
                      </span>
                    ) : (
                      i.unitCost > 0 && <span className="text-ink/60">{formatUGX(i.qty * i.unitCost)}</span>
                    )}
                    {known && (
                      <button
                        type="button"
                        onClick={() => setPanelFor(i.name)}
                        className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand/20"
                      >
                        History
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>

          {(partlyIssued || r.poId || (full && r.requisitionAt)) && (
            <div className="space-y-0.5 text-xs text-ink/60">
              {partlyIssued && r.issuedEarly && <p>Already issued from the store: {items(r.issuedEarly)}.</p>}
              {r.poId && <p>Purchase order: {r.poId}</p>}
              {full && r.requisitionAt && (
                <p>
                  {r.department} budget left now: {formatUGX(budget.remaining)}.
                  {over && ' This requisition is over what is left. (Rule)'}
                </p>
              )}
            </div>
          )}

          {order?.closedShort && (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-ink/70">
              Closed short by {order.closedShort.by}, {time(order.closedShort.at)}: {order.closedShort.reason}
            </p>
          )}

          {(order || myReceipts.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {order && (
                <button
                  type="button"
                  onClick={() => setDoc(poDoc(order, tenant.name, unitOf, r.department))}
                  className={chip}
                >
                  Purchase order {order.id}
                </button>
              )}
              {myReceipts.map((x) => (
                <button key={x.id} type="button" onClick={() => setDoc(receiptDoc(x, tenant.name))} className={chip}>
                  {receiptTitle[x.kind]} {x.id}
                </button>
              ))}
            </div>
          )}

          {atStore && !allInStock && full && (
            <details className={section}>
              <summary className="cursor-pointer text-sm">
                <span className="font-semibold">Estimate {formatUGX(draftTotal)}</span>{' '}
                <span className={draftTotal > budget.remaining ? 'text-bad' : 'text-ink/60'}>
                  · {r.department} budget left {formatUGX(budget.remaining)}
                  {draftTotal > budget.remaining && ' · over budget, Finance must approve (Rule)'}
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-ink/50">Cost of one (UGX), for what is short</p>
                {r.items.map((i, n) =>
                  shortQty[n] > 0 ? (
                    <label key={n} className="flex items-center justify-between gap-2">
                      <span>
                        {i.name} ({shortQty[n]})
                      </span>
                      <input
                        value={costs[n]}
                        onChange={(e) => setCosts((cs) => cs.map((c, k) => (k === n ? e.target.value : c)))}
                        inputMode="numeric"
                        className="w-32 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                  ) : null,
                )}
              </div>
            </details>
          )}

          {mine && r.status === 'Approved' && (
            <label className="block text-xs font-medium text-ink/60">
              Supplier
              {activeSuppliers.length === 0 ? (
                <span className="mt-1 block text-bad">Add a supplier first, under Procurement → Suppliers.</span>
              ) : (
                <select
                  value={chosen}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  {activeSuppliers.map((s) => (
                    <option key={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </label>
          )}

          {receiving && (
            <div className="space-y-2 rounded-lg bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">What arrived now</p>
                            {r.items.map((i, n) =>
                stillDue[n] > 0 ? (
                  <div key={n} className="space-y-1">
                    <label className="flex items-center justify-between gap-2">
                      <span>
                        {i.name} <span className="text-ink/50">(still due {stillDue[n]})</span>
                      </span>
                      <input
                        value={arrived[n] ?? String(stillDue[n])}
                        onChange={(e) => setArrived((a) => ({ ...a, [n]: e.target.value }))}
                        inputMode="numeric"
                        aria-label={`Quantity of ${i.name} that arrived`}
                        className="w-20 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                    {q.tracksExpiry(i.name) && gotNow[n] > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-ink/60">
                        <label className="flex items-center gap-1">
                          Expires
                          <input
                            type="date"
                            value={expiries[n] ?? ''}
                            onChange={(e) => setExpiries((x) => ({ ...x, [n]: e.target.value }))}
                            className="rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                          />
                        </label>
                        <input
                          value={batchNos[n] ?? ''}
                          onChange={(e) => setBatchNos((x) => ({ ...x, [n]: e.target.value }))}
                          placeholder="Batch no. (optional)"
                          className="w-40 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                ) : null,
              )}
              <label className="block text-xs font-medium text-ink/60">
                Delivery note number (optional)
                <input
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  placeholder="From the supplier's delivery note"
                  className="mt-1 block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
                />
              </label>
              {missingAfter && (
                <div className="space-y-1">
                  <p className="text-warn">Less than ordered. The rest stays on order unless you close it.</p>
                  <label className="flex items-center gap-2 text-ink/70">
                    <input type="checkbox" checked={closeShort} onChange={(e) => setCloseShort(e.target.checked)} />
                    Close the order with what has arrived
                  </label>
                  {closeShort && (
                    <input
                      value={shortReason}
                      onChange={(e) => setShortReason(e.target.value)}
                      placeholder="Why will the rest not come? (needed)"
                      className="block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <details className={section}>
            <summary className={sectionTitle}>History ({r.history.length})</summary>
            <ul className="mt-2 space-y-0.5 text-ink/70">
              {r.history.map((h, n) => (
                <li key={n}>
                  {time(h.at)} · {h.by} · {h.text}
                </li>
              ))}
            </ul>
          </details>

          {r.messages.length > 0 && (
            <details className={section}>
              <summary className={sectionTitle}>Messages ({r.messages.length})</summary>
              <ul className="mt-2 space-y-1">
                {r.messages.map((m, n) => (
                  <li key={n} className="rounded-lg bg-ink/5 px-3 py-2">
                    <span className="font-medium">{m.by}</span> <span className="text-ink/50">{time(m.at)}</span>
                    <br />
                    {m.text}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-2">
            {error && <p className="text-bad">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {mine && r.flow === 'simple' && (
                <>
                  <button type="button" onClick={() => run(q.markBought(r.id, note))} className={primary}>
                    Bought
                  </button>
                  <button type="button" onClick={() => run(q.notNow(r.id, note))} className={quiet}>
                    Not now
                  </button>
                </>
              )}
              {mine && r.status === 'With head' && (
                <button type="button" onClick={() => run(q.endorse(r.id))} className={primary}>
                  Endorse
                </button>
              )}
              {atStore && allInStock && (
                <button type="button" onClick={() => run(q.issue(r.id))} className={primary}>
                  Issue from store
                </button>
              )}
              {atStore && !allInStock && (
                <button type="button" onClick={() => run(q.requisition(r.id, typed))} className={primary}>
                  {anyInStock ? 'Issue what is in store and requisition the rest' : 'Not in store: raise requisition'}
                </button>
              )}
              {mine && r.status === 'Requisition' && (
                <button type="button" onClick={() => run(q.approve(r.id))} className={primary}>
                  Approve
                </button>
              )}
              {mine && r.status === 'Needs finance' && (
                <button type="button" onClick={() => run(q.approve(r.id))} className={primary}>
                  Approve over budget
                </button>
              )}
              {mine && r.status === 'Approved' && (
                <button type="button" onClick={() => run(q.purchase(r.id, chosen))} className={primary}>
                  Raise PO and buy
                </button>
              )}
              {receiving && (
                <button type="button" onClick={receiveNow} className={primary}>
                  {receiveLabel}
                </button>
              )}
              {mine && r.status === 'Received' && (
                <button type="button" onClick={() => run(q.issue(r.id))} className={primary}>
                  Issue to department
                </button>
              )}
              {canReject && (
                <button type="button" onClick={() => run(q.reject(r.id, note))} className={danger}>
                  Reject
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={canReject ? 'Reason (needed to reject) or a message' : 'Write a message'}
                className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  q.reply(r.id, note)
                  setNote('')
                }}
                className={`${btn} border border-brand/40 text-brand`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {panelItem && (
        <ItemPanel
          item={panelItem}
          canManage={false}
          canReport={false}
          onClose={() => setPanelFor(null)}
          onReport={() => {}}
          onEdit={() => {}}
          onHistory={() => {
            if (canOpenMovements) navigate(`/inventory/movements?item=${encodeURIComponent(panelItem.name)}`)
          }}
        />
      )}
      {doc && <DocumentDialog doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}