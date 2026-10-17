import type { RoleId } from '../../lib/roles'

/** The departments staff can pick when they ask for supplies. */
export const departments = ['Housekeeping', 'Maintenance', 'Front desk', 'Kitchen', 'Bar', 'Admin'] as const
/** The store itself. Reorder top-ups are charged to its own budget line, not to a department. */
export const STORE_DEPARTMENT = 'Store'
export type Department = (typeof departments)[number] | typeof STORE_DEPARTMENT

export const urgencies = ['Normal', 'Urgent'] as const
export type Urgency = (typeof urgencies)[number]

/** simple: Starter hotels (ask, then Bought or Not now). chain: the full supply chain. */
export type Flow = 'simple' | 'chain'

export type RequestStatus =
  // simple
  | 'Submitted'
  | 'Bought'
  | 'Not now'
  // chain
  | 'With head'
  | 'Endorsed'
  | 'Requisition'
  | 'Needs finance'
  | 'Approved'
  | 'Ordered'
  | 'Received'
  | 'Issued'
  | 'Stocked'
  | 'Rejected'

export interface RequestItem {
  name: string
  qty: number
  /** Estimated cost of one, in UGX. Set by the storekeeper when a requisition is raised. 0 until then. */
  unitCost: number
}

export interface LogEntry {
  at: string
  by: string
  text: string
}

export interface SupplyRequest {
  id: string
  flow: Flow
  department: Department
  requester: string
  createdAt: string
  urgency: Urgency
  reason: string
  items: RequestItem[]
  status: RequestStatus
  /** Set when the store could not supply it and a requisition was raised against the department budget. */
  requisitionAt?: string
  poId?: string
  /** Part of the request the store could give straight away. The rest became the requisition. */
  issuedEarly?: RequestItem[]
  /** Who did what and when. The request ID ties every entry together. */
  history: LogEntry[]
  /** Questions and replies. */
  messages: LogEntry[]
}

export interface BudgetLine {
  /** Same as the department name. */
  id: string
  name: string
  /** Monthly amount in UGX. */
  monthly: number
}

export interface StockItem {
  id: string
  name: string
  unit: string
  onHand: number
  reorderAt: number
  /** Usual price of one, in UGX. */
  unitCost: number
  /** Level to top up to. */
  par?: number
  category?: string
  /** Home store (its id). Missing means the main store. */
  store?: string
    /** Expiry dates are tracked for this item (food, chemicals). Needs the Batches and expiry switch. */
  tracksExpiry?: boolean
}

export interface Movement {
  id: string
  at: string
  by: string
  kind: 'Issued' | 'Received' | 'Adjusted'
  item: string
  /** Positive for Issued and Received. Adjusted can be negative (a count found less). */
  qty: number
  /** Worth of one, in UGX. */
  cost?: number
  reason?: string
  requestId?: string
  receiptId?: string
  /** Where the stock came from, for example a supplier or the store. */
  from?: string
  /** Where it went, for example a department or Written off. */
  to?: string
  /** Who approved it, where approval applies. */
  approvedBy?: string
  /** The write-off this movement belongs to. Its approval text follows the write-off's current status. */
  lossId?: string
  /** Store name when the movement was made. Only set when the hotel uses several stores. */
  store?: string
  /** Which batches an issue or write-off took from, for example "2 from FC-0412 (exp 5 Nov 2026)". */
  batch?: string
}

/** One change to an item's details (cost, reorder level and so on). */
export interface ItemChange {
  id: string
  at: string
  by: string
  itemId: string
  item: string
  field: string
  from: string
  to: string
}

export interface PurchaseOrder {
  id: string
  requestId: string
  supplier: string
  createdAt: string
  by: string
  items: RequestItem[]
  total: number
  status: 'Ordered' | 'Part received' | 'Received'
  /** The latest goods received note. */
  grnId?: string
  /** Every goods received note, in order. A part delivery gets its own. */
  grnIds?: string[]
  /** How many of each item have arrived so far, in the same order as items. */
  got?: number[]
  /** Set when the order was closed with part of it never delivered. */
  closedShort?: { by: string; at: string; reason: string }
}

export const STOCK_CATEGORIES = ['Cleaning', 'Linen', 'Amenities', 'Maintenance', 'Paper', 'Kitchen', 'Other']

export interface Store {
  id: string
  name: string
}

/** Every item without a store belongs here. */
export const MAIN_STORE_ID = 'main'

export const SAMPLE_STORES: Store[] = [
  { id: 'main', name: 'Main store' },
  { id: 'housekeeping', name: 'Housekeeping store' },
  { id: 'engineering', name: 'Engineering store' },
  { id: 'kitchen', name: 'Kitchen store' },
  { id: 'bar', name: 'Bar store' },
]
export type ReceiptKind = 'GRN' | 'DIRECT' | 'ISSUE' | 'RETURN'

export interface ReceiptLine {
  name: string
  unit: string
  qty: number
  unitCost: number
  /** Store name when the note was made. Only set when the hotel uses several stores. */
  store?: string
  /** Returns only: what the department said it was sending, when the storekeeper counted something different. */
  declared?: number
  /** Returns only: how many were above what was issued to the department and not yet returned. */
  above?: number
  /** Goods in: the expiry date of this delivery (yyyy-mm-dd). */
  expiry?: string
  /** Goods out: which batches it was taken from. */
  batches?: string
}
export interface Receipt {
  id: string
  kind: ReceiptKind
  at: string
  by: string
  lines: ReceiptLine[]
  requestId?: string
  poId?: string
  supplier?: string
  department?: Department
  /** Delivery note, supplier receipt or invoice number. */
  reference?: string
  note?: string
  /** Returns only: the department head who raised it, and who physically handed the stock in. */
  raisedBy?: string
  handedInBy?: string
  /** The department return this note closed. */
  returnId?: string
  /** Returns only: why more came back than was issued. */
  aboveReason?: string
}

export const receiptTitle: Record<ReceiptKind, string> = {
  GRN: 'Goods received note',
  DIRECT: 'Direct purchase receipt',
  ISSUE: 'Store issue note',
  RETURN: 'Store return note',
}

export const receiptTotal = (r: Pick<Receipt, 'lines'>) => r.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)

export type ReturnStatus = 'Pending' | 'Confirmed' | 'Declined'

export interface ReturnLine {
  name: string
  unit: string
  /** What the department head says is coming back. */
  qty: number
}

/** A department head sends stock back. Stock only moves when the storekeeper confirms what actually arrived. */
export interface ReturnRequest {
  id: string
  department: Department
  /** The department head who raised it. */
  by: string
  at: string
  /** Who physically handed it in, for example an attendant. Optional. */
  handedInBy?: string
  note: string
  lines: ReturnLine[]
  status: ReturnStatus
  decidedBy?: string
  decidedAt?: string
  /** What the storekeeper counted, in the same order as lines. */
  received?: number[]
  /** Why the count differs, or why it was declined. */
  decisionNote?: string
  /** The return note made when it was confirmed. */
  receiptId?: string
}
export interface CountLine {
  itemId: string
  name: string
  unit: string
  /** What the system said when the count started. Hidden from the counter. */
  system: number
  counted: number | null
  unitCost: number
  /** Why the counted quantity differs from the book quantity. Required before posting. */
  reason?: string
}

export type CountStatus = 'Counting' | 'Waiting approval' | 'Posted' | 'Rejected'

export interface StockCount {
  id: string
  at: string
  by: string
  scope: string
  status: CountStatus
  lines: CountLine[]
  decidedBy?: string
  decidedAt?: string
  note?: string
}

export const countVariance = (l: CountLine) => (l.counted ?? l.system) - l.system
export const countValue = (c: Pick<StockCount, 'lines'>) =>
  c.lines.reduce((s, l) => s + countVariance(l) * l.unitCost, 0)

export const COUNT_REASONS = [
  'Unrecorded issue',
  'Receiving error',
  'Spoilage / wastage',
  'Pilferage (suspected)',
  'Other',
]

export const LOSS_REASONS = ['Broken', 'Damaged', 'Expired', 'Lost', 'Other'] as const
export type LossReason = (typeof LOSS_REASONS)[number]
/** Reasons that must come with a photo. Lost items need where and when they were last seen instead. */
export const NEEDS_PHOTO: LossReason[] = ['Broken', 'Damaged', 'Expired']

export type LossStatus = 'Posted' | 'Waiting approval' | 'Rejected' | 'Reversed'

export interface LossReview {
  by: string
  at: string
  verdict: 'Reviewed' | 'Disputed'
  note?: string
}

/** The manager put the stock back. Final: a reversed write-off is not reviewed or reversed again. */
export interface LossReversal {
  by: string
  at: string
  note: string
}

/** A write-off: stock that is broken, damaged, expired or lost. */
export interface LossReport {
  id: string
  at: string
  by: string
  itemId: string
  item: string
  unit: string
  qty: number
  unitCost: number
  reason: LossReason
  note: string
  /** For lost items: where and when it was last seen. */
  lastSeen?: string
  /** Photo as a data URL (sample storage; the real system uploads files). */
  evidence?: string
  status: LossStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  review?: LossReview
  /** Kept when a dispute is later cleared, so the trail still shows it. */
  earlierReview?: LossReview
  reversal?: LossReversal
}

/** A single write-off above this value waits for the general manager. 0 means never wait. */
export const DEFAULT_LOSS_LIMIT = 200_000

/** The owner is flagged when more than this share (%) of the month's write-offs were reversed. 0 turns the flag off. */
export const DEFAULT_REVERSAL_ALERT = 20
/** The flag only shows once the month has at least this many write-offs, so two reports do not make 50%. */
export const REVERSAL_MIN_SAMPLE = 5
/** A dispute still open after this many days is counted as stale. */
export const DISPUTE_STALE_DAYS = 7

export const lossValue = (l: Pick<LossReport, 'qty' | 'unitCost'>) => l.qty * l.unitCost

/** Reversible while it is under review or disputed. A reviewed, rejected or already reversed report is final. */
export const canReverse = (l: Pick<LossReport, 'status' | 'review'>) =>
  l.status === 'Posted' && (!l.review || l.review.verdict === 'Disputed')

/** Where a write-off stands now, in words for a movement line. */
export function lossApproval(l: LossReport): string {
  if (l.status === 'Reversed') return `Reversed by ${l.reversal?.by ?? 'manager'}`
  if (l.review?.verdict === 'Disputed') return `Disputed by ${l.review.by}`
  if (l.decidedBy) return `Approved by ${l.decidedBy}`
  if (l.review) return `Reviewed by ${l.review.by}`
  return 'Review pending'
}

/** Approval text for a movement. Write-off movements follow the write-off; others keep what was stored. */
export const movementApproval = (m: Pick<Movement, 'lossId' | 'approvedBy'>, losses: LossReport[]) => {
  const l = m.lossId ? losses.find((x) => x.id === m.lossId) : undefined
  return l ? lossApproval(l) : m.approvedBy
}

export interface Supplier {
  id: string
  name: string
  phone: string
  supplies: string
  active: boolean
}

export const SAMPLE_SUPPLIERS: Supplier[] = [
  { id: 'sup1', name: 'Kampala Cleaning Supplies', phone: '0700 000 101', supplies: 'Cleaning chemicals, mops, brushes', active: true },
  { id: 'sup2', name: 'Mukwano Wholesale', phone: '0700 000 102', supplies: 'Soap, toiletries, paper goods', active: true },
  { id: 'sup3', name: 'Nile Linen House', phone: '0700 000 103', supplies: 'Sheets, towels, linen', active: true },
  { id: 'sup4', name: 'Local market', phone: '', supplies: 'Small urgent items', active: true },
]
/** Which department a head can endorse. The general manager can endorse any. */
export const headDepartment: Partial<Record<RoleId, Department>> = {
  hkhead: 'Housekeeping',
  maintenance: 'Maintenance',
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Two rows with the same item become one row. */
export function mergeItems(items: RequestItem[]): RequestItem[] {
  const out: RequestItem[] = []
  for (const i of items) {
    const hit = out.find((o) => sameName(o.name, i.name))
    if (hit) hit.qty += i.qty
    else out.push({ ...i })
  }
  return out
}

export const requestTotal = (r: Pick<SupplyRequest, 'items'>) =>
  r.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0)

export const isClosed = (s: RequestStatus) =>
  s === 'Issued' || s === 'Stocked' || s === 'Rejected' || s === 'Bought' || s === 'Not now'

export type Scope = 'store' | 'purchasing' | 'finance'
const STORE_STATUSES: RequestStatus[] = ['Endorsed', 'Ordered', 'Received', 'Issued', 'Stocked']
const PURCHASING_STATUSES: RequestStatus[] = ['Requisition', 'Needs finance', 'Approved', 'Ordered', 'Rejected']

/** Whose workload a request is: the store's (Inventory), purchasing's (Procurement) or Finance's (any requisition that went against a budget). */
export const inScope = (r: Pick<SupplyRequest, 'flow' | 'status' | 'requisitionAt'>, scope: Scope) => {
  if (r.flow === 'simple') return scope === 'purchasing'
  if (scope === 'finance') return !!r.requisitionAt
  return (scope === 'store' ? STORE_STATUSES : PURCHASING_STATUSES).includes(r.status)
}

/** Requisitions in these states count against the department budget as spent. */
export const SPENT: RequestStatus[] = ['Approved', 'Ordered', 'Received', 'Issued', 'Stocked']
/** ...and in these as waiting. */
export const PENDING: RequestStatus[] = ['Requisition', 'Needs finance']
/** Requests that are waiting to be bought or delivered. */
export const BUYING: RequestStatus[] = ['Requisition', 'Needs finance', 'Approved', 'Ordered']

export const formatUGX = (n: number) => `UGX ${n.toLocaleString('en-US')}`

export const statusLabel = (s: RequestStatus): string =>
  ({
    Submitted: 'Submitted',
    Bought: 'Bought',
    'Not now': 'Not now',
    'With head': 'Waiting for head',
    Endorsed: 'Endorsed: at the store',
    Requisition: 'Requisition',
    'Needs finance': 'Needs finance',
    Approved: 'Ready for purchase order',
    Ordered: 'Ordered',
    Received: 'In store: to issue',
    Issued: 'Issued',
    Stocked: 'Added to stock',
    Rejected: 'Rejected',
  })[s]

export const statusStyles: Record<RequestStatus, string> = {
  Submitted: 'bg-warn/15 text-warn',
  'With head': 'bg-warn/15 text-warn',
  Requisition: 'bg-warn/15 text-warn',
  'Needs finance': 'bg-warn/15 text-warn',
  Endorsed: 'bg-brand/10 text-brand',
  Approved: 'bg-brand/10 text-brand',
  Ordered: 'bg-brand/10 text-brand',
  Received: 'bg-brand/10 text-brand',
  Issued: 'bg-good/15 text-good',
  Stocked: 'bg-good/15 text-good',
  Bought: 'bg-good/15 text-good',
  Rejected: 'bg-bad/15 text-bad',
  'Not now': 'bg-ink/10 text-ink/70',
}

export const waitingOn: Partial<Record<RequestStatus, string>> = {
  Submitted: 'Waiting for management to reply.',
  'With head': 'Waiting for the department head to endorse.',
  Endorsed: 'Waiting for the storekeeper to check the store.',
  Requisition: 'Waiting for the general manager to approve the requisition.',
  'Needs finance': 'Over budget. Waiting for Finance to approve.',
  Approved: 'Waiting for procurement to raise the purchase order and buy.',
  Ordered: 'Waiting for the goods to arrive at the store.',
  Received: 'In the store. Waiting for the storekeeper to issue it.',
}

export const SAMPLE_BUDGETS: BudgetLine[] = [
  { id: 'Housekeeping', name: 'Housekeeping', monthly: 1_500_000 },
  { id: 'Maintenance', name: 'Maintenance', monthly: 2_000_000 },
  { id: 'Front desk', name: 'Front desk', monthly: 500_000 },
  { id: 'Kitchen', name: 'Kitchen', monthly: 1_000_000 },
  { id: 'Bar', name: 'Bar', monthly: 750_000 },
  { id: 'Admin', name: 'Admin', monthly: 500_000 },
  { id: 'Store', name: 'Store', monthly: 1_500_000 },
]

export const SAMPLE_STOCK: StockItem[] = [
  { id: 's1', name: 'Floor cleaner (5L)', unit: 'bottle', category: 'Cleaning', store: 'housekeeping', onHand: 2, reorderAt: 4, par: 12, unitCost: 45_000, tracksExpiry: true },  { id: 's2', name: 'Mop heads', unit: 'piece', category: 'Cleaning', store: 'housekeeping', onHand: 4, reorderAt: 6, par: 20, unitCost: 12_000 },
  { id: 's3', name: 'Toilet brush', unit: 'piece', category: 'Cleaning', store: 'housekeeping', onHand: 12, reorderAt: 5, par: 20, unitCost: 8_000 },
  { id: 's4', name: 'Hand towels', unit: 'piece', category: 'Linen', store: 'housekeeping', onHand: 6, reorderAt: 20, par: 60, unitCost: 15_000 },
  { id: 's5', name: 'Guest soap box (100)', unit: 'box', category: 'Amenities', store: 'main', onHand: 1, reorderAt: 2, par: 6, unitCost: 80_000, tracksExpiry: true },  { id: 's6', name: 'Bed sheet (queen)', unit: 'piece', category: 'Linen', store: 'housekeeping', onHand: 14, reorderAt: 20, par: 60, unitCost: 65_000 },
  { id: 's7', name: 'Basin mixer tap', unit: 'piece', category: 'Maintenance', store: 'engineering', onHand: 0, reorderAt: 2, par: 8, unitCost: 350_000 },
  { id: 's8', name: 'Light bulb (LED)', unit: 'piece', category: 'Maintenance', store: 'engineering', onHand: 40, reorderAt: 20, par: 80, unitCost: 6_000 },
  { id: 's9', name: 'Toilet paper (case)', unit: 'case', category: 'Paper', store: 'main', onHand: 9, reorderAt: 6, par: 24, unitCost: 70_000 },
  // Food & beverage opening balances for a fresh demo install. Unit costs are UGX per stock unit.
  { id: 'fnb-chicken', name: 'Chicken breast', unit: 'g', category: 'Food', store: 'kitchen', onHand: 12000, reorderAt: 4000, par: 20000, unitCost: 18, tracksExpiry: true },
  { id: 'fnb-potato', name: 'Potatoes', unit: 'g', category: 'Food', store: 'kitchen', onHand: 18000, reorderAt: 5000, par: 25000, unitCost: 3.5, tracksExpiry: true },
  { id: 'fnb-beef', name: 'Beef mince', unit: 'g', category: 'Food', store: 'kitchen', onHand: 8000, reorderAt: 2500, par: 14000, unitCost: 24, tracksExpiry: true },
  { id: 'fnb-bun', name: 'Burger bun', unit: 'piece', category: 'Food', store: 'kitchen', onHand: 40, reorderAt: 12, par: 60, unitCost: 1200, tracksExpiry: true },
  { id: 'fnb-fish', name: 'Fish fillet', unit: 'g', category: 'Food', store: 'kitchen', onHand: 6000, reorderAt: 1800, par: 10000, unitCost: 28, tracksExpiry: true },
  { id: 'fnb-rice', name: 'Rice', unit: 'g', category: 'Food', store: 'kitchen', onHand: 15000, reorderAt: 5000, par: 25000, unitCost: 4.5 },
  { id: 'fnb-vegetables', name: 'Mixed vegetables', unit: 'g', category: 'Food', store: 'kitchen', onHand: 5000, reorderAt: 1800, par: 9000, unitCost: 8, tracksExpiry: true },
  { id: 'fnb-lettuce', name: 'Lettuce', unit: 'g', category: 'Food', store: 'kitchen', onHand: 2500, reorderAt: 800, par: 5000, unitCost: 12, tracksExpiry: true },
  { id: 'fnb-tomato', name: 'Tomatoes', unit: 'g', category: 'Food', store: 'kitchen', onHand: 4000, reorderAt: 1200, par: 7000, unitCost: 7, tracksExpiry: true },
  { id: 'fnb-cucumber', name: 'Cucumber', unit: 'g', category: 'Food', store: 'kitchen', onHand: 2000, reorderAt: 600, par: 4000, unitCost: 6, tracksExpiry: true },
  { id: 'fnb-oil', name: 'Cooking oil', unit: 'ml', category: 'Food', store: 'kitchen', onHand: 10000, reorderAt: 2500, par: 15000, unitCost: 8 },
  { id: 'fnb-salt', name: 'Salt', unit: 'g', category: 'Food', store: 'kitchen', onHand: 2000, reorderAt: 500, par: 4000, unitCost: 2 },
  { id: 'fnb-lemon', name: 'Lemon', unit: 'piece', category: 'Food', store: 'kitchen', onHand: 60, reorderAt: 15, par: 100, unitCost: 500, tracksExpiry: true },
  { id: 'fnb-orange', name: 'Orange', unit: 'piece', category: 'Food', store: 'kitchen', onHand: 90, reorderAt: 24, par: 140, unitCost: 600, tracksExpiry: true },
  { id: 'fnb-juice-base', name: 'Juice base', unit: 'ml', category: 'Beverage', store: 'bar', onHand: 5000, reorderAt: 1200, par: 8000, unitCost: 6, tracksExpiry: true },
  { id: 'fnb-syrup', name: 'Mocktail syrup', unit: 'ml', category: 'Beverage', store: 'bar', onHand: 3000, reorderAt: 800, par: 5000, unitCost: 10 },
  { id: 'fnb-coffee', name: 'Coffee beans', unit: 'g', category: 'Beverage', store: 'kitchen', onHand: 2000, reorderAt: 500, par: 3500, unitCost: 35 },
  { id: 'fnb-milk', name: 'Milk', unit: 'ml', category: 'Beverage', store: 'kitchen', onHand: 5000, reorderAt: 1500, par: 8000, unitCost: 5, tracksExpiry: true },
  { id: 'fnb-soda', name: 'Soda bottle', unit: 'bottle', category: 'Beverage', store: 'bar', onHand: 48, reorderAt: 12, par: 72, unitCost: 1800 },
  { id: 'fnb-water', name: 'Mineral water bottle', unit: 'bottle', category: 'Beverage', store: 'bar', onHand: 60, reorderAt: 15, par: 90, unitCost: 900 },
  { id: 'fnb-beer', name: 'House beer bottle', unit: 'bottle', category: 'Beverage', store: 'bar', onHand: 36, reorderAt: 12, par: 60, unitCost: 3500 },
  { id: 'fnb-wine', name: 'House wine', unit: 'ml', category: 'Beverage', store: 'bar', onHand: 3000, reorderAt: 750, par: 5000, unitCost: 20 },
]

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const log = (minutesAgo: number, by: string, text: string): LogEntry => ({ at: iso(minutesAgo), by, text })

export const SAMPLE_MOVEMENTS: Movement[] = [
  {
    id: 'MV-1', at: iso(4900), by: 'Peter Mugisha', kind: 'Issued', item: 'Mop heads', qty: 3, cost: 12_000,
    reason: 'Issued to Housekeeping (SR-1007)', requestId: 'SR-1007', receiptId: 'ISS-5000',
  },
  {
    id: 'MV-2', at: iso(6000), by: 'Grace Namatovu', kind: 'Received', item: 'Light bulb (LED)', qty: 10, cost: 6_000,
    reason: 'Direct purchase', receiptId: 'PUR-4000',
  },
]

export const SAMPLE_RECEIPTS: Receipt[] = [
  {
    id: 'ISS-5000', kind: 'ISSUE', at: iso(4900), by: 'Peter Mugisha',
    lines: [{ name: 'Mop heads', unit: 'piece', qty: 3, unitCost: 12_000 }],
    requestId: 'SR-1007', department: 'Housekeeping',
  },
  {
    id: 'PUR-4000', kind: 'DIRECT', at: iso(6000), by: 'Grace Namatovu',
    lines: [{ name: 'Light bulb (LED)', unit: 'piece', qty: 10, unitCost: 6_000 }],
    supplier: 'Local market', reference: 'Cash sale 2217', note: 'Urgent: corridor lights were out.',
  },
]

export const SAMPLE_ORDERS: PurchaseOrder[] = [
  {
    id: 'PO-2001',
    requestId: 'SR-1006',
    supplier: 'Nile Linen House',
    createdAt: iso(3800),
    by: 'Grace Namatovu',
    items: [{ name: 'Bed sheet (queen)', qty: 12, unitCost: 65_000 }],
    total: 780_000,
    status: 'Ordered',
  },
]

export const SAMPLE_REQUESTS: SupplyRequest[] = [
  // Full chain (Standard and Large hotels)
  {
    id: 'SR-1001',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Sarah Nanteza',
    createdAt: iso(90),
    urgency: 'Normal',
    reason: 'Worn out in rooms 201 to 205.',
    items: [{ name: 'Hand towels', qty: 10, unitCost: 0 }],
    status: 'With head',
    history: [log(90, 'Sarah Nanteza', 'Raised')],
    messages: [],
  },
  {
    id: 'SR-1002',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Mary Nabirye',
    createdAt: iso(300),
    urgency: 'Urgent',
    reason: 'Floor cleaner and mop heads are nearly finished.',
    items: [
      { name: 'Floor cleaner (5L)', qty: 6, unitCost: 0 },
      { name: 'Mop heads', qty: 10, unitCost: 0 },
    ],
    status: 'Endorsed',
    history: [
      log(300, 'Mary Nabirye', 'Raised'),
      log(300, 'Mary Nabirye', 'Endorsement not needed (raised by Housekeeping head)'),
    ],
    messages: [],
  },
  {
    id: 'SR-1003',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Sarah Nanteza',
    createdAt: iso(240),
    urgency: 'Normal',
    reason: 'Two brushes are broken.',
    items: [{ name: 'Toilet brush', qty: 2, unitCost: 0 }],
    status: 'Endorsed',
    history: [log(240, 'Sarah Nanteza', 'Raised'), log(200, 'Mary Nabirye', 'Endorsed by department head')],
    messages: [],
  },
  {
    id: 'SR-1004',
    flow: 'chain',
    department: 'Maintenance',
    requester: 'Joseph Okia',
    createdAt: iso(900),
    urgency: 'Normal',
    reason: 'Replace worn taps in the east wing.',
    items: [{ name: 'Basin mixer tap', qty: 8, unitCost: 350_000 }],
    status: 'Requisition',
    requisitionAt: iso(800),
    history: [
      log(900, 'Joseph Okia', 'Raised'),
      log(900, 'Joseph Okia', 'Endorsement not needed (raised by Maintenance)'),
      log(800, 'Peter Mugisha', 'Not in store (short: 8 × Basin mixer tap). Requisition raised against the Maintenance budget'),
    ],
    messages: [],
  },
  {
    id: 'SR-1005',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Mary Nabirye',
    createdAt: iso(2000),
    urgency: 'Normal',
    reason: 'Guest soap for next week.',
    items: [{ name: 'Guest soap box (100)', qty: 4, unitCost: 80_000 }],
    status: 'Approved',
    requisitionAt: iso(1900),
    history: [
      log(2000, 'Mary Nabirye', 'Raised'),
      log(2000, 'Mary Nabirye', 'Endorsement not needed (raised by Housekeeping head)'),
      log(1950, 'Peter Mugisha', 'Not in store (short: 4 × Guest soap box (100)). Requisition raised against the Housekeeping budget'),
      log(1900, 'Esther Nambi', 'Approved'),
    ],
    messages: [],
  },
  {
    id: 'SR-1006',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Mary Nabirye',
    createdAt: iso(4000),
    urgency: 'Normal',
    reason: 'Replace worn sheets.',
    items: [{ name: 'Bed sheet (queen)', qty: 12, unitCost: 65_000 }],
    status: 'Ordered',
    requisitionAt: iso(3900),
    poId: 'PO-2001',
    history: [
      log(4000, 'Mary Nabirye', 'Raised'),
      log(4000, 'Mary Nabirye', 'Endorsement not needed (raised by Housekeeping head)'),
      log(3950, 'Peter Mugisha', 'Not in store (short: 12 × Bed sheet (queen)). Requisition raised against the Housekeeping budget'),
      log(3900, 'Esther Nambi', 'Approved'),
      log(3800, 'Grace Namatovu', 'PO-2001 raised with Nile Linen House and bought'),
    ],
    messages: [],
  },
  {
    id: 'SR-1007',
    flow: 'chain',
    department: 'Housekeeping',
    requester: 'Sarah Nanteza',
    createdAt: iso(5000),
    urgency: 'Normal',
    reason: '',
    items: [{ name: 'Mop heads', qty: 3, unitCost: 0 }],
    status: 'Issued',
    history: [
      log(5000, 'Sarah Nanteza', 'Raised'),
      log(4950, 'Mary Nabirye', 'Endorsed by department head'),
      log(4900, 'Peter Mugisha', 'Issued from the store to Housekeeping'),
    ],
    messages: [],
  },

  // Simple (Starter hotels)
  {
    id: 'SR-0901',
    flow: 'simple',
    department: 'Housekeeping',
    requester: 'Mary Nabirye',
    createdAt: iso(180),
    urgency: 'Urgent',
    reason: 'Floor cleaner and mop heads are nearly finished.',
    items: [
      { name: 'Floor cleaner (5L)', qty: 6, unitCost: 0 },
      { name: 'Mop heads', qty: 10, unitCost: 0 },
    ],
    status: 'Submitted',
    history: [log(180, 'Mary Nabirye', 'Raised')],
    messages: [],
  },
  {
    id: 'SR-0902',
    flow: 'simple',
    department: 'Maintenance',
    requester: 'Joseph Okia',
    createdAt: iso(600),
    urgency: 'Normal',
    reason: 'Replace worn taps in the east wing.',
    items: [{ name: 'Basin mixer tap', qty: 8, unitCost: 0 }],
    status: 'Submitted',
    history: [log(600, 'Joseph Okia', 'Raised')],
    messages: [],
  },
  {
    id: 'SR-0903',
    flow: 'simple',
    department: 'Housekeeping',
    requester: 'Mary Nabirye',
    createdAt: iso(2000),
    urgency: 'Normal',
    reason: 'Guest soap for next week.',
    items: [{ name: 'Guest soap box (100)', qty: 4, unitCost: 0 }],
    status: 'Bought',
    history: [log(2000, 'Mary Nabirye', 'Raised'), log(1900, 'Esther Nambi', 'Bought')],
    messages: [],
  },
]

// ---- Sample write-offs (demo data: replaced by real reports once connected) ----

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

function sampleLoss(
  n: number,
  days: number,
  itemId: string,
  qty: number,
  reason: LossReason,
  note: string,
  extra: Partial<LossReport> = {},
): LossReport {
  const s = SAMPLE_STOCK.find((x) => x.id === itemId) ?? SAMPLE_STOCK[0]
  return {
    id: `LOS-${6900 + n}`,
    at: daysAgo(days),
    by: 'Daniel Kato',
    itemId: s.id,
    item: s.name,
    unit: s.unit,
    qty,
    unitCost: s.unitCost,
    reason,
    note,
    status: 'Posted',
    ...extra,
  }
}

const reviewedBy = (days: number, note?: string): LossReview => ({
  by: 'Esther Nambi',
  at: daysAgo(days - 1),
  verdict: 'Reviewed',
  note,
})

export const SAMPLE_LOSSES: LossReport[] = [
  sampleLoss(1, 172, 's6', 2, 'Damaged', 'Torn in the laundry press.', { review: reviewedBy(172) }),
  sampleLoss(2, 150, 's4', 5, 'Lost', 'Hand towels missing after the wedding event.', {
    lastSeen: 'Banquet hall, after the wedding event',
    review: reviewedBy(150),
  }),
  sampleLoss(3, 121, 's8', 6, 'Broken', 'Dropped while unpacking the delivery.', { review: reviewedBy(121) }),
  sampleLoss(4, 96, 's5', 1, 'Expired', 'Past the use-by date.', { review: reviewedBy(96) }),
  sampleLoss(5, 71, 's9', 2, 'Damaged', 'Cases soaked after a roof leak.', {
    status: 'Reversed',
    reversal: {
      by: 'Esther Nambi',
      at: daysAgo(69),
      note: 'Checked the store: the cases were dry and on the shelf.',
    },
  }),
  sampleLoss(6, 52, 's1', 2, 'Broken', 'Bottles cracked on the delivery trolley.', { review: reviewedBy(52) }),
  sampleLoss(7, 33, 's2', 3, 'Lost', 'Not returned by housekeeping.', {
    lastSeen: 'Floor 2 cart, last week',
    review: reviewedBy(33),
  }),
  sampleLoss(8, 20, 's6', 3, 'Damaged', 'Burn marks from an iron.', { review: reviewedBy(20) }),
  sampleLoss(9, 12, 's4', 4, 'Lost', 'Not found at the laundry return.', {
    lastSeen: 'Laundry room, 1 Oct',
    review: {
      by: 'Esther Nambi',
      at: daysAgo(11),
      verdict: 'Disputed',
      note: 'Laundry says every towel came back. Checking the store.',
    },
  }),
  sampleLoss(10, 5, 's8', 8, 'Broken', 'Box fell from the top shelf.'),
  sampleLoss(11, 3, 's9', 4, 'Damaged', 'Water damage on four cases.', { status: 'Waiting approval' }),
].sort((a, b) => b.at.localeCompare(a.at))