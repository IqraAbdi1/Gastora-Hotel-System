import { commissionOf } from '../../lib/agents'
import { nightsOf } from '../../lib/booking'
import { folioOf } from '../../lib/folio'
import { dayMonth } from '../../lib/format'
import { auditReport } from '../../lib/nightAudit'
import type { TaxSettings } from '../../lib/tax'
import { SERVICE_CATEGORY, TAX_CATEGORY } from '../../lib/tax'
import type { Reservation, Room } from '../../types'
import type { HeldOrder, Sale } from '../pos/posTypes'
import type { AuditCheck, AuditException, DirectBillTransfer, SourceTransaction } from '../../services/accounting/accountingTypes'

// The day's hotel transactions, read from the folios, the POS and the city ledger, ready for the
// posting rules. Pure functions: no React, no storage.

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day of a stamp written either as "YYYY-MM-DD HH:MM" or as an ISO time. */
export function dayOf(stamp: string | undefined): string {
  if (!stamp) return ''
  if (stamp.includes('T')) {
    const d = new Date(stamp)
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return stamp.slice(0, 10)
}

const CATEGORY_CODE: Record<string, string> = {
  Restaurant: 'FB-REST',
  Bar: 'FB-BAR',
  Minibar: 'MINIBAR',
  Laundry: 'LAUNDRY',
  Transport: 'TRANSPORT',
  Spa: 'SPA',
}

export function chargeCode(category: string, description: string): string {
  if (category === SERVICE_CATEGORY) return 'SVC'
  if (category === TAX_CATEGORY) {
    if (/vat/i.test(description)) return 'VAT'
    if (/local hotel tax/i.test(description)) return 'LHT'
    return 'TAX-OTHER'
  }
  return CATEGORY_CODE[category] ?? 'OTHER'
}

export function paymentCode(method: string): string {
  const m = method.toLowerCase()
  if (m.includes('mtn') || m.includes('momo') || m.includes('mobile')) return 'PAY-MTN'
  if (m.includes('airtel')) return 'PAY-AIRTEL'
  if (m.includes('card')) return 'PAY-CARD'
  if (m.includes('bank')) return 'PAY-BANK'
  return 'PAY-CASH'
}

/** Payment methods named the way the hotel speaks of them, for the cash position. */
export const METHOD_LABEL: Record<string, string> = {
  'PAY-CASH': 'Cash',
  'PAY-MTN': 'MTN MoMo',
  'PAY-AIRTEL': 'Airtel Money',
  'PAY-CARD': 'Card',
  'PAY-BANK': 'Bank transfer',
}

const CITY_LEDGER = 'City ledger'
export const isCityLedger = (method: string) => method === CITY_LEDGER
export const CITY_LEDGER_METHOD = CITY_LEDGER

/** One night of a stay: the room charge spread evenly over the nights. */
export function nightlyOf(r: Reservation): number {
  const nights = Math.max(1, nightsOf(r.arrival, r.departure))
  return Math.round(folioOf(r).roomCharge / nights)
}

export interface DaySource {
  source: SourceTransaction[]
  roomRevenue: number
  totalRevenue: number
  /** Money taken today, by payment code. */
  takings: Record<string, number>
}

export function daySource(
  date: string,
  reservations: Reservation[],
  sales: Sale[],
  transfers: DirectBillTransfer[],
  tax: TaxSettings | null,
): DaySource {
  const out: SourceTransaction[] = []
  const add = (transactionCode: string, amount: number, description: string, reference?: string) => {
    if (amount) out.push({ transactionCode, amount: Math.round(amount), description, reference })
  }
  const vatInside = tax && tax.vatOn && tax.vatMode === 'included' ? tax.vatRate : 0
  let roomRevenue = 0

  for (const r of reservations) {
    // A night is earned by every stay in the house on this date.
    const stayed = (r.status === 'in-house' || r.status === 'checked-out') && r.arrival <= date && date < r.departure
    const leftEarly = r.status === 'checked-out' && dayOf(r.checkedOutAt) < date
    if (stayed && !leftEarly) {
      const night = nightlyOf(r)
      const vat = vatInside ? Math.round((night * vatInside) / (1 + vatInside)) : 0
      add('ROOM', night - vat, `Room ${r.room ?? '?'} ${r.guest}`, r.id)
      add('VAT', vat, `VAT inside room ${r.room ?? '?'}`, r.id)
      roomRevenue += night - vat
    }
    // Deposits taken before arrival move to the guest's bill on the day they check in.
    if ((r.status === 'in-house' || r.status === 'checked-out') && r.arrival === date) {
      const earlier = folioOf(r).earlier
      add('DEP-APPLY', earlier, `Deposit applied, ${r.guest}`, r.id)
    }
    if (r.status === 'booked' && r.bookedAt === date && r.paid > 0) add('DEP', r.paid, `Deposit from ${r.guest}`, r.id)

    for (const c of r.charges ?? [])
      if (dayOf(c.at) === date && !c.routedFrom) add(chargeCode(c.category, c.description), c.amount, c.description, r.id)
    for (const p of r.payments ?? []) {
      if (dayOf(p.at) !== date || isCityLedger(p.method)) continue
      if (p.amount < 0) add('REFUND', -p.amount, `Refund to ${r.guest}`, r.id)
      else add(paymentCode(p.method), p.amount, `${p.method} from ${r.guest}`, r.id)
    }
    if (r.status === 'checked-out' && dayOf(r.checkedOutAt) === date) {
      const c = commissionOf(r)
      if (c.state === 'earned' && r.agent && !r.agent.collectsPayment) add('COMM', c.amount, `Commission to ${r.agent.name}`, r.id)
    }
  }

  // POS sales settled at the till. Sales charged to a room are on the folio already.
  for (const s of sales) {
    if (dayOf(s.createdAt) !== date || s.payment === 'Room charge') continue
    add(s.outlet === 'Bar' ? 'FB-BAR' : 'FB-REST', s.total, `${s.outlet} sale ${s.id}`, s.id)
    add(paymentCode(s.payment), s.total, `${s.payment} at the ${s.outlet.toLowerCase()}`, s.id)
  }

  for (const t of transfers) if (t.businessDate === date) add('CL-TRF', t.amount, `${t.invoiceNo} ${t.guest}`, t.invoiceNo)

  const NOT_REVENUE = /^(PAY-|DEP|REFUND|COMM|CL-TRF)/
  const totalRevenue = out.filter((t) => !NOT_REVENUE.test(t.transactionCode)).reduce((n, t) => n + t.amount, 0)
  const takings: Record<string, number> = {}
  for (const t of out) if (t.transactionCode.startsWith('PAY-')) takings[t.transactionCode] = (takings[t.transactionCode] ?? 0) + t.amount
  return { source: out, roomRevenue, totalRevenue, takings }
}

/** What has already gone to the city ledger from one stay's bill. */
export const transferredFrom = (transfers: DirectBillTransfer[], reservationId: string) =>
  transfers.filter((t) => t.reservationId === reservationId).reduce((n, t) => n + t.amount, 0)

export type LiveException = Omit<AuditException, 'id' | 'propertyId' | 'businessDate' | 'status' | 'nightAuditId'> & {
  reservationId?: string
}

/** Problems that should be dealt with before the day closes. */
export function liveExceptions(
  date: string,
  reservations: Reservation[],
  rooms: Room[],
  held: HeldOrder[],
  transfers: DirectBillTransfer[],
): LiveException[] {
  const out: LiveException[] = []
  const report = auditReport(reservations, rooms, date)
  for (const i of report.items) {
    if (i.kind === 'not-departed' && i.reservation)
      out.push({ key: `overstay|${i.reservation.id}`, kind: 'overstay', severity: 'block', reference: i.reservation.id, description: `${i.reservation.guest}, room ${i.reservation.room ?? '?'}: due out ${dayMonth(i.reservation.departure)}`, amount: i.amount, reservationId: i.reservation.id })
    if (i.kind === 'not-arrived' && i.reservation)
      out.push({ key: `no-show|${i.reservation.id}`, kind: 'no-show', severity: 'warn', reference: i.reservation.id, description: `${i.reservation.guest}: due ${dayMonth(i.reservation.arrival)}, becomes a no-show at close`, amount: i.reservation.paid || undefined, reservationId: i.reservation.id })
    if (i.kind === 'dirty-occupied' && i.room)
      out.push({ key: `unposted-room|${i.room}`, kind: 'unposted-room', severity: 'block', reference: `Room ${i.room}`, description: `Room ${i.room} is occupied with no stay to post tonight's charge to` })
  }
  for (const r of reservations) {
    if (r.status === 'in-house' && r.arrival <= date && date < r.departure && nightlyOf(r) <= 0)
      out.push({ key: `unposted-room|${r.id}`, kind: 'unposted-room', severity: 'block', reference: r.id, description: `${r.guest}: no room rate to post`, reservationId: r.id })
    if (r.status === 'checked-out' && dayOf(r.checkedOutAt) === date) {
      const bal = folioOf(r).balance - transferredFrom(transfers, r.id)
      if (bal !== 0)
        out.push({ key: `unbalanced-folio|${r.id}`, kind: 'unbalanced-folio', severity: 'warn', reference: r.id, description: `${r.guest} left with ${bal > 0 ? 'a balance owing' : 'a credit'}`, amount: bal, reservationId: r.id })
    }
  }
  for (const o of held) {
    if (o.paidAt || o.cancelledAt || o.kitchenStatus === 'Cancelled') continue
    if (dayOf(o.createdAt) > date) continue
    const where = o.table ? `table ${o.table}` : o.room ? `room ${o.room}` : o.orderType.toLowerCase()
    out.push({ key: `open-pos-check|${o.id}`, kind: 'open-pos-check', severity: 'warn', reference: `${o.outlet} ${o.id}`, description: `${o.outlet} check open, ${where}${o.customer ? `, ${o.customer}` : ''}` })
  }
  return out
}

export const EXCEPTION_LABEL: Record<AuditException['kind'], string> = {
  'unbalanced-folio': 'Unbalanced folio',
  'unposted-room': 'Unposted room charge',
  'open-pos-check': 'Open POS check',
  'no-show': 'No-show',
  overstay: 'Past departure',
}

/** The checklist the close runs. Required items stop it; the rest are warnings. */
export function auditChecks(args: {
  exceptions: (LiveException & { waived: boolean })[]
  postingErrors: string[]
  balanced: boolean
  hasLines: boolean
  ratesMissing: string[] | null
  previousRejected: number
  frontDeskDone: boolean
}): AuditCheck[] {
  const { exceptions } = args
  const count = (k: AuditException['kind'], openOnly = true) => exceptions.filter((e) => e.kind === k && (!openOnly || !e.waived)).length
  const checks: AuditCheck[] = [
    { key: 'departures', label: 'Departures checked out', required: true, passed: count('overstay') === 0, detail: count('overstay') ? `${count('overstay')} past departure` : 'All out' },
    { key: 'rooms', label: 'Room charges postable', required: true, passed: count('unposted-room') === 0, detail: count('unposted-room') ? `${count('unposted-room')} cannot post` : 'Every occupied room has a stay' },
    { key: 'folios', label: 'Folios balanced at checkout', required: true, passed: count('unbalanced-folio') === 0, detail: count('unbalanced-folio') ? `${count('unbalanced-folio')} open; transfer or accept` : 'Balanced' },
    { key: 'arrivals', label: 'Arrivals settled', required: false, passed: count('no-show', false) === 0, detail: count('no-show', false) ? `${count('no-show', false)} become no-shows` : 'All arrived' },
    { key: 'pos', label: 'POS checks closed', required: false, passed: count('open-pos-check') === 0, detail: count('open-pos-check') ? `${count('open-pos-check')} open` : 'All closed' },
    { key: 'rules', label: 'Posting rules complete', required: true, passed: args.postingErrors.length === 0, detail: args.postingErrors[0] ?? 'Every transaction maps to Trademate' },
    { key: 'balance', label: 'Journal balances', required: true, passed: args.balanced && args.hasLines, detail: !args.hasLines ? 'No transactions' : args.balanced ? 'Debits equal credits' : 'Out of balance' },
    { key: 'previous', label: 'Earlier journals accepted', required: false, passed: args.previousRejected === 0, detail: args.previousRejected ? `${args.previousRejected} rejected by Trademate` : 'None waiting' },
    { key: 'desk', label: 'Front desk audit', required: false, passed: args.frontDeskDone, detail: args.frontDeskDone ? 'Done' : 'Recorded by this close' },
  ]
  if (args.ratesMissing)
    checks.push({ key: 'rates', label: "Today's exchange rates", required: false, passed: args.ratesMissing.length === 0, detail: args.ratesMissing.length ? `Missing ${args.ratesMissing.join(', ')}` : 'Entered' })
  return checks
}
