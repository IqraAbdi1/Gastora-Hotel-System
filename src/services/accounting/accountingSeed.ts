import { TODAY } from '../../data/sample'
import type {
  Budget,
  BudgetLine,
  CollectionNote,
  Currency,
  DirectBillAccount,
  DirectBillTransfer,
  ExchangeRate,
  GlAccount,
  PostingRule,
  ProfitCentre,
  SourceTransaction,
  TransactionCode,
} from './accountingTypes'
import type { Actor } from '../types'

// Deterministic sample data for the demo hotels (t1 Lakeview Grand, t2 Mbale Town Inn, t3 Savannah Lodge).

export const SYSTEM: Actor = { id: 'system', name: 'Gastora' }
export const FIN: Actor = { id: 'u-finance', name: 'Brian Ssemakula' }
export const GM: Actor = { id: 'u-gm', name: 'Esther Nambi' }

export function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const at = (iso: string, time = '23:40') => new Date(`${iso}T${time}:00`).toISOString()

/** A number between 0 and 1 that is always the same for the same text. */
export function hash01(seed: string): number {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const round = (n: number, to = 1000) => Math.round(n / to) * to

/** How big each sample hotel is, so the figures look like that hotel. */
export function scaleOf(propertyId: string): { rooms: number; size: 'small' | 'medium' | 'large' } {
  if (propertyId === 't1') return { rooms: 120, size: 'large' }
  if (propertyId === 't3') return { rooms: 45, size: 'medium' }
  return { rooms: 18, size: 'small' }
}

export const TRANSACTION_CODES: TransactionCode[] = [
  { id: 'TC-ROOM', code: 'ROOM', name: 'Room night', group: 'room' },
  { id: 'TC-FB-REST', code: 'FB-REST', name: 'Restaurant', group: 'fb' },
  { id: 'TC-FB-BAR', code: 'FB-BAR', name: 'Bar', group: 'fb' },
  { id: 'TC-MINIBAR', code: 'MINIBAR', name: 'Minibar', group: 'minibar' },
  { id: 'TC-LAUNDRY', code: 'LAUNDRY', name: 'Laundry', group: 'laundry' },
  { id: 'TC-TRANSPORT', code: 'TRANSPORT', name: 'Transport', group: 'other-revenue' },
  { id: 'TC-SPA', code: 'SPA', name: 'Spa', group: 'other-revenue' },
  { id: 'TC-OTHER', code: 'OTHER', name: 'Other charges', group: 'other-revenue' },
  { id: 'TC-VAT', code: 'VAT', name: 'VAT', group: 'tax' },
  { id: 'TC-LHT', code: 'LHT', name: 'Local Hotel Tax', group: 'tax' },
  { id: 'TC-TAX-OTHER', code: 'TAX-OTHER', name: 'Other levies', group: 'tax' },
  { id: 'TC-SVC', code: 'SVC', name: 'Service charge', group: 'service' },
  { id: 'TC-PAY-CASH', code: 'PAY-CASH', name: 'Cash payment', group: 'payment' },
  { id: 'TC-PAY-MTN', code: 'PAY-MTN', name: 'MTN MoMo payment', group: 'payment' },
  { id: 'TC-PAY-AIRTEL', code: 'PAY-AIRTEL', name: 'Airtel Money payment', group: 'payment' },
  { id: 'TC-PAY-CARD', code: 'PAY-CARD', name: 'Card payment', group: 'payment' },
  { id: 'TC-PAY-BANK', code: 'PAY-BANK', name: 'Bank transfer', group: 'payment' },
  { id: 'TC-DEP', code: 'DEP', name: 'Deposit received', group: 'deposit' },
  { id: 'TC-DEP-APPLY', code: 'DEP-APPLY', name: 'Deposit applied at check-in', group: 'deposit' },
  { id: 'TC-REFUND', code: 'REFUND', name: 'Refund paid', group: 'refund' },
  { id: 'TC-COMM', code: 'COMM', name: 'Agent commission', group: 'commission' },
  { id: 'TC-CL-TRF', code: 'CL-TRF', name: 'Transfer to city ledger', group: 'receivable' },
]

const CHART: [string, string, GlAccount['accountType']][] = [
  ['1000', 'Cash on hand', 'asset'],
  ['1020', 'MTN MoMo float', 'asset'],
  ['1021', 'Airtel Money float', 'asset'],
  ['1030', 'Card clearing', 'asset'],
  ['1100', 'Stanbic Bank UGX', 'asset'],
  ['1110', 'Stanbic Bank USD', 'asset'],
  ['1200', 'Guest ledger', 'asset'],
  ['1210', 'City ledger receivables', 'asset'],
  ['2200', 'VAT payable', 'liability'],
  ['2210', 'Local Hotel Tax payable', 'liability'],
  ['2220', 'Other levies payable', 'liability'],
  ['2250', 'Service charge payable', 'liability'],
  ['2300', 'Advance deposits', 'liability'],
  ['2400', 'Agent commissions payable', 'liability'],
  ['4000', 'Room revenue', 'income'],
  ['4100', 'Food revenue', 'income'],
  ['4110', 'Beverage revenue', 'income'],
  ['4120', 'Minibar revenue', 'income'],
  ['4300', 'Laundry revenue', 'income'],
  ['4310', 'Transport revenue', 'income'],
  ['4320', 'Spa revenue', 'income'],
  ['4900', 'Other income', 'income'],
  ['5400', 'Commission expense', 'expense'],
]

export function chartFor(propertyId: string, syncedAt: string): GlAccount[] {
  return CHART.map(([code, name, type]) => ({
    id: `${propertyId}-GL-${code}`,
    propertyId,
    trademateCode: code,
    trademateName: name,
    accountType: type,
    syncedAt,
  }))
}

/** The chart before Trademate renumbered laundry revenue, for the batches that were posted then. */
export function oldChartFor(propertyId: string, syncedAt: string): GlAccount[] {
  return [
    ...chartFor(propertyId, syncedAt),
    { id: `${propertyId}-GL-4305`, propertyId, trademateCode: '4305', trademateName: 'Laundry revenue (old)', accountType: 'income', syncedAt },
  ]
}

const CENTRES: { code: string; name: string; kind: 'profit' | 'cost'; department: string; sizes: ('small' | 'medium' | 'large')[] }[] = [
  { code: 'ROOMS', name: 'Rooms', kind: 'profit', department: 'Front office', sizes: ['small', 'medium', 'large'] },
  { code: 'FB', name: 'Food and beverage', kind: 'profit', department: 'Food and beverage', sizes: ['small', 'medium', 'large'] },
  { code: 'LAUNDRY', name: 'Laundry', kind: 'profit', department: 'Housekeeping', sizes: ['medium', 'large'] },
  { code: 'SPA', name: 'Spa and wellness', kind: 'profit', department: 'Spa', sizes: ['large'] },
  { code: 'CONF', name: 'Conference and events', kind: 'profit', department: 'Sales', sizes: ['large'] },
  { code: 'ADMIN', name: 'Administration and general', kind: 'cost', department: 'Administration', sizes: ['small', 'medium', 'large'] },
  { code: 'HK', name: 'Housekeeping', kind: 'cost', department: 'Housekeeping', sizes: ['medium', 'large'] },
  { code: 'MAINT', name: 'Maintenance', kind: 'cost', department: 'Engineering', sizes: ['medium', 'large'] },
  { code: 'SALES', name: 'Sales and marketing', kind: 'cost', department: 'Sales', sizes: ['large'] },
]

export function centresFor(propertyId: string): ProfitCentre[] {
  const { size } = scaleOf(propertyId)
  return CENTRES.filter((c) => c.sizes.includes(size)).map((c) => ({
    id: `${propertyId}-PC-${c.code}`,
    propertyId,
    code: c.code,
    name: c.name,
    kind: c.kind,
    department: c.department,
    active: true,
  }))
}

const RULES: Record<string, [string, string, string]> = {
  ROOM: ['1200', '4000', 'ROOMS'],
  'FB-REST': ['1200', '4100', 'FB'],
  'FB-BAR': ['1200', '4110', 'FB'],
  MINIBAR: ['1200', '4120', 'FB'],
  // Trademate renumbered laundry revenue to 4300; this rule still points at the old code.
  LAUNDRY: ['1200', '4305', 'LAUNDRY'],
  TRANSPORT: ['1200', '4310', 'ROOMS'],
  SPA: ['1200', '4320', 'SPA'],
  OTHER: ['1200', '4900', 'ROOMS'],
  VAT: ['1200', '2200', 'ADMIN'],
  LHT: ['1200', '2210', 'ADMIN'],
  'TAX-OTHER': ['1200', '2220', 'ADMIN'],
  SVC: ['1200', '2250', 'ADMIN'],
  'PAY-CASH': ['1000', '1200', 'ADMIN'],
  'PAY-MTN': ['1020', '1200', 'ADMIN'],
  'PAY-AIRTEL': ['1021', '1200', 'ADMIN'],
  'PAY-CARD': ['1030', '1200', 'ADMIN'],
  'PAY-BANK': ['1100', '1200', 'ADMIN'],
  DEP: ['1100', '2300', 'ADMIN'],
  'DEP-APPLY': ['2300', '1200', 'ADMIN'],
  REFUND: ['1200', '1000', 'ADMIN'],
  COMM: ['5400', '2400', 'SALES'],
  'CL-TRF': ['1210', '1200', 'ADMIN'],
}

export function rulesFor(propertyId: string, centres: ProfitCentre[], updatedAt: string): PostingRule[] {
  const centreId = (code: string) =>
    (centres.find((c) => c.code === code) ?? centres.find((c) => c.code === (code === 'SALES' ? 'ADMIN' : 'ROOMS')))!.id
  return TRANSACTION_CODES.map((t) => {
    const [dr, cr, centre] = RULES[t.code]
    return {
      id: `${propertyId}-PR-${t.code}`,
      propertyId,
      transactionCodeId: t.id,
      debitAccount: dr,
      creditAccount: cr,
      profitCentreId: centreId(centre),
      active: true,
      updatedAt,
      updatedBy: FIN,
    }
  })
}

/** A plausible day of hotel transactions, for the days before the demo started. */
export function syntheticDay(propertyId: string, date: string): SourceTransaction[] {
  const { rooms, size } = scaleOf(propertyId)
  const h = (k: string) => hash01(`${propertyId}|${date}|${k}`)
  const occupied = Math.round(rooms * (0.55 + h('occ') * 0.3))
  const rate = size === 'large' ? 265000 : size === 'medium' ? 180000 : 95000
  const gross = round(occupied * rate)
  const vat = size === 'small' ? 0 : round((gross * 18) / 118)
  const rest = round(gross * (0.18 + h('rest') * 0.08))
  const bar = round(gross * (0.07 + h('bar') * 0.05))
  const minibar = size === 'small' ? 0 : round(gross * 0.015)
  const laundry = size === 'small' ? round(gross * 0.01) : round(gross * (0.02 + h('laundry') * 0.02))
  const lht = occupied * (size === 'large' ? 7400 : 2000)
  const svc = size === 'medium' ? round(gross * 0.05) : 0
  const spa = size === 'large' ? round(gross * 0.03) : 0
  const charges = gross + rest + bar + minibar + laundry + lht + svc + spa
  const paid = round(charges * (0.82 + h('paid') * 0.12))
  const dep = round(gross * 0.08)
  const out: SourceTransaction[] = [
    { transactionCode: 'ROOM', amount: gross - vat, description: `${occupied} room nights` },
    { transactionCode: 'VAT', amount: vat, description: 'VAT inside room rates' },
    { transactionCode: 'LHT', amount: lht, description: 'Local Hotel Tax' },
    { transactionCode: 'SVC', amount: svc, description: 'Service charge' },
    { transactionCode: 'FB-REST', amount: rest, description: 'Restaurant' },
    { transactionCode: 'FB-BAR', amount: bar, description: 'Bar' },
    { transactionCode: 'MINIBAR', amount: minibar, description: 'Minibar' },
    { transactionCode: 'LAUNDRY', amount: laundry, description: 'Laundry' },
    { transactionCode: 'SPA', amount: spa, description: 'Spa' },
    { transactionCode: 'PAY-CASH', amount: round(paid * 0.2), description: 'Cash' },
    { transactionCode: 'PAY-MTN', amount: round(paid * 0.35), description: 'MTN MoMo' },
    { transactionCode: 'PAY-AIRTEL', amount: round(paid * 0.1), description: 'Airtel Money' },
    { transactionCode: 'PAY-CARD', amount: paid - round(paid * 0.2) - round(paid * 0.35) - round(paid * 0.1), description: 'Card' },
    { transactionCode: 'DEP', amount: dep, description: 'Deposits on future stays' },
    { transactionCode: 'DEP-APPLY', amount: round(dep * 0.8), description: 'Deposits applied at check-in' },
  ]
  if (size !== 'small') out.push({ transactionCode: 'COMM', amount: round(gross * 0.015), description: 'Agent commission earned' })
  return out.filter((t) => t.amount > 0)
}

export const CURRENCIES: Currency[] = [
  { id: 'CUR-UGX', code: 'UGX', name: 'Uganda shilling', symbol: 'USh', decimals: 0, active: true, isBase: true },
  { id: 'CUR-USD', code: 'USD', name: 'US dollar', symbol: '$', decimals: 2, active: true, isBase: false },
  { id: 'CUR-EUR', code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, active: true, isBase: false },
  { id: 'CUR-KES', code: 'KES', name: 'Kenya shilling', symbol: 'KSh', decimals: 2, active: true, isBase: false },
  { id: 'CUR-GBP', code: 'GBP', name: 'Pound sterling', symbol: '£', decimals: 2, active: true, isBase: false },
  { id: 'CUR-RWF', code: 'RWF', name: 'Rwanda franc', symbol: 'FRw', decimals: 0, active: false, isBase: false },
  { id: 'CUR-TZS', code: 'TZS', name: 'Tanzania shilling', symbol: 'TSh', decimals: 0, active: false, isBase: false },
]

const BASE_RATE: Record<string, number> = { USD: 3705, EUR: 4021, KES: 28.7, GBP: 4688, RWF: 2.64, TZS: 1.42 }

/** Thirty days of rates, up to yesterday. Today's are entered by the hotel or fetched. */
export function seedRates(): ExchangeRate[] {
  const out: ExchangeRate[] = []
  for (const code of Object.keys(BASE_RATE)) {
    for (let d = 30; d >= 1; d--) {
      const date = shift(TODAY, -d)
      const drift = 1 + (hash01(`${code}${date}`) - 0.5) * 0.012 + (30 - d) * 0.0002
      const base = BASE_RATE[code]
      const rate = base > 100 ? Math.round(base * drift * 100) / 100 : Math.round(base * drift * 10000) / 10000
      out.push({
        id: `XR-${code}-${date}`,
        currencyCode: code,
        rateDate: date,
        rate,
        source: d % 7 === 3 ? 'Manual' : 'Bank of Uganda',
        enteredBy: d % 7 === 3 ? FIN : undefined,
        enteredAt: at(date, '08:15'),
      })
    }
  }
  return out
}

export function seedDirectBill(propertyId: string): { accounts: DirectBillAccount[]; transfers: DirectBillTransfer[]; notes: CollectionNote[] } {
  const small = scaleOf(propertyId).size === 'small'
  const created = at(shift(TODAY, -180), '10:00')
  const accounts: DirectBillAccount[] = [
    { id: `${propertyId}-DB-1`, propertyId, kind: 'corporate', sourceId: 'CA-001', name: 'Lakeside Logistics Ltd', creditLimit: 5_000_000, paymentTermsDays: 30, status: 'active', trademateCustomerCode: 'C-LAKESIDE', contactName: 'Samuel Opio', contactEmail: 'samuel.opio@lakeside-logistics.example', createdAt: created },
  ]
  if (!small)
    accounts.push(
      { id: `${propertyId}-DB-2`, propertyId, kind: 'corporate', sourceId: 'CA-004', name: 'Rwenzori Consulting Group', creditLimit: 3_000_000, paymentTermsDays: 30, status: 'on-hold', trademateCustomerCode: 'C-RWENZORI', contactName: 'Moses Byamugisha', contactEmail: 'moses@rwenzori-consulting.example', createdAt: created },
      { id: `${propertyId}-DB-3`, propertyId, kind: 'agent', sourceId: 'AG-2', name: 'Kampala Travel Bureau', creditLimit: 2_000_000, paymentTermsDays: 30, status: 'active', trademateCustomerCode: 'A-KTB', contactName: 'Agnes Nalubega', contactEmail: 'res@ktb.example', createdAt: created },
    )
  const t = (n: number, acc: number, guest: string, amount: number, ago: number, paid = 0): DirectBillTransfer => {
    const date = shift(TODAY, -ago)
    return {
      id: `${propertyId}-CL-${n}`,
      propertyId,
      accountId: `${propertyId}-DB-${acc}`,
      guest,
      invoiceNo: `CL-${propertyId.toUpperCase()}-${String(n).padStart(4, '0')}`,
      amount,
      paidAmount: paid,
      businessDate: date,
      dueDate: shift(date, 30),
      transferredAt: at(date, '11:20'),
      transferredBy: { id: 'u-desk', name: 'Rita Auma' },
      status: paid >= amount ? 'paid' : paid > 0 ? 'part-paid' : 'open',
      trademateStatus: 'accepted',
    }
  }
  const transfers: DirectBillTransfer[] = [
    t(1, 1, 'Joan Akello', 520_000, 8),
    t(2, 1, 'Samuel Opio', 400_000, 38),
    t(3, 1, 'Lakeside drivers (3 rooms)', 600_000, 70, 320_000),
    t(4, 1, 'Joan Akello', 450_000, 120, 450_000),
  ]
  if (!small)
    transfers.push(
      t(5, 2, 'Agnes Tumusiime', 1_100_000, 20),
      t(6, 2, 'Rwenzori workshop', 900_000, 50),
      t(7, 2, 'Moses Byamugisha', 1_400_000, 100),
      t(8, 3, 'Ochieng family (KTB)', 680_000, 15),
      t(9, 3, 'Müller party (KTB)', 455_000, 33),
    )
  const notes: CollectionNote[] = small
    ? []
    : [
        { id: `${propertyId}-CN-1`, propertyId, accountId: `${propertyId}-DB-2`, at: at(shift(TODAY, -10), '10:05'), by: FIN, kind: 'reminder', text: 'Statement emailed with the 90+ day invoice.' },
        { id: `${propertyId}-CN-2`, propertyId, accountId: `${propertyId}-DB-2`, at: at(shift(TODAY, -4), '15:30'), by: FIN, kind: 'promise', text: 'Moses promised part payment of UGX 1,400,000.', promisedDate: shift(TODAY, 5) },
      ]
  return { accounts, transfers, notes }
}

/** The first month of the fiscal year that contains `date`, as YYYY-MM. */
export function fiscalStart(date: string, startMonth: number): string {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const year = m >= startMonth ? y : y - 1
  return `${year}-${String(startMonth).padStart(2, '0')}`
}

export function periodsFrom(start: string, count = 12): string[] {
  const y = Number(start.slice(0, 4))
  const m = Number(start.slice(5, 7)) - 1
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m + i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

/** Monthly budget baseline for one centre, before seasonality. */
export function baselineFor(propertyId: string, centreCode: string): number {
  const { rooms, size } = scaleOf(propertyId)
  const rate = size === 'large' ? 265000 : size === 'medium' ? 180000 : 95000
  const rooms30 = rooms * 30 * 0.68 * rate
  const share: Record<string, number> = {
    ROOMS: 1,
    FB: 0.32,
    LAUNDRY: 0.03,
    SPA: 0.04,
    CONF: 0.08,
    ADMIN: 0.14,
    HK: 0.09,
    MAINT: 0.06,
    SALES: 0.04,
  }
  return round(rooms30 * (share[centreCode] ?? 0.05), 100000)
}

/** High season in July-August and December. */
export const season = (period: string) => {
  const m = Number(period.slice(5, 7))
  return m === 7 || m === 8 || m === 12 ? 1.15 : m === 4 || m === 5 ? 0.85 : 1
}

export function seedBudget(propertyId: string, centres: ProfitCentre[], startMonth: number): { budget: Budget; lines: BudgetLine[] } {
  const start = fiscalStart(TODAY, startMonth)
  const y = Number(start.slice(0, 4))
  const budget: Budget = {
    id: `${propertyId}-BG-${y}`,
    propertyId,
    name: `Budget ${y}/${String((y + 1) % 100).padStart(2, '0')}`,
    startPeriod: start,
    status: scaleOf(propertyId).size === 'large' ? 'approved' : 'draft',
    approvedBy: scaleOf(propertyId).size === 'large' ? { id: 'u-owner', name: 'Patricia Owor' } : undefined,
    approvedAt: scaleOf(propertyId).size === 'large' ? at(shift(start + '-01', -20), '16:00') : undefined,
    updatedAt: at(shift(start + '-01', -25), '12:00'),
  }
  const lines: BudgetLine[] = []
  for (const c of centres)
    for (const p of periodsFrom(start))
      lines.push({
        id: `${budget.id}-${c.code}-${p}`,
        budgetId: budget.id,
        profitCentreId: c.id,
        period: p,
        amount: round(baselineFor(propertyId, c.code) * (c.kind === 'profit' ? season(p) : 1), 100000),
      })
  return { budget, lines }
}
