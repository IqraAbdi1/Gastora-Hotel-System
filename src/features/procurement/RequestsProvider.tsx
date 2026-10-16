import { useMemo, useRef } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { RequestsContext } from './requestsContext'
import type { BudgetStatus, EntryLine, NewRequest, RequestsValue, Result } from './requestsContext'
import {
  BUYING,
  DEFAULT_LOSS_LIMIT,
  DEFAULT_REVERSAL_ALERT,
  MAIN_STORE_ID,
  NEEDS_PHOTO,
  PENDING,
  SAMPLE_BUDGETS,
  SAMPLE_LOSSES,
  SAMPLE_MOVEMENTS,
  SAMPLE_ORDERS,
  SAMPLE_RECEIPTS,
  SAMPLE_REQUESTS,
  SAMPLE_STOCK,
  SAMPLE_STORES,
  SAMPLE_SUPPLIERS,
  SPENT,
  STORE_DEPARTMENT,
  canReverse,
  countVariance,
  formatUGX,
  headDepartment,
  inScope,
  lossValue,
  mergeItems,
  requestTotal,
  sameName,
} from './requestsModel'
import type {
  Flow,
  ItemChange,
  LossReport,
  Movement,
  PurchaseOrder,
  Receipt,
  ReceiptKind,
  ReceiptLine,
  RequestItem,
  RequestStatus,
  ReturnRequest,
  Scope,
  StockCount,
  Store,
  SupplyRequest,
} from './requestsModel'
import { DEFAULT_EXPIRY_WARN_DAYS, SAMPLE_BATCHES, drawFefo, drawText, expiryProblem, expiryState } from './batches'
import type { Batch, Draw } from './batches'
import { CLASS_DAYS, dueForCount } from './cycleCount'
import type { CountClass } from './cycleCount'

const sameMonth = (iso: string) => {
  const a = new Date(iso)
  const b = new Date()
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const list = (xs: { qty: number; name: string }[]) => xs.map((i) => `${i.qty} × ${i.name}`).join(', ')

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Two rows with the same item (and the same expiry date) become one. */
function mergeLines(lines: EntryLine[]): EntryLine[] {
  const out: EntryLine[] = []
  for (const l of lines) {
    const hit = out.find((o) => sameName(o.name, l.name) && o.expiry === l.expiry && o.batchNo === l.batchNo)
    if (hit) {
      hit.qty += l.qty
      if (l.unitCost > 0) hit.unitCost = l.unitCost
    } else out.push({ ...l })
  }
  return out
}

type MoveExtra = {
  requestId?: string
  receiptId?: string
  from?: string
  to?: string
  approvedBy?: string
  lossId?: string
  store?: string
}

export default function RequestsProvider({ children }: { children: ReactNode }) {
  const { user, role, can } = useAuth()
  const { features } = useFeatures()
  const chain = features.supplyChain
  const full = features.budgetApproval
  const flow: Flow = chain ? 'chain' : 'simple'

  const [all, setAll] = useBrowserSyncedState<SupplyRequest[]>('gastora.inventory.requests.v1', SAMPLE_REQUESTS)
  const [budgets, setBudgets] = useBrowserSyncedState('gastora.inventory.budgets.v1', SAMPLE_BUDGETS)
  const [stock, setStock] = useBrowserSyncedState('gastora.inventory.stock.v1', SAMPLE_STOCK)
  const [stores, setStores] = useBrowserSyncedState<Store[]>('gastora.inventory.stores.v1', SAMPLE_STORES)
  const [movements, setMovements] = useBrowserSyncedState<Movement[]>('gastora.inventory.movements.v1', SAMPLE_MOVEMENTS)
  const [orders, setOrders] = useBrowserSyncedState<PurchaseOrder[]>('gastora.inventory.orders.v1', SAMPLE_ORDERS)
  const [suppliers, setSuppliers] = useBrowserSyncedState('gastora.inventory.suppliers.v1', SAMPLE_SUPPLIERS)
  const [receipts, setReceipts] = useBrowserSyncedState<Receipt[]>('gastora.inventory.receipts.v1', SAMPLE_RECEIPTS)
  const [counts, setCounts] = useBrowserSyncedState<StockCount[]>('gastora.inventory.counts.v1', [])
  const [losses, setLosses] = useBrowserSyncedState<LossReport[]>('gastora.inventory.losses.v1', SAMPLE_LOSSES)
  const [lossLimit, setLossLimitState] = useBrowserSyncedState('gastora.inventory.lossLimit.v1', DEFAULT_LOSS_LIMIT)
  const [reversalAlert, setReversalAlertState] = useBrowserSyncedState('gastora.inventory.reversalAlert.v1', DEFAULT_REVERSAL_ALERT)
  const [itemLog, setItemLog] = useBrowserSyncedState<ItemChange[]>('gastora.inventory.itemLog.v1', [])
  const seq = useRef(1009)
  const poSeq = useRef(2002)
  const mvSeq = useRef(100)
  const grnSeq = useRef(3001)
  const purSeq = useRef(4001)
  const issSeq = useRef(5001)
  const cntSeq = useRef(6001)
  const lossSeq = useRef(7001)
  const logSeq = useRef(8001)
  const retSeq = useRef(9001)
  const rtqSeq = useRef(9501)
  const batSeq = useRef(1001)
  // What the last issue or write-off took from which batches. The movement and receipt read it, then clear it.
  const drawn = useRef<Record<string, Draw[]>>({})
  const [batches, setBatches] = useBrowserSyncedState<Batch[]>('gastora.inventory.batches.v1', SAMPLE_BATCHES)
  const [expiryWarn, setExpiryWarnState] = useBrowserSyncedState('gastora.inventory.expiryWarn.v1', DEFAULT_EXPIRY_WARN_DAYS)
  const [countDays, setCountDaysState] = useBrowserSyncedState<Record<CountClass, number>>('gastora.inventory.countDays.v1', CLASS_DAYS)
  const [returns, setReturns] = useBrowserSyncedState<ReturnRequest[]>('gastora.inventory.returns.v1', [])

  const who = user?.name ?? 'Someone'
  // A hotel only sees requests of its own way of working.
  const requests = all.filter((r) => r.flow === flow)
  const find = (id: string) => all.find((r) => r.id === id)

  /** The hotel has expiry dates on and this item is set to track them. */
  const tracks = (name: string) => features.batchExpiry && !!stock.find((s) => sameName(s.name, name))?.tracksExpiry
  const expiredQty = (name: string) =>
    batches
      .filter((b) => sameName(b.item, name) && expiryState(b.expiry, expiryWarn) === 'expired')
      .reduce((sum, b) => sum + b.qty, 0)
  /** What can be issued: on hand, less batches past their date. */
  const stockOf = (name: string) => {
    const s = stock.find((x) => sameName(x.name, name))
    if (!s) return 0
    return tracks(name) ? Math.max(0, s.onHand - expiredQty(name)) : s.onHand
  }
  const countsDue = useMemo(() => dueForCount(stock, counts, countDays), [stock, counts, countDays])
  const unitOf = (name: string) => stock.find((s) => sameName(s.name, name))?.unit ?? 'unit'
  const costOf = (name: string) => stock.find((s) => sameName(s.name, name))?.unitCost ?? 0

  /** What is already being bought or still to arrive for an item, so a top-up does not order it twice. */
  const onOrderOf = (name: string) =>
    requests.reduce((sum, r) => {
      const buying = BUYING.includes(r.status) || (r.flow === 'simple' && r.status === 'Submitted' && r.department === STORE_DEPARTMENT)
      if (!buying) return sum
      const n = r.items.findIndex((i) => sameName(i.name, name))
      if (n < 0) return sum
      const po = r.poId ? orders.find((o) => o.id === r.poId) : undefined
      const got = po?.got?.[n] ?? 0
      return sum + Math.max(0, r.items[n].qty - got)
    }, 0)

  /** Issued to a department, less what it has already sent back. */
  const returnable = (department: string, name: string) => {
    const issued = movements
      .filter((m) => m.kind === 'Issued' && m.to === department && sameName(m.item, name))
      .reduce((s, m) => s + m.qty, 0)
    const back = movements
      .filter((m) => m.kind === 'Received' && m.from === department && !!m.receiptId?.startsWith('RET-') && sameName(m.item, name))
      .reduce((s, m) => s + m.qty, 0)
    return Math.max(0, issued - back)
  }

  /** Promised in returns the storekeeper has not confirmed yet. */
  const pendingReturnQty = (department: string, name: string) =>
    returns
      .filter((r) => r.status === 'Pending' && r.department === department)
      .reduce((sum, r) => sum + r.lines.filter((l) => sameName(l.name, name)).reduce((s, l) => s + l.qty, 0), 0)

  /** Name of a store from its id. No id means the main store. */
  const storeName = (id?: string) =>
    stores.find((s) => s.id === (id ?? MAIN_STORE_ID))?.name ?? stores[0]?.name ?? 'Main store'
  /** The store written on a receipt or movement. Only when the hotel uses several stores. */
  const storeStamp = (itemName: string) =>
    features.stores ? storeName(stock.find((s) => sameName(s.name, itemName))?.store) : undefined

  /** An issue is valued at what the store holds the item at. */
  const issueLine = (i: RequestItem): ReceiptLine => ({
    name: i.name,
    unit: unitOf(i.name),
    qty: i.qty,
    unitCost: costOf(i.name),
    store: storeStamp(i.name),
  })

  function makeReceipt(kind: ReceiptKind, lines: ReceiptLine[], extra: Partial<Receipt>): Receipt {
    const counter =
      kind === 'GRN' ? grnSeq : kind === 'DIRECT' ? purSeq : kind === 'RETURN' ? retSeq : issSeq
    const prefix = kind === 'GRN' ? 'GRN' : kind === 'DIRECT' ? 'PUR' : kind === 'RETURN' ? 'RET' : 'ISS'
    return { id: `${prefix}-${counter.current++}`, kind, at: new Date().toISOString(), by: who, lines, ...extra }
  }

  function makeMoves(kind: Movement['kind'], lines: ReceiptLine[], reason: string, extra: MoveExtra): Movement[] {
    const at = new Date().toISOString()
    const used = drawn.current
    drawn.current = {}
    return lines.map((l) => {
      const taken = used[l.name.trim().toLowerCase()]
      return {
        id: `MV-${mvSeq.current++}`,
        at,
        by: who,
        kind,
        item: l.name,
        qty: l.qty,
        cost: l.unitCost,
        reason,
        store: storeStamp(l.name),
        batch: taken?.length ? drawText(taken) : undefined,
        ...extra,
      }
    })
  }

  function logChanges(itemId: string, item: string, rows: { field: string; from: string; to: string }[]) {
    if (rows.length === 0) return
    const at = new Date().toISOString()
    const entries: ItemChange[] = rows.map((r) => ({ id: `IL-${logSeq.current++}`, at, by: who, itemId, item, ...r }))
    setItemLog((ls) => [...entries, ...ls])
  }

  /** Takes stock out. Items that track expiry come out of the batch that expires first. Write-offs may also take expired batches. */
  function takeStock(lines: { name: string; qty: number }[], slipId?: string, allowExpired = false) {
    setStock((ss) =>
      ss.map((s) => {
        const l = lines.find((x) => sameName(x.name, s.name))
        return l ? { ...s, onHand: s.onHand - l.qty } : s
      }),
    )
    const used: Record<string, Draw[]> = {}
    let next = batches
    for (const l of lines) {
      if (!tracks(l.name)) continue
      const d = drawFefo(next, l.name, l.qty, allowExpired)
      next = d.next
      if (d.used.length > 0) used[l.name.trim().toLowerCase()] = d.used
    }
    drawn.current = used
    if (Object.keys(used).length > 0) {
      setBatches(next)
      if (slipId) {
        setReceipts((rs) =>
          rs.map((r) =>
            r.id === slipId
              ? {
                  ...r,
                  lines: r.lines.map((l) => {
                    const u = used[l.name.trim().toLowerCase()]
                    return u ? { ...l, batches: drawText(u) } : l
                  }),
                }
              : r,
          ),
        )
      }
    }
  }

  /** Goods in: each delivery of an item that tracks expiry becomes a batch. */
  function addBatches(receiptId: string, entries: { line: ReceiptLine; expiry?: string; batchNo?: string }[]) {
    const made: Batch[] = []
    for (const e of entries) {
      const item = stock.find((s) => sameName(s.name, e.line.name))
      if (!item || !tracks(e.line.name) || !e.expiry) continue
      made.push({
        id: `BAT-${batSeq.current++}`,
        itemId: item.id,
        item: item.name,
        qty: e.line.qty,
        received: e.line.qty,
        unitCost: e.line.unitCost,
        expiry: e.expiry,
        batchNo: e.batchNo?.trim() || undefined,
        receiptId,
        at: new Date().toISOString(),
      })
    }
    if (made.length > 0) setBatches((bs) => [...bs, ...made])
  }

  function addStock(lines: ReceiptLine[]) {
    setStock((ss) => {
      const next = ss.map((s) => ({ ...s }))
      for (const l of lines) {
        const s = next.find((x) => sameName(x.name, l.name))
        if (s) {
          s.onHand += l.qty
          if (l.unitCost > 0) s.unitCost = l.unitCost
        } else {
          next.push({
            id: `s-${Date.now()}-${next.length}`,
            name: l.name,
            unit: l.unit,
            category: 'Other',
            onHand: l.qty,
            reorderAt: 0,
            unitCost: l.unitCost,
          })
        }
      }
      return next
    })
  }

  /** A write-off takes the quantity out of stock and leaves an Adjusted movement. */
  function deductLoss(l: LossReport, approval: string) {
    takeStock([{ name: l.item, qty: l.qty }], undefined, true)
    const m = makeMoves(
      'Adjusted',
      [{ name: l.item, unit: l.unit, qty: -l.qty, unitCost: l.unitCost }],
      `Write-off: ${l.reason} (${l.id})`,
      { from: 'Store', to: `Written off (${l.reason})`, approvedBy: approval, lossId: l.id },
    )
    setMovements((ms) => [...m, ...ms])
  }

  /** A reversal puts the quantity back. The usual cost of the item is left as it is. */
  function putBack(l: LossReport) {
    setStock((ss) => ss.map((s) => (s.id === l.itemId ? { ...s, onHand: s.onHand + l.qty } : s)))
    const m = makeMoves(
      'Adjusted',
      [{ name: l.item, unit: l.unit, qty: l.qty, unitCost: l.unitCost }],
      `Write-off reversed (${l.id})`,
      { from: `Written off (${l.reason})`, to: 'Store', approvedBy: who, lossId: l.id },
    )
    setMovements((ms) => [...m, ...ms])
  }

  function budgetStatus(department: string, excludeId?: string): BudgetStatus {
    const monthly = budgets.find((b) => b.id === department)?.monthly ?? 0
    let spent = 0
    let pending = 0
    for (const r of requests) {
      if (r.id === excludeId || r.department !== department || !r.requisitionAt || !sameMonth(r.requisitionAt)) continue
      if (SPENT.includes(r.status)) spent += requestTotal(r)
      else if (PENDING.includes(r.status)) pending += requestTotal(r)
    }
    return { monthly, spent, pending, remaining: monthly - spent }
  }

  function isOverBudget(r: SupplyRequest) {
    if (!full || !r.requisitionAt) return false
    return requestTotal(r) > budgetStatus(r.department, r.id).remaining
  }

  function change(id: string, patch: Partial<SupplyRequest>, text: string | string[], reply?: string) {
    const at = new Date().toISOString()
    const texts = Array.isArray(text) ? text : [text]
    setAll((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              history: [...r.history, ...texts.map((t) => ({ at, by: who, text: t }))],
              messages: reply?.trim() ? [...r.messages, { at, by: who, text: reply.trim() }] : r.messages,
            }
          : r,
      ),
    )
  }

  const canEndorse = (r: SupplyRequest) =>
    r.status === 'With head' &&
    can('endorseRequest') &&
    !!role &&
    (role.id === 'gm' || headDepartment[role.id] === r.department)

  function needsMe(r: SupplyRequest) {
    if (r.flow === 'simple') return r.status === 'Submitted' && can('markBought')
    switch (r.status) {
      case 'With head':
        return canEndorse(r)
      case 'Endorsed':
      case 'Ordered':
      case 'Received':
        return can('storeKeep')
      case 'Requisition':
        return can('approveRequest')
      case 'Needs finance':
        return can('approveOverBudget')
      case 'Approved':
        return can('purchase')
      default:
        return false
    }
  }

  const value: RequestsValue = {
    requests,
    budgets,
    stock,
    stores,
    storeName,
    movements,
    orders,
    suppliers,
    receipts,
    counts,
    losses,
    lossLimit,
    reversalAlert,
    itemLog,
    waitingIn: (scope: Scope) => requests.filter((r) => inScope(r, scope) && needsMe(r)).length,
    needsMe,
    budgetStatus,
    isOverBudget,
    stockOf,
    onOrderOf,
    returnable,
    pendingReturnQty,
    returns,
    batches,
    tracksExpiry: tracks,
    expiryWarn,
    setExpiryWarn: (days) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change this.'
      setExpiryWarnState(Math.min(365, Math.max(1, Math.round(days))))
      return null
    },
    countDays,
    setCountDays: (cls, days) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change this.'
      setCountDaysState((d) => ({ ...d, [cls]: Math.min(730, Math.max(1, Math.round(days))) }))
      return null
    },
    countsDue,

    consumeStockForSale: (lines, saleId, outlet) => {
      if (!saleId.trim()) return fail('A unique sale reference is required for stock deduction.')
      // Idempotency guard: a retry of the same checkout must never deduct stock twice.
      const alreadyIssued = movements.some((movement) => movement.reason === `POS sale ${saleId}`)
      if (alreadyIssued) return fail(`Sale ${saleId} has already deducted inventory. Refresh the order history before retrying.`)
      if (!lines.length) return fail('No stock lines were supplied for this sale.')
      const merged: { name: string; qty: number }[] = []
      for (const line of lines) {
        const qty = Number(line.qty)
        if (!line.name.trim() || !Number.isFinite(qty) || qty <= 0) return fail('Each stock deduction needs an item and a positive quantity.')
        const existing = merged.find((x) => sameName(x.name, line.name))
        if (existing) existing.qty += qty
        else merged.push({ name: line.name.trim(), qty })
      }
      // Validate every line before changing any stock, so a failed sale never partially deducts inventory.
      for (const line of merged) {
        const item = stock.find((x) => sameName(x.name, line.name))
        if (!item) return fail(`Inventory item “${line.name}” was not found. Configure the recipe to use an existing stock item.`)
        const available = stockOf(item.name)
        if (available < line.qty) return fail(`Insufficient stock for ${item.name}: ${available} ${item.unit} available, ${line.qty} required.`)
      }
      const at = new Date().toISOString()
      const made: Movement[] = merged.map((line) => {
        const item = stock.find((x) => sameName(x.name, line.name))!
        return { id: `POS-${mvSeq.current++}`, at, by: who, kind: 'Issued', item: item.name, qty: line.qty, cost: item.unitCost, reason: `POS sale ${saleId}`, to: `${outlet} POS`, store: item.store ?? MAIN_STORE_ID }
      })
      setStock((current) => current.map((item) => {
        const line = merged.find((x) => sameName(x.name, item.name))
        return line ? { ...item, onHand: item.onHand - line.qty } : item
      }))
      setMovements((current) => [...made, ...current])
      return { ok: true, value: made }
    },

    raise: (input: NewRequest) => {
      const at = new Date().toISOString()
      const id = `SR-${seq.current++}`
      // In the full chain only an attendant needs the head to endorse first.
      const needsHead = chain && role?.id === 'attendant'
      // The storekeeper raising a request means the store itself is out, so there is nothing for the
      // store to check: it goes straight to purchasing and the budget, like any other requisition.
      const fromStore = chain && role?.id === 'storekeeper'
      const status: RequestStatus = !chain ? 'Submitted' : needsHead ? 'With head' : fromStore ? 'Requisition' : 'Endorsed'
      const history = [{ at, by: who, text: 'Raised' }]
      if (fromStore) history.push({ at, by: who, text: 'Raised by the store, so no shelf check was needed' })
      if (chain && !needsHead) {
        history.push({ at, by: who, text: `Endorsement not needed (raised by ${role?.label ?? 'staff'})` })
      }
      setAll((rs) => [
        {
          id,
          flow,
          department: input.department,
          requester: who,
          createdAt: at,
          urgency: input.urgency,
          reason: input.reason,
          items: mergeItems(input.items),
          status,
          ...(fromStore ? { requisitionAt: at } : {}),
          history,
          messages: [],
        },
        ...rs,
      ])
      return id
    },

    endorse: (id) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!canEndorse(r)) return 'Only this department head can endorse this request.'
      change(id, { status: 'Endorsed' }, 'Endorsed by department head')
      return null
    },

    reject: (id, reason) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      const allowed =
        canEndorse(r) ||
        (r.status === 'Requisition' && can('approveRequest')) ||
        (r.status === 'Needs finance' && can('approveOverBudget'))
      if (!allowed) return 'You cannot reject this request now.'
      if (!reason.trim()) return 'Give a reason so the person knows why.'
      change(id, { status: 'Rejected' }, 'Rejected', reason)
      return null
    },

    issue: (id) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('storeKeep')) return 'Only the storekeeper can issue from the store.'
      if (r.status !== 'Endorsed' && r.status !== 'Received') return 'This request is not ready to issue.'
      const short = r.items.filter((i) => stockOf(i.name) < i.qty)
      if (short.length > 0) {
        return `Not everything is in the store: ${list(short)}. Raise a requisition for the rest.`
      }
      const slip = makeReceipt('ISSUE', r.items.map(issueLine), { requestId: r.id, department: r.department })
      setReceipts((rs) => [slip, ...rs])
      takeStock(slip.lines, slip.id)
      const m = makeMoves('Issued', slip.lines, `Issued to ${r.department} (${r.id})`, {
        requestId: r.id,
        receiptId: slip.id,
        from: 'Store',
        to: r.department,
      })
      setMovements((ms) => [...m, ...ms])
      change(id, { status: 'Issued' }, `Issued from the store to ${r.department} (${slip.id})`)
      return null
    },

    requisition: (id, unitCosts) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('storeKeep')) return 'Only the storekeeper can raise a requisition.'
      if (r.status !== 'Endorsed') return 'This request is not at the store check.'
      const give = (i: RequestItem) => Math.min(i.qty, stockOf(i.name))
      const left = (i: RequestItem) => i.qty - give(i)
      if (r.items.every((i) => left(i) === 0)) return 'Everything is in the store. Issue it instead.'
      if (full && r.items.some((i, n) => left(i) > 0 && !(unitCosts[n] > 0))) {
        return 'Enter an estimated cost for every item that is short.'
      }
      // What the store has goes out now. Only the rest becomes the requisition.
      const nowItems = r.items.filter((i) => give(i) > 0).map((i) => ({ ...i, qty: give(i) }))
      const remaining = r.items
        .map((i, n) => ({ ...i, qty: left(i), unitCost: full ? Math.round(unitCosts[n] || 0) : 0 }))
        .filter((i) => i.qty > 0)
      const texts: string[] = []
      if (nowItems.length > 0) {
        const slip = makeReceipt('ISSUE', nowItems.map(issueLine), { requestId: r.id, department: r.department })
        setReceipts((rs) => [slip, ...rs])
        takeStock(slip.lines, slip.id)
        const m = makeMoves('Issued', slip.lines, `Part issued to ${r.department} (${r.id})`, {
          requestId: r.id,
          receiptId: slip.id,
          from: 'Store',
          to: r.department,
        })
        setMovements((ms) => [...m, ...ms])
        texts.push(`Part issued from the store to ${r.department}: ${list(nowItems)} (${slip.id})`)
      }
      texts.push(`Not in store (short: ${list(remaining)}). Requisition raised against the ${r.department} budget`)
      change(
        id,
        {
          status: 'Requisition',
          items: remaining,
          issuedEarly: [...(r.issuedEarly ?? []), ...nowItems],
          requisitionAt: new Date().toISOString(),
        },
        texts,
      )
      return null
    },

    approve: (id) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (r.status === 'Requisition') {
        if (!can('approveRequest')) return 'Only the general manager can approve a requisition.'
        if (isOverBudget(r) && !can('approveOverBudget')) {
          change(id, { status: 'Needs finance' }, 'Approved by manager. Over budget, sent to Finance')
        } else {
          change(id, { status: 'Approved' }, isOverBudget(r) ? 'Approved over budget' : 'Approved')
        }
        return null
      }
      if (r.status === 'Needs finance') {
        if (!can('approveOverBudget')) return 'Only Finance or the owner can approve an over-budget requisition.'
        change(id, { status: 'Approved' }, 'Approved over budget by Finance')
        return null
      }
      return 'There is nothing to approve here.'
    },

    purchase: (id, supplier) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('purchase')) return 'Only procurement can raise a purchase order.'
      if (r.status !== 'Approved') return 'This requisition is not approved yet.'
      if (!suppliers.some((s) => s.active && s.name === supplier)) return 'Pick a supplier from the list.'
      const po: PurchaseOrder = {
        id: `PO-${poSeq.current++}`,
        requestId: r.id,
        supplier,
        createdAt: new Date().toISOString(),
        by: who,
        items: r.items,
        total: requestTotal(r),
        status: 'Ordered',
      }
      setOrders((os) => [po, ...os])
      change(id, { status: 'Ordered', poId: po.id }, `${po.id} raised with ${supplier} and bought`)
      return null
    },

    receive: (id, input) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('storeKeep')) return 'Only the storekeeper can receive goods.'
      if (r.status !== 'Ordered') return 'These goods are not on order.'
      const po = orders.find((o) => o.id === r.poId)
      const ordered = po?.items ?? r.items
      // What arrived before, what is still on order, and what arrived now.
      const before = ordered.map((_, n) => po?.got?.[n] ?? 0)
      const left = ordered.map((i, n) => Math.max(0, i.qty - before[n]))
      const got = ordered.map((_, n) => Math.round(input?.got?.[n] ?? left[n]))
      if (got.some((g) => g < 0)) return 'A quantity cannot be negative.'
      const over = ordered.findIndex((_, n) => got[n] > left[n])
      if (over >= 0) return `More ${ordered[over].name} arrived than is still on order (${left[over]}).`

      const arrived = got.reduce((s, g) => s + g, 0)
      const after = ordered.map((_, n) => before[n] + got[n])
      const missing = ordered.map((i, n) => Math.max(0, i.qty - after[n]))
      const short = missing.some((m) => m > 0)
      const closing = short && input?.closeShort !== undefined
      const reason = input?.closeShort?.trim() ?? ''
      if (arrived === 0 && !closing) return 'Enter what arrived.'
      if (closing && !reason) return 'Say why the order is closed short.'
      if (closing && after.every((a) => a === 0)) {
        return 'Nothing has arrived yet, so there is nothing to close short.'
      }

      const rows = ordered
        .map((i, n) => {
          const line: ReceiptLine = {
            name: i.name,
            unit: unitOf(i.name),
            qty: got[n],
            unitCost: i.unitCost || costOf(i.name),
            store: storeStamp(i.name),
            expiry: tracks(i.name) ? input?.expiries?.[n] : undefined,
          }
          return { n, line }
        })
        .filter((x) => x.line.qty > 0)
      // Rule: an item that tracks expiry cannot be received without a date that has not passed.
      const bad = rows
        .map((x) => ({ x, p: tracks(x.line.name) ? expiryProblem(input?.expiries?.[x.n]) : null }))
        .find((y) => y.p)
      if (bad) return `${bad.x.line.name}: ${bad.p}`
      const lines: ReceiptLine[] = rows.map((x) => x.line)

      let slip: Receipt | undefined
      if (lines.length > 0) {
        slip = makeReceipt('GRN', lines, {
          requestId: r.id,
          poId: r.poId,
          supplier: po?.supplier,
          department: r.department,
          reference: input?.reference?.trim() || undefined,
          note: short ? (closing ? 'Part delivery. The order was closed short.' : 'Part delivery. The rest is still on order.') : undefined,
        })
        setReceipts((rs) => (slip ? [slip, ...rs] : rs))
        addStock(lines)
        addBatches(
          slip.id,
          rows.map((x) => ({ line: x.line, expiry: input?.expiries?.[x.n], batchNo: input?.batchNos?.[x.n] })),
        )
        const m = makeMoves(
          'Received',
          lines,
          `Goods received on ${r.poId ?? 'order'}${short && !closing ? ' (part delivery)' : ''}`,
          { requestId: r.id, receiptId: slip.id, from: po?.supplier ?? 'Supplier', to: 'Store' },
        )
        setMovements((ms) => [...m, ...ms])
      }

      const received = ordered.map((i, n) => ({ ...i, qty: after[n] })).filter((i) => i.qty > 0)
      const stillOn = ordered.map((i, n) => ({ name: i.name, qty: missing[n] })).filter((i) => i.qty > 0)
      const status: PurchaseOrder['status'] = short && !closing ? 'Part received' : 'Received'
      const slipId = slip?.id
      setOrders((os) =>
        os.map((o) =>
          o.id === r.poId
            ? {
                ...o,
                status,
                got: after,
                grnId: slipId ?? o.grnId,
                grnIds: slipId ? [...(o.grnIds ?? (o.grnId ? [o.grnId] : [])), slipId] : o.grnIds,
                ...(closing
                  ? {
                      total: received.reduce((s, i) => s + i.qty * i.unitCost, 0),
                      closedShort: { by: who, at: new Date().toISOString(), reason },
                    }
                  : {}),
              }
            : o,
        ),
      )

      const ref = `${r.poId ?? 'no PO'}${slipId ? `, ${slipId}` : ''}`
      if (short && !closing) {
        // Part delivery: the request stays on order for the balance.
        change(id, {}, `Part delivery received (${ref}): ${list(lines)}. Still on order: ${list(stillOn)}`)
        return null
      }
      // Complete, or closed short. A short close counts only what arrived, so the budget shows the real spend.
      const toStore = r.department === STORE_DEPARTMENT
      const final: RequestStatus = toStore ? 'Stocked' : 'Received'
      if (closing) {
        change(
          id,
          { status: final, items: received },
          `Order closed short (${ref}): ${reason}. Received ${list(received)}. Not delivered: ${list(stillOn)}`,
        )
      } else {
        change(
          id,
          { status: final },
          toStore
            ? `Goods received and added to stock (${ref})`
            : `Goods received into the store (${ref})`,
        )
      }
      return null
    },

    markBought: (id, replyText) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('markBought')) return 'You cannot mark requests as bought.'
      if (r.flow !== 'simple' || r.status !== 'Submitted') return 'This request cannot be marked as bought now.'
      change(id, { status: 'Bought' }, 'Bought', replyText)
      return null
    },

    notNow: (id, replyText) => {
      const r = find(id)
      if (!r) return 'Request not found.'
      if (!can('markBought')) return 'You cannot answer requests.'
      if (r.flow !== 'simple' || r.status !== 'Submitted') return 'This request is already closed.'
      change(id, { status: 'Not now' }, 'Not now', replyText)
      return null
    },

    reply: (id, text) => {
      if (!text.trim()) return
      const at = new Date().toISOString()
      setAll((rs) =>
        rs.map((r) => (r.id === id ? { ...r, messages: [...r.messages, { at, by: who, text: text.trim() }] } : r)),
      )
    },

    setBudget: (department, monthly) =>
      setBudgets((bs) => bs.map((b) => (b.id === department ? { ...b, monthly: Math.max(0, monthly) } : b))),

    addSupplier: (name, phone, supplies) => {
      if (!can('purchase') && !can('changeSettings')) return 'You cannot add suppliers.'
      if (!name.trim()) return 'Enter the supplier name.'
      if (suppliers.some((s) => sameName(s.name, name))) return 'This supplier is already on the list.'
      setSuppliers((ss) => [
        ...ss,
        { id: `sup-${Date.now()}`, name: name.trim(), phone: phone.trim(), supplies: supplies.trim(), active: true },
      ])
      return null
    },

    setSupplierActive: (id, active) =>
      setSuppliers((ss) => ss.map((s) => (s.id === id ? { ...s, active } : s))),

    // ---- Stores ----

    addStore: (name) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change the stores.'
      const n = name.trim()
      if (!n) return 'Enter the store name.'
      if (stores.some((s) => sameName(s.name, n))) return 'This store already exists.'
      setStores((ss) => [...ss, { id: `st-${Date.now()}`, name: n }])
      return null
    },

    renameStore: (id, name) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change the stores.'
      const n = name.trim()
      if (!n) return 'Enter the store name.'
      if (stores.some((s) => s.id !== id && sameName(s.name, n))) return 'Another store already has this name.'
      setStores((ss) => ss.map((s) => (s.id === id ? { ...s, name: n } : s)))
      return null
    },

    removeStore: (id) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change the stores.'
      if (id === MAIN_STORE_ID) return 'The main store cannot be removed.'
      if (stock.some((s) => (s.store ?? MAIN_STORE_ID) === id)) return 'Move its items to another store first.'
      setStores((ss) => ss.filter((s) => s.id !== id))
      return null
    },

    // ---- Stock control ----

    addItem: (input) => {
      if (!can('manageStock')) return 'You cannot change the item list.'
      const name = input.name.trim()
      const unit = input.unit.trim()
      if (!name) return 'Enter the item name.'
      if (!unit) return 'Enter the unit, for example piece or box.'
      if (stock.some((s) => sameName(s.name, name))) return 'This item already exists.'
      if (input.store && !stores.some((s) => s.id === input.store)) return 'Pick a store from the list.'
      const opening = Math.max(0, Math.round(input.opening))
      const itemId = `s-${Date.now()}`
      const home = input.store ?? MAIN_STORE_ID
      setStock((ss) => [
        ...ss,
        {
          id: itemId,
          name,
          unit,
          category: input.category,
          store: home,
          onHand: opening,
          reorderAt: input.reorderAt,
          par: input.par,
          unitCost: input.unitCost,
          tracksExpiry: input.tracksExpiry || undefined,
        },
      ])
      logChanges(itemId, name, [
        {
          field: 'Item',
          from: '',
          to: `Created (${unit}, ${input.category}${features.stores ? `, ${storeName(home)}` : ''})`,
        },
      ])
      if (opening > 0) {
        const m = makeMoves('Adjusted', [{ name, unit, qty: opening, unitCost: input.unitCost }], 'Opening balance', {
          from: 'Opening balance',
          to: 'Store',
          store: features.stores ? storeName(home) : undefined,
        })
        setMovements((ms) => [...m, ...ms])
      }
      return null
    },

    updateItem: (id, patch) => {
      if (!can('manageStock')) return 'You cannot change the item list.'
      if (patch.unit !== undefined && !patch.unit.trim()) return 'Enter the unit, for example piece or box.'
      if (patch.store !== undefined && !stores.some((x) => x.id === patch.store)) return 'Pick a store from the list.'
      const s = stock.find((x) => x.id === id)
      if (!s) return 'Item not found.'
      const rows: { field: string; from: string; to: string }[] = []
      if (patch.unit !== undefined && patch.unit !== s.unit) rows.push({ field: 'Unit', from: s.unit, to: patch.unit })
      if (patch.category !== undefined && patch.category !== (s.category ?? 'Other')) {
        rows.push({ field: 'Category', from: s.category ?? 'Other', to: patch.category })
      }
      if (patch.reorderAt !== undefined && patch.reorderAt !== s.reorderAt) {
        rows.push({ field: 'Reorder level', from: String(s.reorderAt), to: String(patch.reorderAt) })
      }
      if (patch.par !== undefined && patch.par !== (s.par ?? 0)) {
        rows.push({ field: 'Par level', from: String(s.par ?? 0), to: String(patch.par) })
      }
      if (patch.unitCost !== undefined && patch.unitCost !== s.unitCost) {
        rows.push({ field: 'Usual cost', from: formatUGX(s.unitCost), to: formatUGX(patch.unitCost) })
      }
      if (patch.store !== undefined && patch.store !== (s.store ?? MAIN_STORE_ID)) {
        rows.push({ field: 'Store', from: storeName(s.store), to: storeName(patch.store) })
      }
      if (patch.tracksExpiry !== undefined && patch.tracksExpiry !== !!s.tracksExpiry) {
        rows.push({
          field: 'Expiry dates',
          from: s.tracksExpiry ? 'Tracked' : 'Not tracked',
          to: patch.tracksExpiry ? 'Tracked' : 'Not tracked',
        })
      }
      setStock((ss) => ss.map((x) => (x.id === id ? { ...x, ...patch } : x)))
      logChanges(id, s.name, rows)
      return null
    },

    recordPurchase: (input): Result<Receipt> => {
      if (!can('purchase') && !can('manageStock')) return fail('You cannot record purchases.')
      if (!input.supplier.trim()) return fail('Enter the supplier.')
      const lines = mergeLines(input.lines.filter((l) => l.name.trim() && l.qty > 0))
      if (lines.length === 0) return fail('Add at least one item with a name and quantity.')
      if (lines.some((l) => !(l.unitCost > 0))) return fail('Enter the cost of every item.')
      // Rule: an item that tracks expiry cannot be received without a date that has not passed.
      const bad = lines.map((l) => ({ l, p: tracks(l.name) ? expiryProblem(l.expiry) : null })).find((y) => y.p)
      if (bad) return fail(`${bad.l.name}: ${bad.p}`)
      const rl: ReceiptLine[] = lines.map((l) => ({
        name: l.name.trim(),
        unit: unitOf(l.name),
        qty: l.qty,
        unitCost: l.unitCost,
        store: storeStamp(l.name),
        expiry: tracks(l.name) ? l.expiry : undefined,
      }))
      const slip = makeReceipt('DIRECT', rl, {
        supplier: input.supplier.trim(),
        reference: input.reference.trim() || undefined,
        note: input.note.trim() || undefined,
      })
      setReceipts((rs) => [slip, ...rs])
      addStock(rl)
      addBatches(
        slip.id,
        lines.map((l, n) => ({ line: rl[n], expiry: l.expiry, batchNo: l.batchNo })),
      )
      const m = makeMoves('Received', rl, 'Direct purchase', {
        receiptId: slip.id,
        from: input.supplier.trim(),
        to: 'Store',
      })
      setMovements((ms) => [...m, ...ms])
      return { ok: true, value: slip }
    },

    issueStock: (input): Result<Receipt> => {
      if (!can('manageStock')) return fail('You cannot issue stock.')
      const lines = mergeLines(input.lines.filter((l) => l.name.trim() && l.qty > 0))
      if (lines.length === 0) return fail('Add at least one item with a name and quantity.')
      for (const l of lines) {
        if (!stock.some((s) => sameName(s.name, l.name))) return fail(`${l.name} is not an item in the store.`)
        if (stockOf(l.name) < l.qty) return fail(`Only ${stockOf(l.name)} × ${l.name} in the store.`)
      }
      const rl: ReceiptLine[] = lines.map((l) => ({
        name: l.name.trim(),
        unit: unitOf(l.name),
        qty: l.qty,
        unitCost: costOf(l.name),
        store: storeStamp(l.name),
      }))
      const slip = makeReceipt('ISSUE', rl, {
        department: input.department,
        note: input.note.trim() || undefined,
      })
      setReceipts((rs) => [slip, ...rs])
      takeStock(rl, slip.id)
      const m = makeMoves('Issued', rl, `Issued to ${input.department}`, {
        receiptId: slip.id,
        from: 'Store',
        to: input.department,
      })
      setMovements((ms) => [...m, ...ms])
      return { ok: true, value: slip }
    },

    // The storekeeper takes stock back at the counter. More than was issued is accepted, but it needs a reason and is flagged.
    returnStock: (input): Result<Receipt> => {
      if (!can('manageStock')) return fail('You cannot record returns.')
      const lines = mergeLines(input.lines.filter((l) => l.name.trim() && l.qty > 0))
      if (lines.length === 0) return fail('Add at least one item with a name and quantity.')
      if (!input.note.trim()) return fail('Say why it is coming back, for example unused or wrong item.')
      for (const l of lines) {
        if (!stock.some((s) => sameName(s.name, l.name))) return fail(`${l.name} is not an item in the store.`)
      }
      const aboveOf = (l: { name: string; qty: number }) => Math.max(0, l.qty - returnable(input.department, l.name))
      const anyAbove = lines.some((l) => aboveOf(l) > 0)
      const aboveReason = (input.aboveReason ?? '').trim()
      if (anyAbove && !aboveReason) {
        return fail('Some of this is more than was issued to the department. Say why, for example "the issue was not recorded".')
      }
      const rl: ReceiptLine[] = lines.map((l) => ({
        name: l.name.trim(),
        unit: unitOf(l.name),
        qty: l.qty,
        unitCost: costOf(l.name),
        store: storeStamp(l.name),
        above: aboveOf(l) || undefined,
      }))
      const aboveText = rl
        .filter((l) => l.above)
        .map((l) => `+${l.above} × ${l.name}`)
        .join(', ')
      const slip = makeReceipt('RETURN', rl, {
        department: input.department,
        note: input.note.trim(),
        handedInBy: input.handedInBy?.trim() || undefined,
        aboveReason: anyAbove ? aboveReason : undefined,
      })
      setReceipts((rs) => [slip, ...rs])
      addStock(rl)
      const m = makeMoves(
        'Received',
        rl,
        `Returned from ${input.department}: ${input.note.trim()}${anyAbove ? ` (above issued ${aboveText}: ${aboveReason})` : ''}`,
        { receiptId: slip.id, from: input.department, to: 'Store' },
      )
      setMovements((ms) => [...m, ...ms])
      return { ok: true, value: slip }
    },

    // A department head says stock is coming back. Rule: no more than is out with the department, less returns already waiting.
    raiseReturn: (input): Result<ReturnRequest> => {
      if (!features.deptReturns) return fail('Department returns are not on your plan.')
      if (!can('returnStock')) return fail('Only a department head can send stock back.')
      const mine = role ? headDepartment[role.id] : undefined
      if (!mine || mine !== input.department) return fail('You can only send back your own department stock.')
      const lines = mergeLines(
        input.lines.filter((l) => l.name.trim() && l.qty > 0).map((l) => ({ name: l.name.trim(), qty: Math.round(l.qty), unitCost: 0 })),
      )
      if (lines.length === 0) return fail('Add at least one item with a quantity.')
      if (!input.note.trim()) return fail('Say why it is going back, for example unused or no longer needed.')
      for (const l of lines) {
        if (!stock.some((s) => sameName(s.name, l.name))) return fail(`${l.name} is not an item in the store.`)
        const free = Math.max(0, returnable(input.department, l.name) - pendingReturnQty(input.department, l.name))
        if (l.qty > free) {
          return fail(`Only ${free} × ${l.name} can still go back (issued to ${input.department}, less returns already made or waiting).`)
        }
      }
      const ret: ReturnRequest = {
        id: `RTQ-${rtqSeq.current++}`,
        department: input.department,
        by: who,
        at: new Date().toISOString(),
        handedInBy: input.handedInBy?.trim() || undefined,
        note: input.note.trim(),
        lines: lines.map((l) => ({ name: l.name, unit: unitOf(l.name), qty: l.qty })),
        status: 'Pending',
      }
      setReturns((rs) => [ret, ...rs])
      return { ok: true, value: ret }
    },

    // The storekeeper counts what really arrived. If it differs from what was declared, a note is required.
    confirmReturn: (id, received, note): Result<Receipt> => {
      if (!can('manageStock')) return fail('You cannot confirm returns.')
      const r = returns.find((x) => x.id === id)
      if (!r || r.status !== 'Pending') return fail('This return has already been dealt with.')
      const got = r.lines.map((l, n) => Math.max(0, Math.round(received[n] ?? l.qty)))
      if (got.every((g) => g === 0)) return fail('Nothing was received. Use Decline instead.')
      const differs = got.some((g, n) => g !== r.lines[n].qty)
      if (differs && !note.trim()) return fail('The count is different from what was declared. Say what happened.')
      const rl: ReceiptLine[] = []
      r.lines.forEach((l, n) => {
        if (got[n] <= 0) return
        const above = Math.max(0, got[n] - returnable(r.department, l.name))
        rl.push({
          name: l.name,
          unit: l.unit,
          qty: got[n],
          unitCost: costOf(l.name),
          store: storeStamp(l.name),
          declared: got[n] !== l.qty ? l.qty : undefined,
          above: above || undefined,
        })
      })
      const slip = makeReceipt('RETURN', rl, {
        department: r.department,
        note: [r.note, note.trim() ? `Storekeeper: ${note.trim()}` : ''].filter(Boolean).join(' · '),
        raisedBy: r.by,
        handedInBy: r.handedInBy,
        returnId: r.id,
        aboveReason: rl.some((l) => l.above) ? note.trim() : undefined,
      })
      setReceipts((rs) => [slip, ...rs])
      addStock(rl)
      const m = makeMoves('Received', rl, `Returned from ${r.department} (${r.id}): ${r.note}`, {
        receiptId: slip.id,
        from: r.department,
        to: 'Store',
      })
      setMovements((ms) => [...m, ...ms])
      setReturns((rs) =>
        rs.map((x) =>
          x.id === id
            ? { ...x, status: 'Confirmed', decidedBy: who, decidedAt: slip.at, received: got, decisionNote: note.trim() || undefined, receiptId: slip.id }
            : x,
        ),
      )
      return { ok: true, value: slip }
    },

    declineReturn: (id, reason) => {
      if (!can('manageStock')) return 'You cannot decline returns.'
      const r = returns.find((x) => x.id === id)
      if (!r || r.status !== 'Pending') return 'This return has already been dealt with.'
      if (!reason.trim()) return 'Say why you are not taking it back.'
      setReturns((rs) =>
        rs.map((x) =>
          x.id === id ? { ...x, status: 'Declined', decidedBy: who, decidedAt: new Date().toISOString(), decisionNote: reason.trim() } : x,
        ),
      )
      return null
    },

    // One click to bring items up to par. A full-chain hotel gets a requisition against the Store budget.
    // A simple hotel gets a request for management to answer.
    topUp: (lines): Result<string> => {
      if (!can('manageStock')) return fail('You cannot raise a top-up.')
      const picked = lines
        .map((l) => ({ item: stock.find((s) => s.id === l.itemId), qty: Math.round(l.qty) }))
        .filter((x) => x.item && x.qty > 0)
      if (picked.length === 0) return fail('Pick at least one item with a quantity.')
      const items: RequestItem[] = picked.map((x) => ({
        name: x.item?.name ?? '',
        qty: x.qty,
        unitCost: x.item?.unitCost ?? 0,
      }))
      const at = new Date().toISOString()
      const id = `SR-${seq.current++}`
      const req: SupplyRequest = {
        id,
        flow,
        department: STORE_DEPARTMENT,
        requester: who,
        createdAt: at,
        urgency: 'Normal',
        reason: 'Reorder: top up to the par level.',
        items,
        status: chain ? 'Requisition' : 'Submitted',
        requisitionAt: chain ? at : undefined,
        history: chain
          ? [
              { at, by: who, text: 'Reorder top-up raised by the store' },
              { at, by: who, text: `Requisition raised against the Store budget: ${list(items)}` },
            ]
          : [{ at, by: who, text: `Reorder top-up raised: ${list(items)}` }],
        messages: [],
      }
      setAll((rs) => [req, ...rs])
      return { ok: true, value: id }
    },

    // ---- Stock count: the general manager counts blind, explains every variance, then posts ----

    startCount: (scope, itemIds): Result<StockCount> => {
      if (!can('countStock')) return fail('Only the general manager or owner can count stock.')
      const items = stock.filter((s) => itemIds.includes(s.id))
      if (items.length === 0) return fail('Pick at least one item to count.')
      const c: StockCount = {
        id: `CNT-${cntSeq.current++}`,
        at: new Date().toISOString(),
        by: who,
        scope,
        status: 'Counting',
        lines: items.map((s) => ({
          itemId: s.id,
          name: s.name,
          unit: s.unit,
          system: s.onHand,
          counted: null,
          unitCost: s.unitCost,
        })),
      }
      setCounts((cs) => [c, ...cs])
      return { ok: true, value: c }
    },

    setCounted: (countId, itemId, counted) => {
      if (!can('countStock')) return
      setCounts((cs) =>
        cs.map((c) =>
          c.id === countId && c.status === 'Counting'
            ? { ...c, lines: c.lines.map((l) => (l.itemId === itemId ? { ...l, counted } : l)) }
            : c,
        ),
      )
    },

    setCountReason: (countId, itemId, reason) => {
      if (!can('countStock')) return
      setCounts((cs) =>
        cs.map((c) =>
          c.id === countId && c.status === 'Waiting approval'
            ? { ...c, lines: c.lines.map((l) => (l.itemId === itemId ? { ...l, reason: reason || undefined } : l)) }
            : c,
        ),
      )
    },

    submitCount: (id) => {
      const c = counts.find((x) => x.id === id)
      if (!c) return 'Count not found.'
      if (!can('countStock')) return 'Only the general manager or owner can count stock.'
      if (c.status !== 'Counting') return 'This count is already submitted.'
      const left = c.lines.filter((l) => l.counted === null).length
      if (left > 0) return `Count every item first (${left} left).`
      setCounts((cs) => cs.map((x) => (x.id === id ? { ...x, status: 'Waiting approval' } : x)))
      return null
    },

    decideCount: (id, approve, note) => {
      const c = counts.find((x) => x.id === id)
      if (!c) return 'Count not found.'
      if (!can('countStock')) return 'Only the general manager or owner can post a count.'
      if (c.status !== 'Waiting approval') return 'Submit the count first.'
      const changed = c.lines.filter((l) => countVariance(l) !== 0)
      if (approve) {
        const missing = changed.filter((l) => !l.reason?.trim())
        if (missing.length > 0) return `Give a reason for every difference (${missing.length} missing).`
        setStock((ss) =>
          ss.map((s) => {
            const l = changed.find((x) => x.itemId === s.id)
            return l ? { ...s, onHand: Math.max(0, s.onHand + countVariance(l)) } : s
          }),
        )
        // A shortage on an item that tracks expiry also comes out of its batches, earliest date first.
        let nb = batches
        for (const l of changed) {
          if (countVariance(l) < 0 && tracks(l.name)) nb = drawFefo(nb, l.name, -countVariance(l), true).next
        }
        setBatches(nb)
        const m = changed.flatMap((l) =>
          makeMoves(
            'Adjusted',
            [{ name: l.name, unit: l.unit, qty: countVariance(l), unitCost: l.unitCost }],
            `Stock count ${id}: ${l.reason}`,
            countVariance(l) > 0
              ? { from: 'Stock count', to: 'Store', approvedBy: who }
              : { from: 'Store', to: 'Count shortage', approvedBy: who },
          ),
        )
        setMovements((ms) => [...m, ...ms])
      }
      setCounts((cs) =>
        cs.map((x) =>
          x.id === id
            ? {
                ...x,
                status: approve ? 'Posted' : 'Rejected',
                decidedBy: who,
                decidedAt: new Date().toISOString(),
                note: note.trim() || undefined,
              }
            : x,
        ),
      )
      return null
    },

    // ---- Write-offs: broken, damaged, expired and lost stock ----

    setLossLimit: (limit) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change the limit.'
      setLossLimitState(Math.max(0, Math.round(limit)))
      return null
    },

    setReversalAlert: (percent) => {
      if (!can('changeSettings')) return 'Only the hotel admin or owner can change this.'
      setReversalAlertState(Math.min(100, Math.max(0, Math.round(percent))))
      return null
    },

    reportLoss: (input): Result<LossReport> => {
      if (!features.lossReports) return fail('Damaged and lost is not switched on for this hotel.')
      if (!can('manageStock')) return fail('You cannot report damaged or lost stock.')
      const item = stock.find((s) => s.id === input.itemId)
      if (!item) return fail('Pick an item.')
      const qty = Math.round(input.qty)
      if (!(qty > 0)) return fail('Enter how many.')
      const waiting = losses
        .filter((l) => l.itemId === item.id && l.status === 'Waiting approval')
        .reduce((s, l) => s + l.qty, 0)
      const available = item.onHand - waiting
      if (qty > available) {
        return fail(
          `Only ${available} ${item.unit} can be written off${waiting > 0 ? ` (${waiting} already waiting approval)` : ''}.`,
        )
      }
      if (!input.note.trim()) return fail('Write what happened.')
      if (NEEDS_PHOTO.includes(input.reason) && !input.evidence) return fail('Attach a photo as evidence.')
      if (input.reason === 'Lost' && !input.lastSeen.trim()) return fail('Say where and when it was last seen.')

      const at = new Date().toISOString()
      const approver = can('approveRequest')
      const draft: LossReport = {
        id: `LOS-${lossSeq.current++}`,
        at,
        by: who,
        itemId: item.id,
        item: item.name,
        unit: item.unit,
        qty,
        unitCost: item.unitCost,
        reason: input.reason,
        note: input.note.trim(),
        lastSeen: input.lastSeen.trim() || undefined,
        evidence: input.evidence,
        status: 'Posted',
      }
      // Rule: above the limit, the general manager decides first. Below it, stock is written off now and reviewed later.
      const hold = lossLimit > 0 && lossValue(draft) > lossLimit && !approver
      const report: LossReport = hold
        ? { ...draft, status: 'Waiting approval' }
        : approver
          ? { ...draft, review: { by: who, at, verdict: 'Reviewed', note: 'Reported by the approver' } }
          : draft
      if (!hold) deductLoss(report, approver ? who : 'Review pending')
      setLosses((ls) => [report, ...ls])
      return { ok: true, value: report }
    },

    decideLoss: (id, approve, note) => {
      const l = losses.find((x) => x.id === id)
      if (!l) return 'Report not found.'
      if (!can('approveRequest')) return 'Only the general manager or owner can decide a write-off.'
      if (l.status !== 'Waiting approval') return 'This report is not waiting for approval.'
      if (!approve && !note.trim()) return 'Give a reason so the storekeeper knows why.'
      const at = new Date().toISOString()
      if (approve) {
        // Counts every unit on hand, including batches past their date, because those are what gets written off.
        const onHand = stock.find((s) => sameName(s.name, l.item))?.onHand ?? 0
        if (onHand < l.qty) return `Only ${onHand} ${l.unit} left in stock, less than this report.`
        deductLoss(l, who)
      }
      setLosses((ls) =>
        ls.map((x) =>
          x.id === id
            ? {
                ...x,
                status: approve ? 'Posted' : 'Rejected',
                decidedBy: who,
                decidedAt: at,
                decisionNote: note.trim() || undefined,
                review: approve ? { by: who, at, verdict: 'Reviewed', note: 'Approved before posting' } : undefined,
              }
            : x,
        ),
      )
      return null
    },

    reviewLoss: (id, verdict, note) => {
      const l = losses.find((x) => x.id === id)
      if (!l) return 'Report not found.'
      if (!can('approveRequest')) return 'Only the general manager or owner can review a write-off.'
      if (l.status !== 'Posted') return 'Only posted write-offs are reviewed.'
      // A dispute can be cleared once the manager has checked. Anything else already reviewed is final.
      const clearing = l.review?.verdict === 'Disputed' && verdict === 'Reviewed'
      if (l.review && !clearing) return 'This report has already been reviewed.'
      if (verdict === 'Disputed' && !note.trim()) return 'Say what looks wrong.'
      if (clearing && !note.trim()) return 'Say why the dispute is cleared.'
      setLosses((ls) =>
        ls.map((x) =>
          x.id === id
            ? {
                ...x,
                earlierReview: clearing ? x.review : x.earlierReview,
                review: { by: who, at: new Date().toISOString(), verdict, note: note.trim() || undefined },
              }
            : x,
        ),
      )
      return null
    },

    reverseLoss: (id, note) => {
      const l = losses.find((x) => x.id === id)
      if (!l) return 'Report not found.'
      if (!features.lossReversal) return 'Reversing a write-off is not switched on for this hotel.'
      if (!can('approveRequest')) return 'Only the general manager or owner can reverse a write-off.'
      if (l.status === 'Reversed') return 'This write-off was already reversed.'
      if (!canReverse(l)) return 'Only a write-off that is waiting for review or disputed can be reversed.'
      if (!note.trim()) return 'Say why you are reversing it.'
      putBack(l)
      setLosses((ls) =>
        ls.map((x) =>
          x.id === id
            ? { ...x, status: 'Reversed', reversal: { by: who, at: new Date().toISOString(), note: note.trim() } }
            : x,
        ),
      )
      return null
    },
  }

  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}