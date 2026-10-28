// Pure POS rules: outlet hours, order arithmetic, split bills and the room-charge check. No React.
import { targetFor } from '../../lib/routing'
import type { Reservation } from '../../types'
import type { FolioControl, PosOutlet, PosTable, TableStatus } from '../../services/pos/posTypes'
import type { HeldOrder, Line, Product } from './posTypes'

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** True when the time falls inside the outlet's hours, including hours that run past midnight. */
export function withinHours(outlet: Pick<PosOutlet, 'opensAt' | 'closesAt'>, hhmm: string): boolean {
  const open = minutesOf(outlet.opensAt)
  const close = minutesOf(outlet.closesAt)
  const t = minutesOf(hhmm)
  if (open === close) return true
  return open < close ? t >= open && t < close : t >= open || t < close
}

export function hhmmOf(at: number | Date): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const hoursLabel = (o: Pick<PosOutlet, 'opensAt' | 'closesAt'>) => (o.opensAt === o.closesAt ? 'Open 24 hours' : `${o.opensAt} to ${o.closesAt}`)

// ---------------------------------------------------------------- order arithmetic

const clampPct = (n: number | undefined) => Math.min(100, Math.max(0, Number(n) || 0))

/** Price of one unit: the menu (or combo share) price plus every chosen add-on. */
export function unitPriceOf(line: Line, product: Product): number {
  return (line.unitPrice ?? product.price) + (line.modifiers ?? []).reduce((s, m) => s + m.price, 0)
}

export function lineGross(line: Line, product: Product): number {
  return unitPriceOf(line, product) * line.qty
}

export function lineDiscountOf(line: Line, product: Product): number {
  return Math.round((lineGross(line, product) * clampPct(line.discountPercent)) / 100)
}

export type PricedLine = Line & { product: Product }

export type OrderTotals = {
  subtotal: number
  lineDiscounts: number
  orderDiscount: number
  discount: number
  serviceCharge: number
  tip: number
  total: number
}

export function orderTotals(lines: PricedLine[], orderDiscountPercent: number, serviceChargePercent: number, tip: number): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + lineGross(l, l.product), 0)
  const lineDiscounts = lines.reduce((s, l) => s + lineDiscountOf(l, l.product), 0)
  const afterLines = Math.max(0, subtotal - lineDiscounts)
  const orderDiscount = Math.min(afterLines, Math.round((afterLines * clampPct(orderDiscountPercent)) / 100))
  const discount = lineDiscounts + orderDiscount
  const net = Math.max(0, subtotal - discount)
  const serviceCharge = Math.round((net * clampPct(serviceChargePercent)) / 100)
  const safeTip = Math.max(0, Math.round(Number(tip) || 0))
  return { subtotal, lineDiscounts, orderDiscount, discount, serviceCharge, tip: safeTip, total: net + serviceCharge + safeTip }
}

/** The biggest discount on the order as a share of what it was before, to test against the outlet's limit. */
export function largestDiscountPercent(lines: Line[], orderDiscountPercent: number): number {
  return Math.max(clampPct(orderDiscountPercent), ...lines.map((l) => clampPct(l.discountPercent)))
}

// ---------------------------------------------------------------- split bills

export type SplitPart = {
  label: string
  lineIds: string[]
  subtotal: number
  discount: number
  serviceCharge: number
  tip: number
  total: number
}

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Shares an amount out by weights so the parts add up to exactly the whole. */
function share(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? amount : 0))
  const parts = weights.map((w) => Math.floor((amount * w) / sum))
  let rest = amount - parts.reduce((s, p) => s + p, 0)
  for (let i = parts.length - 1; rest > 0 && i >= 0; i--, rest--) parts[i] += 1
  return parts
}

function build(groups: { label: string; lineIds: string[]; weight: number }[], totals: OrderTotals): SplitPart[] {
  const weights = groups.map((g) => g.weight)
  const subtotal = share(totals.subtotal, weights)
  const discount = share(totals.discount, weights)
  const service = share(totals.serviceCharge, weights)
  const tip = share(totals.tip, weights)
  return groups.map((g, i) => ({
    label: g.label,
    lineIds: g.lineIds,
    subtotal: subtotal[i],
    discount: discount[i],
    serviceCharge: service[i],
    tip: tip[i],
    total: subtotal[i] - discount[i] + service[i] + tip[i],
  }))
}

export function splitEqually(totals: OrderTotals, ways: number): SplitPart[] {
  const n = Math.max(2, Math.min(20, Math.round(ways)))
  return build(Array.from({ length: n }, (_, i) => ({ label: LABELS[i], lineIds: [], weight: 1 })), totals)
}

/** One check per assigned label; each check carries the net value of its own lines. */
export function splitByAssignment(lines: PricedLine[], assign: Record<string, string>, totals: OrderTotals): SplitPart[] {
  const labels = [...new Set(lines.map((l) => assign[l.lineId ?? ''] ?? 'A'))].sort()
  const groups = labels.map((label) => {
    const own = lines.filter((l) => (assign[l.lineId ?? ''] ?? 'A') === label)
    return {
      label,
      lineIds: own.map((l) => l.lineId ?? l.productId),
      weight: own.reduce((s, l) => s + lineGross(l, l.product) - lineDiscountOf(l, l.product), 0),
    }
  })
  return build(groups, totals)
}

export function splitBySeat(lines: PricedLine[], totals: OrderTotals): SplitPart[] {
  const assign: Record<string, string> = {}
  for (const l of lines) assign[l.lineId ?? ''] = `Seat ${l.seat ?? 1}`
  return splitByAssignment(lines, assign, totals)
}

// ---------------------------------------------------------------- tables

/** What the floor plan shows: a cleaning or bill-asked flag wins, then an open order, then seated. */
export function tableStatusOf(table: PosTable, orders: HeldOrder[], outletName: string): TableStatus {
  if (table.status === 'cleaning' || table.status === 'billAsked') return table.status
  if (orders.some((o) => o.outlet === outletName && o.orderType === 'Dine-in' && o.table === table.name)) return 'ordered'
  return table.status
}

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  free: 'Free',
  seated: 'Seated',
  ordered: 'Ordered',
  billAsked: 'Bill asked',
  cleaning: 'Needs cleaning',
}

// ---------------------------------------------------------------- charge to room

/** With no rule from the desk, how far a folio may run on F&B, by what secures the stay. */
export const GUARANTEE_LIMIT: Record<string, number> = { company: 3_000_000, card: 1_500_000, deposit: 600_000, none: 0 }

export type RoomChargeCheck =
  | { ok: true; reservation: Reservation; postTo: Reservation; routedTo?: string; balanceAfter: number; limit: number }
  | { ok: false; reasons: string[] }

/**
 * Whether this bill may go on this guest's folio now. Every reason is returned, not just the first,
 * so the cashier can tell the guest exactly what to sort out at the desk.
 */
export function checkRoomCharge(
  reservation: Reservation | undefined,
  all: Reservation[],
  amount: number,
  category: string,
  control: FolioControl | undefined,
): RoomChargeCheck {
  if (!reservation) return { ok: false, reasons: ['Choose an in-house guest'] }
  const reasons: string[] = []
  if (reservation.status === 'booked') reasons.push('Not checked in yet')
  else if (reservation.status === 'checked-out') reasons.push('Already checked out')
  else if (reservation.status !== 'in-house') reasons.push(`Stay is ${reservation.status}`)
  if (reservation.invoice || reservation.checkedOutAt) reasons.push('Folio is closed: the invoice has been issued')
  if (control && !control.postingAllowed) reasons.push(control.reason ? `Posting stopped by the desk: ${control.reason}` : 'Posting stopped by the desk')
  if (control?.allowCategories && !control.allowCategories.includes(category)) reasons.push(`${category} charges are not allowed on this folio`)

  const rule = targetFor(reservation.routing, category)
  let postTo = reservation
  if (rule) {
    const target = all.find((r) => r.id === rule.toReservationId)
    if (!target || target.status !== 'in-house') reasons.push(`Routing sends ${category} to ${rule.toGuest}, whose stay is not open`)
    else postTo = target
  }
  const limit = control?.creditLimit ?? GUARANTEE_LIMIT[postTo.guarantee ?? 'none'] ?? 0
  const balanceAfter = postTo.total - postTo.paid + amount
  if (limit <= 0) reasons.push('No card, deposit or company guarantee: room charges need one')
  else if (balanceAfter > limit) reasons.push(`Over the credit limit: the balance would be ${Math.round(balanceAfter).toLocaleString('en-US')} of ${limit.toLocaleString('en-US')} allowed`)
  if (!(amount > 0)) reasons.push('Nothing to charge')

  if (reasons.length) return { ok: false, reasons }
  return { ok: true, reservation, postTo, routedTo: rule && postTo.id !== reservation.id ? postTo.guest : undefined, balanceAfter, limit }
}
