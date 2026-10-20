import type {
  ApprovedSupplier,
  GoodsReceipt,
  InvoiceMatch,
  ItemCategory,
  MovementRecord,
  PriceHistory,
  ProcurementSnapshot,
  ReorderRule,
  Rfq,
  RfqQuote,
  StoreBalance,
  StoreRecord,
  SupplierContract,
  SupplierInvoice,
  Transfer,
  Unit,
  UnitConversion,
  Wastage,
} from './procurementTypes'
import { matchLines } from './procurementRules'

// Sample data for the demo hotels. Item and supplier names are the ones the stock list and the supplier
// list already use, so every record here points at something real on the other screens.
// Dates are counted from now, like the rest of the store sample data.

const DAY = 86_400_000
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()
const date = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10)

/** Same numbers every time, so the demo looks the same on every machine. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export const UNITS: Unit[] = [
  { id: 'piece', name: 'piece', kind: 'count' },
  { id: 'bottle', name: 'bottle', kind: 'count' },
  { id: 'crate', name: 'crate', kind: 'count' },
  { id: 'carton', name: 'carton', kind: 'count' },
  { id: 'case', name: 'case', kind: 'count' },
  { id: 'box', name: 'box', kind: 'count' },
  { id: 'pack', name: 'pack', kind: 'count' },
  { id: 'g', name: 'g', kind: 'weight' },
  { id: 'kg', name: 'kg', kind: 'weight' },
  { id: 'ml', name: 'ml', kind: 'volume' },
  { id: 'l', name: 'l', kind: 'volume' },
]

export const CATEGORIES: ItemCategory[] = [
  { id: 'cat-cleaning', name: 'Cleaning', consumer: 'Housekeeping consumables' },
  { id: 'cat-linen', name: 'Linen', consumer: 'Housekeeping consumables' },
  { id: 'cat-amenities', name: 'Amenities', consumer: 'Housekeeping consumables' },
  { id: 'cat-paper', name: 'Paper', consumer: 'Housekeeping consumables' },
  { id: 'cat-maintenance', name: 'Maintenance', consumer: 'Maintenance spares' },
  { id: 'cat-food', name: 'Food', consumer: 'Food and beverage' },
  { id: 'cat-beverage', name: 'Beverage', consumer: 'Food and beverage' },
  { id: 'cat-kitchen', name: 'Kitchen', consumer: 'Food and beverage' },
  { id: 'cat-other', name: 'Other', consumer: 'Other' },
]

/** Item, supplier, usual price, and how much a month is bought. */
const BUYS: { item: string; supplier: string; price: number; qty: number; drift: number }[] = [
  { item: 'Floor cleaner (5L)', supplier: 'Kampala Cleaning Supplies', price: 44_000, qty: 8, drift: 0.01 },
  { item: 'Mop heads', supplier: 'Kampala Cleaning Supplies', price: 11_500, qty: 10, drift: 0.005 },
  { item: 'Guest soap box (100)', supplier: 'Mukwano Wholesale', price: 76_000, qty: 4, drift: 0.012 },
  { item: 'Toilet paper (case)', supplier: 'Mukwano Wholesale', price: 66_000, qty: 10, drift: 0.01 },
  { item: 'Bed sheet (queen)', supplier: 'Nile Linen House', price: 62_000, qty: 10, drift: 0.008 },
  { item: 'Hand towels', supplier: 'Nile Linen House', price: 14_500, qty: 24, drift: 0.006 },
  { item: 'Basin mixer tap', supplier: 'Katwe Hardware and Plumbing', price: 340_000, qty: 2, drift: 0.004 },
  { item: 'Light bulb (LED)', supplier: 'Katwe Hardware and Plumbing', price: 5_800, qty: 20, drift: 0.003 },
  { item: 'Chicken breast', supplier: 'Kakira Fresh Foods', price: 17, qty: 30_000, drift: 0.015 },
  { item: 'Rice', supplier: 'Kakira Fresh Foods', price: 4.2, qty: 25_000, drift: 0.01 },
  { item: 'Tomatoes', supplier: 'Kakira Fresh Foods', price: 6.5, qty: 12_000, drift: 0.03 },
  { item: 'Soda bottle', supplier: 'Crown Beverages Ltd', price: 1_700, qty: 96, drift: 0.008 },
  { item: 'House beer bottle', supplier: 'Crown Beverages Ltd', price: 3_350, qty: 75, drift: 0.006 },
  { item: 'Mineral water bottle', supplier: 'Crown Beverages Ltd', price: 850, qty: 120, drift: 0.004 },
]

function priceHistory(propertyId: string, scale: number, seed: number): PriceHistory[] {
  const r = rng(seed)
  const out: PriceHistory[] = []
  let n = 1
  BUYS.forEach((b, i) => {
    for (let m = 6; m >= 1; m--) {
      const wobble = 1 + b.drift * (6 - m) + (r() - 0.5) * b.drift * 2
      const unitPrice = Math.round(b.price * wobble * 10) / 10
      out.push({
        id: `PH-${propertyId}-${n++}`,
        propertyId,
        itemName: b.item,
        supplierName: b.supplier,
        unitPrice: unitPrice >= 100 ? Math.round(unitPrice / 50) * 50 : unitPrice,
        qty: Math.max(1, Math.round(b.qty * scale * (0.8 + r() * 0.4))),
        at: iso(m * 30 - (i % 9)),
        source: 'PO',
        reference: `PO-${1700 + (7 - m) * 40 + i}`,
      })
    }
  })
  return out
}

/** Deliveries per supplier, with how often they come late and how much is turned away. */
const DELIVERY_PROFILE: { supplier: string; item: string; lateEvery: number; rejectEvery: number; qty: number }[] = [
  { supplier: 'Kampala Cleaning Supplies', item: 'Floor cleaner (5L)', lateEvery: 5, rejectEvery: 0, qty: 8 },
  { supplier: 'Mukwano Wholesale', item: 'Toilet paper (case)', lateEvery: 4, rejectEvery: 6, qty: 10 },
  { supplier: 'Nile Linen House', item: 'Bed sheet (queen)', lateEvery: 2, rejectEvery: 3, qty: 10 },
  { supplier: 'Katwe Hardware and Plumbing', item: 'Light bulb (LED)', lateEvery: 3, rejectEvery: 4, qty: 20 },
  { supplier: 'Kakira Fresh Foods', item: 'Chicken breast', lateEvery: 8, rejectEvery: 5, qty: 30_000 },
  { supplier: 'Crown Beverages Ltd', item: 'House beer bottle', lateEvery: 0, rejectEvery: 4, qty: 75 },
  { supplier: 'Local market', item: 'Tomatoes', lateEvery: 3, rejectEvery: 2, qty: 6_000 },
]

function deliveries(propertyId: string): GoodsReceipt[] {
  const out: GoodsReceipt[] = []
  DELIVERY_PROFILE.forEach((p, i) => {
    for (let k = 0; k < 8; k++) {
      const daysAgo = 170 - k * 21 - i
      const late = p.lateEvery > 0 && k % p.lateEvery === 1
      const rejected = p.rejectEvery > 0 && k % p.rejectEvery === 2 ? Math.max(1, Math.round(p.qty * 0.05)) : 0
      out.push({
        id: `GRN-H${propertyId}-${i}${k}`,
        propertyId,
        poId: `PO-${1600 + i * 10 + k}`,
        supplierName: p.supplier,
        expectedOn: date(-daysAgo),
        receivedOn: date(-daysAgo + (late ? 2 + (k % 3) : 0)),
        lines: [{ itemName: p.item, qty: p.qty, rejectedQty: rejected, rejectReason: rejected ? 'Damaged on arrival' : undefined }],
      })
    }
  })
  return out
}

/** Who used what, over the last four months. Some items are left still on purpose: they are slow movers. */
const USAGE: { item: string; dept: string; perWeek: number; cost: number; lastDaysAgo?: number; kind?: 'sale' }[] = [
  { item: 'Floor cleaner (5L)', dept: 'Housekeeping', perWeek: 2, cost: 45_000 },
  { item: 'Mop heads', dept: 'Housekeeping', perWeek: 2, cost: 12_000 },
  { item: 'Hand towels', dept: 'Housekeeping', perWeek: 6, cost: 15_000 },
  { item: 'Guest soap box (100)', dept: 'Housekeeping', perWeek: 1, cost: 80_000 },
  { item: 'Toilet paper (case)', dept: 'Housekeeping', perWeek: 2, cost: 70_000 },
  { item: 'Bed sheet (queen)', dept: 'Housekeeping', perWeek: 2, cost: 65_000 },
  { item: 'Toilet brush', dept: 'Housekeeping', perWeek: 1, cost: 8_000, lastDaysAgo: 85 },
  { item: 'Light bulb (LED)', dept: 'Maintenance', perWeek: 4, cost: 6_000 },
  { item: 'Basin mixer tap', dept: 'Maintenance', perWeek: 0.5, cost: 350_000 },
  { item: 'Chicken breast', dept: 'Kitchen', perWeek: 7_000, cost: 18, kind: 'sale' },
  { item: 'Potatoes', dept: 'Kitchen', perWeek: 6_000, cost: 3.5, kind: 'sale' },
  { item: 'Rice', dept: 'Kitchen', perWeek: 5_500, cost: 4.5, kind: 'sale' },
  { item: 'Beef mince', dept: 'Kitchen', perWeek: 3_000, cost: 24, kind: 'sale' },
  { item: 'Tomatoes', dept: 'Kitchen', perWeek: 2_500, cost: 7, kind: 'sale' },
  { item: 'Cooking oil', dept: 'Kitchen', perWeek: 3_000, cost: 8 },
  { item: 'Fish fillet', dept: 'Kitchen', perWeek: 2_500, cost: 28, kind: 'sale' },
  { item: 'Burger bun', dept: 'Kitchen', perWeek: 30, cost: 1_200, kind: 'sale' },
  { item: 'Mixed vegetables', dept: 'Kitchen', perWeek: 2_000, cost: 8, kind: 'sale' },
  { item: 'Lettuce', dept: 'Kitchen', perWeek: 1_200, cost: 12, kind: 'sale' },
  { item: 'Cucumber', dept: 'Kitchen', perWeek: 900, cost: 6, kind: 'sale' },
  { item: 'Salt', dept: 'Kitchen', perWeek: 300, cost: 2 },
  { item: 'Milk', dept: 'Kitchen', perWeek: 3_000, cost: 5, kind: 'sale' },
  { item: 'Lemon', dept: 'Bar', perWeek: 30, cost: 500, kind: 'sale' },
  { item: 'Orange', dept: 'Bar', perWeek: 45, cost: 600, kind: 'sale' },
  { item: 'Juice base', dept: 'Bar', perWeek: 2_000, cost: 6, kind: 'sale' },
  { item: 'Coffee beans', dept: 'Kitchen', perWeek: 200, cost: 35, lastDaysAgo: 52 },
  { item: 'Soda bottle', dept: 'Bar', perWeek: 30, cost: 1_800, kind: 'sale' },
  { item: 'House beer bottle', dept: 'Bar', perWeek: 24, cost: 3_500, kind: 'sale' },
  { item: 'Mineral water bottle', dept: 'Bar', perWeek: 40, cost: 900, kind: 'sale' },
  { item: 'House wine', dept: 'Bar', perWeek: 750, cost: 20, lastDaysAgo: 64, kind: 'sale' },
  { item: 'Mocktail syrup', dept: 'Bar', perWeek: 150, cost: 10, lastDaysAgo: 98 },
]

function movements(propertyId: string, scale: number, seed: number): MovementRecord[] {
  const r = rng(seed)
  const out: MovementRecord[] = []
  let n = 1
  for (const u of USAGE) {
    const start = 120
    const end = u.lastDaysAgo ?? 1
    for (let d = start; d >= end; d -= 7) {
      const qty = u.perWeek * scale * (0.7 + r() * 0.6)
      out.push({
        id: `MH-${propertyId}-${n++}`,
        propertyId,
        at: iso(d - (n % 3)),
        itemName: u.item,
        qty: qty >= 10 ? Math.round(qty) : Math.max(1, Math.round(qty)),
        unitCost: u.cost,
        kind: u.kind ?? 'issue',
        department: u.dept,
      })
    }
  }
  return out
}

function wastage(propertyId: string, scale: number): Wastage[] {
  const w = (n: number, daysAgo: number, itemName: string, qty: number, unitCost: number, reason: string, department: string): Wastage => ({
    id: `WS-${propertyId}-${n}`,
    propertyId,
    at: iso(daysAgo),
    itemName,
    qty: Math.max(1, Math.round(qty * scale)),
    unitCost,
    reason,
    department,
  })
  return [
    w(1, 3, 'Lettuce', 600, 12, 'Spoilage', 'Kitchen'),
    w(2, 6, 'Tomatoes', 900, 7, 'Spoilage', 'Kitchen'),
    w(3, 9, 'Milk', 1_000, 5, 'Expired', 'Kitchen'),
    w(4, 12, 'Chicken breast', 800, 18, 'Preparation waste', 'Kitchen'),
    w(5, 15, 'Rice', 1_500, 4.5, 'Over-production', 'Kitchen'),
    w(6, 20, 'House wine', 750, 20, 'Spoilage', 'Bar'),
    w(7, 24, 'Soda bottle', 6, 1_800, 'Breakage', 'Bar'),
    w(8, 33, 'House beer bottle', 4, 3_500, 'Breakage', 'Bar'),
    w(9, 41, 'Mixed vegetables', 1_200, 8, 'Spoilage', 'Kitchen'),
    w(10, 55, 'Fish fillet', 700, 28, 'Expired', 'Kitchen'),
    w(11, 62, 'Burger bun', 14, 1_200, 'Over-production', 'Kitchen'),
    w(12, 74, 'Orange', 20, 600, 'Spoilage', 'Bar'),
  ]
}

function contracts(propertyId: string): SupplierContract[] {
  const c = (n: number, supplierName: string, title: string, startsOn: string, endsOn: string, paymentTerms: string, leadTimeDays: number, prices: SupplierContract['prices']): SupplierContract => ({
    id: `CON-${propertyId}-${n}`,
    propertyId,
    supplierName,
    title,
    startsOn,
    endsOn,
    paymentTerms,
    leadTimeDays,
    prices,
    createdBy: 'Grace Namatovu',
    createdAt: iso(200),
  })
  return [
    c(1, 'Crown Beverages Ltd', 'Soft drinks and beer 2026', date(-140), date(120), '30 days', 2, [
      { itemName: 'Soda bottle', unit: 'bottle', unitPrice: 1_750 },
      { itemName: 'House beer bottle', unit: 'bottle', unitPrice: 3_400 },
      { itemName: 'Mineral water bottle', unit: 'bottle', unitPrice: 850 },
    ]),
    c(2, 'Mukwano Wholesale', 'Amenities and paper', date(-345), date(20), '30 days', 3, [
      { itemName: 'Guest soap box (100)', unit: 'box', unitPrice: 78_000 },
      { itemName: 'Toilet paper (case)', unit: 'case', unitPrice: 68_000 },
    ]),
    c(3, 'Kampala Cleaning Supplies', 'Cleaning chemicals', date(-90), date(275), '14 days', 3, [
      { itemName: 'Floor cleaner (5L)', unit: 'bottle', unitPrice: 44_000 },
      { itemName: 'Mop heads', unit: 'piece', unitPrice: 11_500 },
    ]),
    c(4, 'Nile Linen House', 'Linen supply 2025', date(-375), date(-10), '30 days', 7, [
      { itemName: 'Bed sheet (queen)', unit: 'piece', unitPrice: 62_000 },
      { itemName: 'Hand towels', unit: 'piece', unitPrice: 14_500 },
    ]),
    c(5, 'Kakira Fresh Foods', 'Fresh produce and poultry', date(-60), date(185), '7 days', 1, [
      { itemName: 'Chicken breast', unit: 'g', unitPrice: 17.5 },
      { itemName: 'Rice', unit: 'g', unitPrice: 4.4 },
      { itemName: 'Tomatoes', unit: 'g', unitPrice: 6.5 },
    ]),
  ]
}

function approved(propertyId: string): ApprovedSupplier[] {
  const a = (n: number, supplierName: string, scope: { category?: string; itemName?: string }, preferred: boolean): ApprovedSupplier => ({
    id: `ASL-${propertyId}-${n}`,
    propertyId,
    supplierName,
    ...scope,
    preferred,
    approvedBy: 'Esther Nambi',
    approvedAt: iso(180 - n),
  })
  return [
    a(1, 'Kampala Cleaning Supplies', { category: 'Cleaning' }, true),
    a(2, 'Local market', { category: 'Cleaning' }, false),
    a(3, 'Mukwano Wholesale', { category: 'Amenities' }, true),
    a(4, 'Mukwano Wholesale', { category: 'Paper' }, true),
    a(5, 'Kampala Cleaning Supplies', { category: 'Amenities' }, false),
    a(6, 'Nile Linen House', { category: 'Linen' }, true),
    a(7, 'Mukwano Wholesale', { category: 'Linen' }, false),
    a(8, 'Katwe Hardware and Plumbing', { category: 'Maintenance' }, true),
    a(9, 'Local market', { category: 'Maintenance' }, false),
    a(10, 'Katwe Hardware and Plumbing', { itemName: 'Basin mixer tap' }, true),
    a(11, 'Kakira Fresh Foods', { category: 'Food' }, true),
    a(12, 'Local market', { category: 'Food' }, false),
    a(13, 'Crown Beverages Ltd', { category: 'Beverage' }, true),
    a(14, 'Mukwano Wholesale', { category: 'Beverage' }, false),
  ]
}

function stores(propertyId: string, central: boolean): StoreRecord[] {
  const s = (id: string, name: string, level: StoreRecord['level'], parentId: string | undefined, department: string, legacyStoreId?: string): StoreRecord => ({
    id: `${propertyId}-${id}`,
    propertyId,
    name,
    level,
    parentId: parentId ? `${propertyId}-${parentId}` : undefined,
    legacyStoreId,
    department,
    active: true,
  })
  return [
    ...(central ? [s('central', 'Lakeview Hotels central store', 'central', undefined, 'Store')] : []),
    s('main', 'Main store', 'property', central ? 'central' : undefined, 'Store', 'main'),
    s('housekeeping', 'Housekeeping store', 'property', 'main', 'Housekeeping', 'housekeeping'),
    s('engineering', 'Engineering store', 'property', 'main', 'Maintenance', 'engineering'),
    s('kitchen', 'Kitchen store', 'outlet', 'main', 'Kitchen', 'kitchen'),
    s('bar', 'Bar store', 'outlet', 'main', 'Bar', 'bar'),
    s('poolbar', central ? 'Pool bar' : 'Garden bar', 'outlet', 'bar', 'Bar'),
    s('floor3', central ? 'Floor 3 linen room' : 'Linen cupboard', 'outlet', 'housekeeping', 'Housekeeping'),
  ]
}

function conversions(propertyId: string): UnitConversion[] {
  const c = (n: number, fromUnit: string, toUnit: string, factor: number, itemName?: string): UnitConversion => ({
    id: `UC-${propertyId}-${n}`,
    propertyId,
    fromUnit,
    toUnit,
    factor,
    itemName,
  })
  return [
    c(1, 'crate', 'bottle', 24, 'Soda bottle'),
    c(2, 'crate', 'bottle', 25, 'House beer bottle'),
    c(3, 'carton', 'bottle', 12, 'Mineral water bottle'),
    c(4, 'kg', 'g', 1000),
    c(5, 'l', 'ml', 1000),
    c(6, 'pack', 'piece', 10, 'Light bulb (LED)'),
  ]
}

function balances(propertyId: string, central: boolean): StoreBalance[] {
  const b = (store: string, itemName: string, qty: number): StoreBalance => ({ propertyId, storeId: `${propertyId}-${store}`, itemName, qty })
  return [
    b('poolbar', 'Soda bottle', 18),
    b('poolbar', 'House beer bottle', 10),
    b('poolbar', 'Mineral water bottle', 20),
    b('floor3', 'Hand towels', 12),
    b('floor3', 'Bed sheet (queen)', 8),
    ...(central
      ? [b('central', 'Toilet paper (case)', 40), b('central', 'Guest soap box (100)', 12), b('central', 'Floor cleaner (5L)', 10)]
      : []),
  ]
}

function reorderRules(propertyId: string): ReorderRule[] {
  const r = (n: number, store: string, itemName: string, reorderAt: number, par: number): ReorderRule => ({
    id: `RR-${propertyId}-${n}`,
    propertyId,
    storeId: `${propertyId}-${store}`,
    itemName,
    reorderAt,
    par,
  })
  return [
    r(1, 'poolbar', 'Soda bottle', 24, 48),
    r(2, 'poolbar', 'House beer bottle', 12, 36),
    r(3, 'poolbar', 'Mineral water bottle', 12, 36),
    r(4, 'floor3', 'Hand towels', 10, 30),
    r(5, 'floor3', 'Bed sheet (queen)', 6, 20),
  ]
}

function transfers(propertyId: string, central: boolean): Transfer[] {
  const out: Transfer[] = [
    {
      id: `TRF-${propertyId}-500`,
      propertyId,
      fromStoreId: `${propertyId}-housekeeping`,
      toStoreId: `${propertyId}-floor3`,
      status: 'received',
      lines: [{ itemName: 'Hand towels', qty: 12, enteredQty: 12, enteredUnit: 'piece', receivedQty: 12, fromHome: true }],
      note: 'Weekly floor par',
      createdBy: 'Peter Mugisha',
      createdAt: iso(6),
      sentBy: 'Peter Mugisha',
      sentAt: iso(6),
      receivedBy: 'Mary Nabirye',
      receivedAt: iso(5.9),
    },
    {
      id: `TRF-${propertyId}-501`,
      propertyId,
      fromStoreId: `${propertyId}-bar`,
      toStoreId: `${propertyId}-poolbar`,
      status: 'sent',
      lines: [{ itemName: 'Soda bottle', qty: 24, enteredQty: 1, enteredUnit: 'crate', fromHome: true }],
      note: 'Weekend pool service',
      createdBy: 'Peter Mugisha',
      createdAt: iso(0.2),
      sentBy: 'Peter Mugisha',
      sentAt: iso(0.15),
    },
  ]
  if (central)
    out.push({
      id: `TRF-${propertyId}-502`,
      propertyId,
      fromStoreId: `${propertyId}-central`,
      toStoreId: `${propertyId}-main`,
      status: 'draft',
      lines: [{ itemName: 'Toilet paper (case)', qty: 10, enteredQty: 10, enteredUnit: 'case', toHome: true }],
      note: 'Monthly allocation from central',
      createdBy: 'Peter Mugisha',
      createdAt: iso(0.5),
    })
  return out
}

function rfqs(propertyId: string): { rfqs: Rfq[]; quotes: RfqQuote[] } {
  const open: Rfq = {
    id: 'RFQ-301',
    propertyId,
    requisitionId: 'SR-1005',
    title: 'Guest soap for next week',
    status: 'open',
    dueOn: date(2),
    lines: [{ itemName: 'Guest soap box (100)', qty: 4, unit: 'box' }],
    invited: ['Mukwano Wholesale', 'Kampala Cleaning Supplies', 'Local market'],
    createdBy: 'Grace Namatovu',
    createdAt: iso(1.2),
    history: [{ at: iso(1.2), by: 'Grace Namatovu', text: 'Sent to 3 suppliers' }],
  }
  const done: Rfq = {
    id: 'RFQ-300',
    propertyId,
    requisitionId: 'SR-1006',
    title: 'Replace worn sheets',
    status: 'ordered',
    dueOn: date(-3),
    lines: [{ itemName: 'Bed sheet (queen)', qty: 12, unit: 'piece' }],
    invited: ['Nile Linen House', 'Mukwano Wholesale'],
    createdBy: 'Grace Namatovu',
    createdAt: iso(3.85),
    awardedSupplier: 'Nile Linen House',
    awardedBy: 'Esther Nambi',
    awardedAt: iso(2.7),
    awardNote: 'Cheapest and the usual linen supplier.',
    poId: 'PO-2001',
    history: [
      { at: iso(3.85), by: 'Grace Namatovu', text: 'Sent to 2 suppliers' },
      { at: iso(2.7), by: 'Esther Nambi', text: 'Awarded to Nile Linen House' },
      { at: iso(2.65), by: 'Grace Namatovu', text: 'PO-2001 raised' },
    ],
  }
  const quotes: RfqQuote[] = [
    { id: 'Q-1', rfqId: 'RFQ-301', supplierName: 'Mukwano Wholesale', prices: [78_000], leadTimeDays: 2, paymentTerms: '30 days', validUntil: date(14), receivedAt: iso(0.8), recordedBy: 'Grace Namatovu' },
    { id: 'Q-2', rfqId: 'RFQ-301', supplierName: 'Kampala Cleaning Supplies', prices: [82_500], leadTimeDays: 4, paymentTerms: '14 days', validUntil: date(10), receivedAt: iso(0.6), recordedBy: 'Grace Namatovu', notes: 'Free delivery over UGX 300,000' },
    { id: 'Q-3', rfqId: 'RFQ-300', supplierName: 'Nile Linen House', prices: [65_000], leadTimeDays: 5, paymentTerms: '30 days', validUntil: date(20), receivedAt: iso(3.2), recordedBy: 'Grace Namatovu' },
    { id: 'Q-4', rfqId: 'RFQ-300', supplierName: 'Mukwano Wholesale', prices: [68_500], leadTimeDays: 3, paymentTerms: 'Cash on delivery', validUntil: date(5), receivedAt: iso(3.0), recordedBy: 'Grace Namatovu' },
  ]
  return { rfqs: [open, done], quotes }
}

function invoices(propertyId: string, tol: { price: number; qty: number }): { invoices: SupplierInvoice[]; matches: InvoiceMatch[] } {
  const list: { inv: Omit<SupplierInvoice, 'total' | 'status' | 'history'> & { status?: SupplierInvoice['status'] }; po: { qty: number; price: number; got: number }[] }[] = [
    {
      inv: { id: `SINV-${propertyId}-1`, propertyId, supplierName: 'Nile Linen House', invoiceNo: 'NLH-8841', poId: 'PO-2001', invoiceDate: date(-1), dueDate: date(29), lines: [{ itemName: 'Bed sheet (queen)', qty: 12, unitPrice: 66_500 }], createdBy: 'Grace Namatovu', createdAt: iso(1) },
      po: [{ qty: 12, price: 65_000, got: 0 }],
    },
    {
      inv: { id: `SINV-${propertyId}-2`, propertyId, supplierName: 'Crown Beverages Ltd', invoiceNo: 'CB-22019', poId: 'PO-1996', invoiceDate: date(-6), dueDate: date(24), lines: [{ itemName: 'Soda bottle', qty: 96, unitPrice: 1_750 }, { itemName: 'House beer bottle', qty: 75, unitPrice: 3_400 }], createdBy: 'Grace Namatovu', createdAt: iso(6) },
      po: [{ qty: 96, price: 1_750, got: 96 }, { qty: 75, price: 3_400, got: 72 }],
    },
    {
      inv: { id: `SINV-${propertyId}-3`, propertyId, supplierName: 'Kampala Cleaning Supplies', invoiceNo: 'KCS-1190', poId: 'PO-1998', invoiceDate: date(-4), dueDate: date(10), lines: [{ itemName: 'Floor cleaner (5L)', qty: 6, unitPrice: 44_000 }], createdBy: 'Grace Namatovu', createdAt: iso(4), status: 'approved', approvedBy: 'Brian Ssemakula', approvedAt: iso(3) },
      po: [{ qty: 6, price: 44_000, got: 6 }],
    },
    {
      inv: { id: `SINV-${propertyId}-4`, propertyId, supplierName: 'Mukwano Wholesale', invoiceNo: 'MW-55310', poId: 'PO-1994', invoiceDate: date(-12), dueDate: date(18), lines: [{ itemName: 'Guest soap box (100)', qty: 4, unitPrice: 78_000 }, { itemName: 'Toilet paper (case)', qty: 10, unitPrice: 68_000 }], createdBy: 'Grace Namatovu', createdAt: iso(12), status: 'sentToAp', approvedBy: 'Brian Ssemakula', approvedAt: iso(11), sentBy: 'Brian Ssemakula', sentAt: iso(10.9), apRef: 'TM-AP-55102' },
      po: [{ qty: 4, price: 78_000, got: 4 }, { qty: 10, price: 68_000, got: 10 }],
    },
  ]
  const invs: SupplierInvoice[] = []
  const matches: InvoiceMatch[] = []
  for (const { inv, po } of list) {
    const m = matchLines(
      inv.id,
      inv.lines,
      { poId: inv.poId, supplierName: inv.supplierName, lines: inv.lines.map((l, i) => ({ itemName: l.itemName, qty: po[i].qty, unitPrice: po[i].price, receivedQty: po[i].got })) },
      tol.price,
      tol.qty,
      inv.createdAt,
    )
    matches.push(...m)
    const clean = m.every((x) => x.result === 'ok')
    const history = [{ at: inv.createdAt, by: inv.createdBy, text: `Entered against ${inv.poId}: ${clean ? 'matched' : 'variance found'}` }]
    if (inv.approvedBy && inv.approvedAt) history.push({ at: inv.approvedAt, by: inv.approvedBy, text: 'Approved for payment' })
    if (inv.sentBy && inv.sentAt) history.push({ at: inv.sentAt, by: inv.sentBy, text: `Sent to Trademate AP as ${inv.apRef}` })
    invs.push({
      ...inv,
      status: inv.status ?? (clean ? 'matched' : 'variance'),
      total: inv.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      history,
    })
  }
  return { invoices: invs, matches }
}

/** Starting data for one property. Lakeview (large) gets a central store and quotations. */
export function seedFor(propertyId: string): ProcurementSnapshot {
  const settings = { propertyId, priceTolerancePct: 2, qtyTolerancePct: 0 }
  const big = propertyId === 't1'
  const known = propertyId === 't1' || propertyId === 't3'
  if (!known) {
    return {
      stores: stores(propertyId, false).filter((s) => s.legacyStoreId),
      units: UNITS,
      conversions: conversions(propertyId),
      categories: CATEGORIES,
      reorderRules: [],
      balances: [],
      contracts: [],
      approved: [],
      prices: [],
      rfqs: [],
      quotes: [],
      receipts: [],
      rejects: [],
      invoices: [],
      matches: [],
      settings,
      transfers: [],
      movements: [],
      wastage: [],
    }
  }
  const scale = big ? 1 : 0.45
  const seed = big ? 7 : 31
  const q = big ? rfqs(propertyId) : { rfqs: [], quotes: [] }
  const inv = invoices(propertyId, { price: settings.priceTolerancePct, qty: settings.qtyTolerancePct })
  return {
    stores: stores(propertyId, big),
    units: UNITS,
    conversions: conversions(propertyId),
    categories: CATEGORIES,
    reorderRules: reorderRules(propertyId),
    balances: balances(propertyId, big),
    contracts: contracts(propertyId),
    approved: approved(propertyId),
    prices: priceHistory(propertyId, scale, seed),
    rfqs: q.rfqs,
    quotes: q.quotes,
    receipts: deliveries(propertyId),
    rejects: [],
    invoices: inv.invoices,
    matches: inv.matches,
    settings,
    transfers: transfers(propertyId, big),
    movements: movements(propertyId, scale, seed + 3),
    wastage: wastage(propertyId, scale),
  }
}
