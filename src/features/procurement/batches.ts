import { sameName } from './requestsModel'

/** One delivery of an item that has an expiry date. */
export interface Batch {
  id: string
  itemId: string
  item: string
  /** Units of this delivery still in the store. */
  qty: number
  /** Units that arrived. */
  received: number
  unitCost: number
  /** Last day it can be used, as yyyy-mm-dd. */
  expiry: string
  batchNo?: string
  receiptId?: string
  at: string
}

export type ExpiryState = 'expired' | 'soon' | 'ok'

/** Rule: a batch is "expiring soon" this many days before its date. The hotel admin can change it. */
export const DEFAULT_EXPIRY_WARN_DAYS = 14

const DAY = 86_400_000

/** Whole days left. Today is 0. Yesterday is -1, which means expired. */
export const daysLeft = (expiry: string, now = Date.now()) =>
  Math.floor((new Date(`${expiry}T23:59:59`).getTime() - now) / DAY)

export function expiryState(expiry: string, warn: number, now = Date.now()): ExpiryState {
  const d = daysLeft(expiry, now)
  return d < 0 ? 'expired' : d <= warn ? 'soon' : 'ok'
}

/** A message when the date cannot be received, or null when it is fine. */
export function expiryProblem(s?: string, now = Date.now()): string | null {
  if (!s) return 'enter the expiry date.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00`).getTime())) {
    return 'the expiry date is not valid.'
  }
  if (daysLeft(s, now) < 0) return 'this date has already passed, so it cannot be received.'
  return null
}

export const formatExpiry = (expiry: string) =>
  new Date(`${expiry}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** What was taken from which batch. */
export interface Draw {
  batchId: string
  batchNo?: string
  expiry: string
  qty: number
}

export const drawText = (used: Draw[]) =>
  used.map((d) => `${d.qty} from ${d.batchNo ?? d.batchId} (exp ${formatExpiry(d.expiry)})`).join(', ')

/**
 * First expired, first out: take from the batch that expires first.
 * Expired batches are skipped unless allowExpired is set (write-offs and counts).
 * rest is what the batches could not cover. It comes from stock with no date.
 */
export function drawFefo(all: Batch[], name: string, qty: number, allowExpired: boolean, now = Date.now()) {
  const order = all
    .filter((b) => b.qty > 0 && sameName(b.item, name) && (allowExpired || daysLeft(b.expiry, now) >= 0))
    .sort((a, b) => a.expiry.localeCompare(b.expiry) || a.at.localeCompare(b.at))
  let left = qty
  const used: Draw[] = []
  const taken = new Map<string, number>()
  for (const b of order) {
    if (left <= 0) break
    const t = Math.min(b.qty, left)
    left -= t
    taken.set(b.id, t)
    used.push({ batchId: b.id, batchNo: b.batchNo, expiry: b.expiry, qty: t })
  }
  const next = all.map((b) => (taken.has(b.id) ? { ...b, qty: b.qty - (taken.get(b.id) ?? 0) } : b))
  return { used, next, rest: left }
}

const dayStr = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Demo data. Floor cleaner has one batch expiring soon. Guest soap has one already expired. */
export const SAMPLE_BATCHES: Batch[] = [
  {
    id: 'BAT-9001', itemId: 's1', item: 'Floor cleaner (5L)', qty: 1, received: 6, unitCost: 45_000,
    expiry: dayStr(9), batchNo: 'FC-0412', at: new Date(Date.now() - 60 * DAY).toISOString(),
  },
  {
    id: 'BAT-9002', itemId: 's1', item: 'Floor cleaner (5L)', qty: 1, received: 6, unitCost: 45_000,
    expiry: dayStr(200), batchNo: 'FC-0519', at: new Date(Date.now() - 20 * DAY).toISOString(),
  },
  {
    id: 'BAT-9003', itemId: 's5', item: 'Guest soap box (100)', qty: 1, received: 4, unitCost: 80_000,
    expiry: dayStr(-3), batchNo: 'GS-0311', at: new Date(Date.now() - 120 * DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-CHICKEN', itemId: 'fnb-chicken', item: 'Chicken breast', qty: 12000, received: 12000, unitCost: 18,
    expiry: dayStr(4), batchNo: 'CHK-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-POTATO', itemId: 'fnb-potato', item: 'Potatoes', qty: 18000, received: 18000, unitCost: 3.5,
    expiry: dayStr(21), batchNo: 'POT-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-BEEF', itemId: 'fnb-beef', item: 'Beef mince', qty: 8000, received: 8000, unitCost: 24,
    expiry: dayStr(3), batchNo: 'BEEF-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-BUN', itemId: 'fnb-bun', item: 'Burger bun', qty: 40, received: 40, unitCost: 1200,
    expiry: dayStr(5), batchNo: 'BUN-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-FISH', itemId: 'fnb-fish', item: 'Fish fillet', qty: 6000, received: 6000, unitCost: 28,
    expiry: dayStr(2), batchNo: 'FISH-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-VEG', itemId: 'fnb-vegetables', item: 'Mixed vegetables', qty: 5000, received: 5000, unitCost: 8,
    expiry: dayStr(6), batchNo: 'VEG-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-LETTUCE', itemId: 'fnb-lettuce', item: 'Lettuce', qty: 2500, received: 2500, unitCost: 12,
    expiry: dayStr(3), batchNo: 'LET-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-TOMATO', itemId: 'fnb-tomato', item: 'Tomatoes', qty: 4000, received: 4000, unitCost: 7,
    expiry: dayStr(5), batchNo: 'TOM-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-CUCUMBER', itemId: 'fnb-cucumber', item: 'Cucumber', qty: 2000, received: 2000, unitCost: 6,
    expiry: dayStr(5), batchNo: 'CUC-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-LEMON', itemId: 'fnb-lemon', item: 'Lemon', qty: 60, received: 60, unitCost: 500,
    expiry: dayStr(14), batchNo: 'LEM-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-ORANGE', itemId: 'fnb-orange', item: 'Orange', qty: 90, received: 90, unitCost: 600,
    expiry: dayStr(10), batchNo: 'ORG-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-JUICE', itemId: 'fnb-juice-base', item: 'Juice base', qty: 5000, received: 5000, unitCost: 6,
    expiry: dayStr(8), batchNo: 'JUI-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 'BAT-FNB-MILK', itemId: 'fnb-milk', item: 'Milk', qty: 5000, received: 5000, unitCost: 5,
    expiry: dayStr(4), batchNo: 'MILK-OPEN-01', at: new Date(Date.now() - DAY).toISOString(),
  },
]