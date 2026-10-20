import { createContext, useContext } from 'react'
import type { Batch } from './batches'
import type { CountClass, CountDue } from './cycleCount'
import type {
  BudgetLine,
  Department,
  ItemChange,
  LossReason,
  LossReport,
  Movement,
  PurchaseOrder,
  Receipt,
  RequestItem,
  ReturnRequest,
  Scope,
  StockCount,
  StockItem,
  Store,
  Supplier,
  SupplyRequest,
  Urgency,
} from './requestsModel'

export interface NewRequest {
  department: Department
  reason: string
  urgency: Urgency
  items: RequestItem[]
}

export interface BudgetStatus {
  monthly: number
  /** Requisitions approved, ordered, received or issued this month. */
  spent: number
  /** Requisitions still waiting for an answer. */
  pending: number
  remaining: number
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface ItemInput {
  name: string
  unit: string
  category: string
  reorderAt: number
  par: number
  unitCost: number
  /** Quantity already on the shelf when the item is added. */
  opening: number
  /** Home store (its id). Only used when the hotel has several stores. */
  store?: string
  /** Track expiry dates for this item. Only used when the hotel has the Batches and expiry switch. */
  tracksExpiry?: boolean
}

export interface EntryLine {
  name: string
  qty: number
  unitCost: number
  /** Goods in only: expiry date (yyyy-mm-dd) of an item that tracks expiry. */
  expiry?: string
  batchNo?: string
}

export interface LossInput {
  itemId: string
  qty: number
  reason: LossReason
  note: string
  /** Required when the reason is Lost. */
  lastSeen: string
  /** Required when the reason is Broken, Damaged or Expired. */
  evidence?: string
}

/** What the storekeeper types when goods arrive against a purchase order. */
export interface ReceiveInput {
  reference?: string
  /** How many of each item arrived now, in the order's item order. Missing means everything still on order. */
  got?: number[]
  /** Close the order with what has arrived. The text is the reason. Only used when something is still missing. */
  closeShort?: string
  /** Expiry date (yyyy-mm-dd) of each item, in the order's item order. Needed for items that track expiry. */
  expiries?: string[]
  /** Supplier batch number of each item, same order. Optional. */
  batchNos?: string[]
}

export interface TopUpLine {
  itemId: string
  qty: number
}

/** A return taken at the store counter by the storekeeper. */
export interface ReturnInput {
  department: Department
  note: string
  lines: EntryLine[]
  /** Who physically handed the stock in. Optional. */
  handedInBy?: string
  /** Required when something comes back above what was issued to the department. */
  aboveReason?: string
}

/** A department head sends stock back. The storekeeper confirms what arrives. */
export interface DeptReturnInput {
  department: Department
  note: string
  lines: { name: string; qty: number }[]
  /** Who physically hands it in, for example an attendant. Optional. */
  handedInBy?: string
}

export interface RequestsValue {
  /** Only the requests of the way this hotel works: simple, or the full chain. */
  requests: SupplyRequest[]
  budgets: BudgetLine[]
  stock: StockItem[]
  movements: Movement[]
  orders: PurchaseOrder[]
  suppliers: Supplier[]
  receipts: Receipt[]
  counts: StockCount[]
  /** Write-offs: broken, damaged, expired and lost stock. */
  losses: LossReport[]
  /** A single write-off above this value waits for the general manager. 0 means never wait. */
  lossLimit: number
  /** The owner is flagged when more than this share (%) of the month's write-offs were reversed. 0 means off. */
  reversalAlert: number
  /** Changes made to item details: who changed what, and when. */
  itemLog: ItemChange[]
  /** The hotel's stores. Only shown when the Several stores switch is on. */
  stores: Store[]
  /** Returns raised by department heads, newest first. */
  returns: ReturnRequest[]
  /** Deliveries of items that track expiry. A batch with qty 0 is used up. */
  batches: Batch[]
  /** True when the hotel has the Batches and expiry switch and this item is set to track expiry. */
  tracksExpiry: (name: string) => boolean
  /** Days before its date that a batch counts as "expiring soon". */
  expiryWarn: number
  setExpiryWarn: (days: number) => string | null
  /** Days between cycle counts for each class (A, B, C). */
  countDays: Record<CountClass, number>
  setCountDays: (cls: CountClass, days: number) => string | null
  /** Items whose cycle count is due, class A first. */
  countsDue: CountDue[]
  /** Name of a store from its id. No id means the main store. */
  storeName: (id?: string) => string
  /** How many requests in the store's, purchasing's or Finance's workload are waiting for the signed-in role. */
  waitingIn: (scope: Scope) => number
  needsMe: (r: SupplyRequest) => boolean
  budgetStatus: (department: string, excludeId?: string) => BudgetStatus
  /** Rule: the requisition is more than what is left of its department budget. Only checked when budget approval is on. */
  isOverBudget: (r: SupplyRequest) => boolean
  /** What can be issued now: on hand, less any batch past its expiry date. */
  stockOf: (name: string) => number
  /** How much of an item is already being bought or still to arrive. */
  onOrderOf: (name: string) => number
  /** How much of an item a department can still send back: issued to it, less what it already returned. */
  returnable: (department: string, name: string) => number
  /** How much of an item a department has already promised in returns the storekeeper has not confirmed yet. */
  pendingReturnQty: (department: string, name: string) => number
  raise: (input: NewRequest) => string
  /** Each action returns an error message, or null when it worked. */
  endorse: (id: string) => string | null
  reject: (id: string, reason: string) => string | null
  issue: (id: string) => string | null
  /** Issues what the store has and raises the requisition for the rest. unitCosts lines up with the request's items. */
  requisition: (id: string, unitCosts: number[]) => string | null
  approve: (id: string) => string | null
  /** unitCosts (optional, in the request's item order): the prices a supplier quoted, from an awarded RFQ. */
  purchase: (id: string, supplier: string, unitCosts?: number[]) => string | null
  /** Goods arrive. A short delivery keeps the balance on the order, or closes it short with a reason. */
  receive: (id: string, input?: ReceiveInput) => string | null
  markBought: (id: string, reply?: string) => string | null
  notNow: (id: string, reply?: string) => string | null
  reply: (id: string, text: string) => void
  setBudget: (department: string, monthly: number) => void
  addSupplier: (name: string, phone: string, supplies: string) => string | null
  setSupplierActive: (id: string, active: boolean) => void
  // POS: deduct ingredient or packaged-item quantities from shared stock and record movements.
  consumeStockForSale: (lines: { name: string; qty: number }[], saleId: string, outlet: string, deductionRef?: string) => Result<Movement[]>
  // Stock control
  addItem: (input: ItemInput) => string | null
  updateItem: (
    id: string,
    patch: Partial<Pick<StockItem, 'unit' | 'category' | 'reorderAt' | 'par' | 'unitCost' | 'store' | 'tracksExpiry'>>,
  ) => string | null
  addStore: (name: string) => string | null
  renameStore: (id: string, name: string) => string | null
  removeStore: (id: string) => string | null
  recordPurchase: (input: { supplier: string; reference: string; note: string; lines: EntryLine[] }) => Result<Receipt>
  issueStock: (input: { department: Department; note: string; lines: EntryLine[] }) => Result<Receipt>
  /** The storekeeper takes stock back at the counter. More than was issued is accepted with a reason, and flagged. */
  returnStock: (input: ReturnInput) => Result<Receipt>
  /** A department head says stock is coming back. Nothing moves until the storekeeper confirms. */
  raiseReturn: (input: DeptReturnInput) => Result<ReturnRequest>
  /** The storekeeper counts what arrived. A different count needs a note. Makes the return note and puts the stock back. */
  confirmReturn: (id: string, received: number[], note: string) => Result<Receipt>
  declineReturn: (id: string, reason: string) => string | null
  /** One click: a requisition (or a simple request) to bring the chosen items up to par. Returns the request ID. */
  topUp: (lines: TopUpLine[]) => Result<string>
  // Stock count: the general manager counts blind, gives a reason for every variance, then posts.
  startCount: (scope: string, itemIds: string[]) => Result<StockCount>
  setCounted: (countId: string, itemId: string, counted: number | null) => void
  setCountReason: (countId: string, itemId: string, reason: string) => void
  submitCount: (id: string) => string | null
  /** approve = post the count and adjust stock. Otherwise the count is discarded. */
  decideCount: (id: string, approve: boolean, note: string) => string | null
  // Write-offs
  setLossLimit: (limit: number) => string | null
  setReversalAlert: (percent: number) => string | null
  reportLoss: (input: LossInput) => Result<LossReport>
  decideLoss: (id: string, approve: boolean, note: string) => string | null
  /** Reviewed accepts a posted write-off. Disputed flags it (stock stays written off). A dispute can later be cleared with Reviewed. */
  reviewLoss: (id: string, verdict: 'Reviewed' | 'Disputed', note: string) => string | null
  /** Puts the quantity back into stock. Final: the report cannot be reviewed or reversed again. */
  reverseLoss: (id: string, note: string) => string | null
}

export const RequestsContext = createContext<RequestsValue | null>(null)

export function useRequests(): RequestsValue {
  const v = useContext(RequestsContext)
  if (!v) throw new Error('useRequests must be used inside RequestsProvider')
  return v
}