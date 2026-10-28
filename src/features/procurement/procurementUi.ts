import type { Tone } from '../../components/ui'
import type {
  ConsumerGroup,
  GrnReject,
  InvoiceStatus,
  ItemCategory,
  RfqStatus,
  StoreRecord,
  TransferStatus,
  UnitConversion,
} from '../../services/procurement/procurementTypes'
import { sameName } from './requestsModel'
import type { PurchaseOrder, StockItem } from './requestsModel'

// Area I: small shared helpers for the quotation, invoice, contract, transfer and cost screens.

export const shortDate = (s: string) =>
  new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const addDaysIso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** Whole days between an ISO time and now. */
export const daysSince = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / 86_400_000)

export const qtyText = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }))

export const RFQ_STATUS: Record<RfqStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'warn' },
  awarded: { label: 'Awarded', tone: 'brand' },
  ordered: { label: 'Ordered', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  matched: { label: 'Matched', tone: 'good' },
  variance: { label: 'Variance', tone: 'bad' },
  disputed: { label: 'Disputed', tone: 'warn' },
  approved: { label: 'Approved for payment', tone: 'brand' },
  sentToAp: { label: 'Sent to Trademate AP', tone: 'info' },
}

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'In transit', tone: 'warn' },
  received: { label: 'Received', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const LEVEL_LABEL: Record<StoreRecord['level'], string> = {
  central: 'Central',
  property: 'Property',
  outlet: 'Outlet',
}

/** Units an item can be counted in: its own unit and any pack size that converts to it. */
export function unitsFor(item: StockItem | undefined, conversions: UnitConversion[]): { unit: string; factor: number }[] {
  if (!item) return []
  const out = [{ unit: item.unit, factor: 1 }]
  for (const c of conversions) {
    if (c.itemName && !sameName(c.itemName, item.name)) continue
    if (sameName(c.toUnit, item.unit) && !out.some((o) => sameName(o.unit, c.fromUnit))) out.push({ unit: c.fromUnit, factor: c.factor })
  }
  return out
}

/** Quantity in the item's own unit, for a quantity typed in another unit. */
export function toStockQty(qty: number, unit: string, item: StockItem | undefined, conversions: UnitConversion[]) {
  const u = unitsFor(item, conversions).find((x) => sameName(x.unit, unit))
  return u ? qty * u.factor : qty
}

/** Who uses an item: from its category, or from the department it was issued to. */
export function consumerOf(category: string | undefined, categories: ItemCategory[]): ConsumerGroup {
  return categories.find((c) => sameName(c.name, category ?? ''))?.consumer ?? 'Other'
}

export function consumerOfDepartment(department: string): ConsumerGroup {
  const d = department.toLowerCase()
  if (d.includes('housekeeping')) return 'Housekeeping consumables'
  if (d.includes('maintenance') || d.includes('engineering')) return 'Maintenance spares'
  if (d.includes('kitchen') || d.includes('bar') || d.includes('restaurant') || d.includes('pos')) return 'Food and beverage'
  return 'Other'
}

export const CONSUMER_COLOUR: Record<ConsumerGroup, string> = {
  'Housekeeping consumables': 'var(--color-brand)',
  'Maintenance spares': 'var(--color-accent)',
  'Food and beverage': 'var(--color-info)',
  Other: 'var(--color-ink)',
}

/** The store record standing for an item's home store in the stock list. */
export const homeStoreOf = (item: StockItem, stores: StoreRecord[]) => stores.find((s) => s.legacyStoreId === (item.store ?? 'main'))

export function rejectedQty(rejects: GrnReject[], poId: string, itemName: string) {
  return rejects.filter((r) => r.poId === poId && r.itemName.trim().toLowerCase() === itemName.trim().toLowerCase()).reduce((s, r) => s + r.qty, 0)
}

/** What the order and its deliveries say, for the three-way match. Received is net of rejects. */
export function poContextOf(o: PurchaseOrder, rejects: GrnReject[]) {
  return {
    poId: o.id,
    supplierName: o.supplier,
    lines: o.items.map((i, n) => ({
      itemName: i.name,
      qty: i.qty,
      unitPrice: i.unitCost,
      receivedQty: Math.max(0, (o.got?.[n] ?? (o.status === 'Received' ? i.qty : 0)) - rejectedQty(rejects, o.id, i.name)),
    })),
  }
}

