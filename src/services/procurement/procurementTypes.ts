import type { RoleId } from '../../lib/roles'

// Records for procurement, stores and cost control. Names follow the gst_inventory schema:
// stores, units, unit_conversions, item_categories, supplier_contracts, approved_suppliers,
// price_history, reorder_rules, rfqs, rfq_quotes, goods_receipts, grn_lines, supplier_invoices,
// supplier_invoice_lines, invoice_matches, movements, transfers, transfer_lines, wastage.
//
// items, suppliers, requisitions, purchase_orders, po_lines, batches and counts are already kept by
// the supply chain (features/procurement/requestsModel.ts). These records point at them by name or id
// (item name, supplier name, requisition id, PO id), so nothing is held twice.

/** Who is doing something. The role decides what they may do; the backend checks it again. */
export type ProcurementActor = { id: string; name: string; role: RoleId }

export interface HistoryEntry {
  at: string
  by: string
  text: string
}

// ---- stores, units, categories ----

export type StoreLevel = 'central' | 'property' | 'outlet'

/** A store in the hierarchy. legacyStoreId ties it to a store the stock list already uses. */
export interface StoreRecord {
  id: string
  propertyId: string
  name: string
  level: StoreLevel
  parentId?: string
  /** The store id in the stock list (main, housekeeping, kitchen...). Its stock is the items' own on-hand. */
  legacyStoreId?: string
  /** Who draws from it, for consumption reports and issue notes. */
  department?: string
  active: boolean
}

export interface Unit {
  id: string
  name: string
  kind: 'count' | 'weight' | 'volume'
}

/** 1 fromUnit = factor toUnit. itemName set means it only applies to that item (a crate of soda is 24). */
export interface UnitConversion {
  id: string
  propertyId: string
  itemName?: string
  fromUnit: string
  toUnit: string
  factor: number
}

/** Which department an item category is consumed by, for consumption reports. */
export interface ItemCategory {
  id: string
  name: string
  consumer: ConsumerGroup
}

export type ConsumerGroup = 'Housekeeping consumables' | 'Maintenance spares' | 'Food and beverage' | 'Other'

/** Level an outlet store is kept at. The item's home store uses the reorder level on the item itself. */
export interface ReorderRule {
  id: string
  propertyId: string
  storeId: string
  itemName: string
  reorderAt: number
  par: number
}

/** Stock held in a store other than the item's home store. */
export interface StoreBalance {
  propertyId: string
  storeId: string
  itemName: string
  qty: number
}

// ---- suppliers ----

export type ContractStatus = 'active' | 'expired' | 'ended' | 'upcoming'

export interface ContractPrice {
  itemName: string
  unit: string
  unitPrice: number
}

export interface SupplierContract {
  id: string
  propertyId: string
  supplierName: string
  title: string
  startsOn: string
  endsOn: string
  paymentTerms: string
  leadTimeDays: number
  prices: ContractPrice[]
  /** Set when the contract was ended before its date. */
  endedAt?: string
  endedBy?: string
  endReason?: string
  createdBy: string
  createdAt: string
}

/** A supplier the hotel may buy an item, or a whole category, from. */
export interface ApprovedSupplier {
  id: string
  propertyId: string
  supplierName: string
  itemName?: string
  category?: string
  preferred: boolean
  approvedBy: string
  approvedAt: string
}

export type PriceSource = 'PO' | 'Quote' | 'Invoice' | 'Contract'

export interface PriceHistory {
  id: string
  propertyId: string
  itemName: string
  supplierName: string
  unitPrice: number
  qty: number
  at: string
  source: PriceSource
  reference: string
}

// ---- quotations ----

export type RfqStatus = 'open' | 'awarded' | 'ordered' | 'cancelled'

export interface RfqLine {
  itemName: string
  qty: number
  unit: string
}

export interface Rfq {
  id: string
  propertyId: string
  requisitionId: string
  title: string
  status: RfqStatus
  dueOn: string
  lines: RfqLine[]
  invited: string[]
  createdBy: string
  createdAt: string
  awardedSupplier?: string
  awardedBy?: string
  awardedAt?: string
  awardNote?: string
  poId?: string
  history: HistoryEntry[]
}

export interface RfqQuote {
  id: string
  rfqId: string
  supplierName: string
  /** Price of one, per RFQ line, in the same order. 0 means not quoted. */
  prices: number[]
  leadTimeDays: number
  paymentTerms: string
  validUntil: string
  notes?: string
  receivedAt: string
  recordedBy: string
}

// ---- deliveries and invoices ----

export interface GrnLine {
  itemName: string
  qty: number
  rejectedQty: number
  rejectReason?: string
}

/** A delivery as the scorecard sees it: when it was due, when it came, and what was turned away. */
export interface GoodsReceipt {
  id: string
  propertyId: string
  poId: string
  supplierName: string
  expectedOn: string
  receivedOn: string
  lines: GrnLine[]
}

/** Goods turned away or found faulty on a delivery. Reduces what may be invoiced. */
export interface GrnReject {
  id: string
  propertyId: string
  grnId: string
  poId?: string
  supplierName: string
  itemName: string
  qty: number
  reason: string
  at: string
  by: string
}

export type InvoiceStatus = 'matched' | 'variance' | 'approved' | 'sentToAp' | 'disputed'

export interface SupplierInvoiceLine {
  itemName: string
  qty: number
  unitPrice: number
}

export interface SupplierInvoice {
  id: string
  propertyId: string
  supplierName: string
  invoiceNo: string
  poId: string
  invoiceDate: string
  dueDate: string
  lines: SupplierInvoiceLine[]
  total: number
  status: InvoiceStatus
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  approvalNote?: string
  sentBy?: string
  sentAt?: string
  /** The bill's reference in Trademate accounts payable. Payment itself happens there. */
  apRef?: string
  disputeReason?: string
  history: HistoryEntry[]
}

export type MatchResult = 'ok' | 'price' | 'qty' | 'both'

/** One invoice line set against the order and what was received. */
export interface InvoiceMatch {
  id: string
  invoiceId: string
  lineNo: number
  itemName: string
  poQty: number
  poUnitPrice: number
  /** Received, less anything rejected. */
  receivedQty: number
  invoicedQty: number
  invoicedUnitPrice: number
  /** (invoiced price - PO price) / PO price, in %. */
  priceVariancePct: number
  /** invoiced - received. Positive means billed for goods not accepted. */
  qtyVariance: number
  result: MatchResult
  at: string
}

export interface MatchSettings {
  propertyId: string
  priceTolerancePct: number
  qtyTolerancePct: number
}

/** What the order and the deliveries say, gathered by the screen from the supply chain. */
export interface PoContext {
  poId: string
  supplierName: string
  lines: { itemName: string; qty: number; unitPrice: number; receivedQty: number }[]
}

// ---- transfers ----

export type TransferStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export interface TransferLine {
  itemName: string
  /** In the item's stock unit. */
  qty: number
  /** What was typed, for example 2 crate. */
  enteredQty: number
  enteredUnit: string
  /** Worth of one in the stock unit, when the transfer was made. */
  unitCost?: number
  receivedQty?: number
  /** Leaves the item's home store, so the supply chain issues it from stock on hand. */
  fromHome?: boolean
  /** Arrives in the item's home store, so it goes back onto stock on hand. */
  toHome?: boolean
}

export interface Transfer {
  id: string
  propertyId: string
  fromStoreId: string
  toStoreId: string
  status: TransferStatus
  lines: TransferLine[]
  note: string
  createdBy: string
  createdAt: string
  sentBy?: string
  sentAt?: string
  /** The store issue note made when stock left an item's home store. */
  issueRef?: string
  receivedBy?: string
  receivedAt?: string
  receiveNote?: string
  cancelReason?: string
}

// ---- history for analytics ----

/** A past stock movement kept for consumption and slow-moving reports. */
export interface MovementRecord {
  id: string
  propertyId: string
  at: string
  itemName: string
  qty: number
  unitCost: number
  kind: 'issue' | 'sale'
  department: string
}

export interface Wastage {
  id: string
  propertyId: string
  at: string
  itemName: string
  qty: number
  unitCost: number
  reason: string
  department: string
}

/** Everything this area keeps for one property, in one load. */
export interface ProcurementSnapshot {
  stores: StoreRecord[]
  units: Unit[]
  conversions: UnitConversion[]
  categories: ItemCategory[]
  reorderRules: ReorderRule[]
  balances: StoreBalance[]
  contracts: SupplierContract[]
  approved: ApprovedSupplier[]
  prices: PriceHistory[]
  rfqs: Rfq[]
  quotes: RfqQuote[]
  receipts: GoodsReceipt[]
  rejects: GrnReject[]
  invoices: SupplierInvoice[]
  matches: InvoiceMatch[]
  settings: MatchSettings
  transfers: Transfer[]
  movements: MovementRecord[]
  wastage: Wastage[]
}

// ---- inputs ----

export interface NewRfqInput {
  propertyId: string
  requisitionId: string
  title: string
  dueOn: string
  lines: RfqLine[]
  invited: string[]
}

export interface QuoteInput {
  supplierName: string
  prices: number[]
  leadTimeDays: number
  paymentTerms: string
  validUntil: string
  notes?: string
}

export interface NewInvoiceInput {
  propertyId: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  lines: SupplierInvoiceLine[]
  po: PoContext
}

export interface ContractInput {
  id?: string
  propertyId: string
  supplierName: string
  title: string
  startsOn: string
  endsOn: string
  paymentTerms: string
  leadTimeDays: number
  prices: ContractPrice[]
}

export interface ApprovedInput {
  propertyId: string
  supplierName: string
  itemName?: string
  category?: string
  preferred: boolean
}

export interface RejectInput {
  propertyId: string
  grnId: string
  poId?: string
  supplierName: string
  itemName: string
  qty: number
  /** What was delivered of that item on that note, so a reject cannot exceed it. */
  delivered: number
  reason: string
}

export interface StoreInput {
  id?: string
  propertyId: string
  name: string
  level: StoreLevel
  parentId?: string
  department?: string
  active?: boolean
  /** Link to a store the stock list already has, when adding it to the hierarchy. */
  legacyStoreId?: string
}

export interface ConversionInput {
  propertyId: string
  itemName?: string
  fromUnit: string
  toUnit: string
  factor: number
}

export interface ReorderRuleInput {
  propertyId: string
  storeId: string
  itemName: string
  reorderAt: number
  par: number
}

export interface NewTransferInput {
  propertyId: string
  fromStoreId: string
  toStoreId: string
  note: string
  lines: TransferLine[]
}
