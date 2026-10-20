import { daySeries, debtorBands, debtors, nightlyOf } from '../../lib/dashboard'
import { soldNight } from '../../lib/pace'
import { isTaxCategory } from '../../lib/tax'
import type { Reservation } from '../../types'
import type { ReportFacts } from './facts'
import type { CostProfile } from './reportsTypes'

// Every management figure, worked out from the hotel's own records. Pure functions, no React.
// GOP is the one figure that needs costs; those come from the cost profile, which is sample data
// until the accounting side is connected.

export type Range = { from: string; to: string }
export type RangePreset = 'today' | 'yesterday' | '7' | '30' | 'mtd' | 'next7' | 'next30'
export type CompareMode = 'previous' | 'lastYear'

export const RANGE_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  mtd: 'Month to date',
  next7: 'Next 7 days',
  next30: 'Next 30 days',
}

export const addDays = (date: string, by: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

export function daysOf(range: Range): string[] {
  const out: string[] = []
  for (let d = range.from; d <= range.to && out.length < 800; d = addDays(d, 1)) out.push(d)
  return out
}

export function rangeFor(preset: RangePreset, today: string): Range {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7':
      return { from: addDays(today, -6), to: today }
    case '30':
      return { from: addDays(today, -29), to: today }
    case 'mtd':
      return { from: `${today.slice(0, 8)}01`, to: today }
    case 'next7':
      return { from: addDays(today, 1), to: addDays(today, 7) }
    case 'next30':
      return { from: addDays(today, 1), to: addDays(today, 30) }
  }
}

/** The range to hold this one against: the same number of days just before, or the same days a year ago. */
export function compareRange(range: Range, mode: CompareMode): Range {
  if (mode === 'lastYear') return { from: addDays(range.from, -364), to: addDays(range.to, -364) }
  const n = daysOf(range).length
  return { from: addDays(range.from, -n), to: addDays(range.from, -1) }
}

export const inRange = (day: string | undefined, r: Range) => !!day && day >= r.from && day <= r.to

const soldStatus = (r: Reservation) => r.status === 'in-house' || r.status === 'checked-out'
const liveStatus = (r: Reservation) => soldStatus(r) || r.status === 'booked'

/** Nights of a stay that fall inside the range. Future nights count bookings; past nights count stays that happened. */
export function nightsInRange(r: Reservation, range: Range, today: string): string[] {
  const out: string[] = []
  for (let d = r.arrival > range.from ? r.arrival : range.from; d < r.departure && d <= range.to; d = addDays(d, 1)) {
    if (d > today ? liveStatus(r) : soldStatus(r)) out.push(d)
  }
  return out
}

export const folioLink = (id: string) => `/desk/folios?r=${id}`

export function segmentOf(r: Reservation): string {
  if (r.corporate) return 'Company'
  if (r.group) return 'Group'
  switch (r.source) {
    case 'ota':
      return r.channel?.name ?? 'Online travel agents'
    case 'online':
      return 'Own website'
    case 'agent':
      return 'Travel agents'
    case 'walk-in':
      return 'Walk-in'
    case 'phone':
    case 'email':
      return 'Phone and email'
    case 'front desk':
      return 'Front desk'
    default:
      return 'Other'
  }
}

export interface PaymentEntry {
  id: string
  date: string
  reference: string
  guest: string
  kind: 'Deposit' | 'Payment' | 'Till'
  method: string
  amount: number
  to: string
}

/**
 * Every amount of money the hotel received. A deposit taken before the folio existed has no time of its
 * own, so it is dated the day the booking was taken.
 */
export function paymentsOf(facts: ReportFacts): PaymentEntry[] {
  const out: PaymentEntry[] = []
  for (const r of facts.reservations) {
    const received = (r.payments ?? []).reduce((n, p) => n + p.amount, 0)
    const deposit = r.paid - received
    if (deposit > 0)
      out.push({ id: `${r.id}-dep`, date: r.bookedAt ?? r.arrival, reference: r.id, guest: r.guest, kind: 'Deposit', method: 'Deposit', amount: deposit, to: folioLink(r.id) })
    for (const p of r.payments ?? [])
      out.push({ id: `${r.id}-${p.id}`, date: p.at.slice(0, 10), reference: r.id, guest: r.guest, kind: 'Payment', method: p.method, amount: p.amount, to: folioLink(r.id) })
  }
  for (const s of facts.sales) {
    if (s.payment === 'Room charge') continue
    out.push({ id: s.id, date: s.createdAt.slice(0, 10), reference: s.id, guest: s.outlet, kind: 'Till', method: s.payment, amount: s.total, to: '/pos/payments' })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export interface ChargeEntry {
  id: string
  date: string
  reservation: string
  guest: string
  category: string
  description: string
  amount: number
  to: string
}

export function chargesOf(facts: ReportFacts): ChargeEntry[] {
  return facts.reservations
    .flatMap((r) =>
      (r.charges ?? [])
        .filter((c) => !isTaxCategory(c.category))
        .map((c) => ({ id: `${r.id}-${c.id}`, date: c.at.slice(0, 10), reservation: r.id, guest: r.guest, category: c.category, description: c.description, amount: c.amount, to: folioLink(r.id) })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}

export interface ExecKpis {
  available: number
  sold: number
  occupancy: number
  adr: number
  revpar: number
  trevpar: number
  roomRevenue: number
  fnbRevenue: number
  extrasRevenue: number
  totalRevenue: number
  costs: number
  gop: number
  goppar: number
  gopMargin: number
  cancellations: number
  cancelledValue: number
  cash: number
}

export function costsFor(sellable: number, occupied: number, fnb: number, total: number, c: CostProfile) {
  return {
    payroll: sellable * c.payrollPerRoomDay,
    utilities: sellable * c.utilitiesPerRoomDay,
    rooms: occupied * c.costPerOccupiedRoom,
    fnb: Math.round((fnb * c.fnbCostPercent) / 100),
    other: Math.round((total * c.otherCostPercent) / 100),
  }
}

export function cancellationsIn(facts: ReportFacts, range: Range): Reservation[] {
  return facts.reservations.filter(
    (r) => (r.status === 'cancelled' || r.status === 'no-show') && inRange(r.cancellation?.at?.slice(0, 10) ?? r.arrival, range),
  )
}

export function execKpis(facts: ReportFacts, range: Range, cost: CostProfile | null): ExecKpis {
  const points = daySeries(daysOf(range), facts.reservations, facts.rooms, facts.sales, facts.today)
  const available = points.reduce((n, p) => n + p.sellable, 0)
  const sold = points.reduce((n, p) => n + p.occupied, 0)
  const roomRevenue = points.reduce((n, p) => n + p.rooms, 0)
  const fnbRevenue = points.reduce((n, p) => n + p.pos, 0)
  const extrasRevenue = points.reduce((n, p) => n + p.extras, 0)
  const totalRevenue = roomRevenue + fnbRevenue + extrasRevenue
  let costs = 0
  if (cost)
    for (const p of points) {
      const c = costsFor(p.sellable, p.occupied, p.pos, p.rooms + p.pos + p.extras, cost)
      costs += c.payroll + c.utilities + c.rooms + c.fnb + c.other
    }
  const gop = totalRevenue - costs
  const cancelled = cancellationsIn(facts, range)
  const cash = paymentsOf(facts)
    .filter((p) => inRange(p.date, range))
    .reduce((n, p) => n + p.amount, 0)
  return {
    available,
    sold,
    occupancy: available ? Math.round((sold / available) * 1000) / 10 : 0,
    adr: sold ? Math.round(roomRevenue / sold) : 0,
    revpar: available ? Math.round(roomRevenue / available) : 0,
    trevpar: available ? Math.round(totalRevenue / available) : 0,
    roomRevenue,
    fnbRevenue,
    extrasRevenue,
    totalRevenue,
    costs,
    gop,
    goppar: available ? Math.round(gop / available) : 0,
    gopMargin: totalRevenue ? Math.round((gop / totalRevenue) * 100) : 0,
    cancellations: cancelled.length,
    cancelledValue: cancelled.reduce((n, r) => n + (r.cancellation?.charge ?? 0), 0),
    cash,
  }
}

/** Bookings taken in the last `days` days, for any stay. */
export function pickupList(facts: ReportFacts, days = 7): Reservation[] {
  const since = addDays(facts.today, -days)
  return facts.reservations.filter((r) => liveStatus(r) && !!r.bookedAt && r.bookedAt > since && r.bookedAt <= facts.today)
}

export interface Pace {
  onBooks: number
  lastYear: number
  revenue: number
  lastYearRevenue: number
  stays: Reservation[]
}

/** Room nights on the books for the next `horizon` nights, against what was on the books a year ago for the same nights. */
export function paceVsLastYear(facts: ReportFacts, horizon = 30): Pace {
  const lyToday = addDays(facts.today, -364)
  let onBooks = 0
  let lastYear = 0
  let revenue = 0
  let lastYearRevenue = 0
  const stays = new Set<Reservation>()
  for (let i = 0; i < horizon; i++) {
    const night = addDays(facts.today, i)
    const lyNight = addDays(lyToday, i)
    onBooks += soldNight(facts.reservations, night)
    lastYear += soldNight(facts.reservations, lyNight, lyToday)
    for (const r of facts.reservations) {
      if (liveStatus(r) && r.arrival <= night && night < r.departure) {
        revenue += nightlyOf(r)
        stays.add(r)
      }
      if (liveStatus(r) && r.arrival <= lyNight && lyNight < r.departure && (!r.bookedAt || r.bookedAt <= lyToday)) lastYearRevenue += nightlyOf(r)
    }
  }
  return { onBooks, lastYear, revenue, lastYearRevenue, stays: [...stays].sort((a, b) => a.arrival.localeCompare(b.arrival)) }
}

export interface MixRow {
  label: string
  bookings: number
  nights: number
  revenue: number
  share: number
  stays: Reservation[]
}

export function channelMix(facts: ReportFacts, range: Range): MixRow[] {
  const map = new Map<string, MixRow>()
  for (const r of facts.reservations) {
    const nights = nightsInRange(r, range, facts.today)
    if (nights.length === 0) continue
    const key = segmentOf(r)
    const row = map.get(key) ?? { label: key, bookings: 0, nights: 0, revenue: 0, share: 0, stays: [] }
    row.bookings += 1
    row.nights += nights.length
    row.revenue += nights.length * nightlyOf(r)
    row.stays.push(r)
    map.set(key, row)
  }
  const rows = [...map.values()]
  const total = rows.reduce((n, r) => n + r.nights, 0)
  for (const r of rows) r.share = total ? Math.round((r.nights / total) * 100) : 0
  return rows.sort((a, b) => b.nights - a.nights)
}

export function cashPosition(facts: ReportFacts, range: Range) {
  const collected = paymentsOf(facts).filter((p) => inRange(p.date, range))
  const owed = debtors(facts.reservations, facts.today)
  return {
    collected: collected.reduce((n, p) => n + p.amount, 0),
    entries: collected,
    guestDebt: owed.reduce((n, d) => n + d.owed, 0),
    companyDebt: facts.accounts.reduce((n, a) => n + a.outstandingBalance, 0),
    bands: debtorBands(owed),
    debtors: owed,
  }
}

/** One line behind a figure: the booking, charge, payment, sale or cost it came from. */
export interface DrillRow {
  id: string
  date: string
  kind: string
  ref: string
  name: string
  detail: string
  amount: number
  /** The page the record lives on, when there is one. */
  to?: string
}

export type KpiKey =
  | 'occupancy'
  | 'adr'
  | 'revpar'
  | 'trevpar'
  | 'gop'
  | 'goppar'
  | 'pickup'
  | 'pace'
  | 'cancellations'
  | 'channel'
  | 'cash'

function stayRows(facts: ReportFacts, range: Range, stays?: Reservation[]): DrillRow[] {
  const out: DrillRow[] = []
  for (const r of stays ?? facts.reservations) {
    const nights = nightsInRange(r, range, facts.today)
    if (nights.length === 0) continue
    out.push({
      id: r.id,
      date: nights[0],
      kind: 'Reservation',
      ref: r.id,
      name: r.guest,
      detail: `${nights.length} night${nights.length === 1 ? '' : 's'} · ${r.roomType}${r.room ? ` ${r.room}` : ''} · ${r.status}`,
      amount: nights.length * nightlyOf(r),
      to: folioLink(r.id),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

function reservationRow(r: Reservation, amount: number, detail: string, date: string): DrillRow {
  return { id: r.id, date, kind: 'Reservation', ref: r.id, name: r.guest, detail, amount, to: folioLink(r.id) }
}

export function drill(
  facts: ReportFacts,
  kpi: KpiKey,
  range: Range,
  cost: CostProfile | null,
  segment?: string,
): { title: string; rows: DrillRow[] } {
  switch (kpi) {
    case 'occupancy':
    case 'adr':
    case 'revpar':
      return { title: 'Room nights behind the figure', rows: stayRows(facts, range) }
    case 'trevpar': {
      const rows = stayRows(facts, range)
      for (const c of chargesOf(facts).filter((c) => inRange(c.date, range)))
        rows.push({ id: c.id, date: c.date, kind: 'Charge', ref: c.reservation, name: c.guest, detail: `${c.category} · ${c.description}`, amount: c.amount, to: c.to })
      for (const s of facts.sales.filter((s) => inRange(s.createdAt.slice(0, 10), range)))
        rows.push({ id: s.id, date: s.createdAt.slice(0, 10), kind: s.sample ? 'Till sale (sample)' : 'Till sale', ref: s.id, name: s.outlet, detail: `${s.items} item${s.items === 1 ? '' : 's'} · ${s.payment}`, amount: s.total, to: s.sample ? undefined : '/pos/payments' })
      return { title: 'All revenue in the period', rows: rows.sort((a, b) => a.date.localeCompare(b.date)) }
    }
    case 'gop':
    case 'goppar': {
      const points = daySeries(daysOf(range), facts.reservations, facts.rooms, facts.sales, facts.today)
      const sum = (f: (p: (typeof points)[number]) => number) => points.reduce((n, p) => n + f(p), 0)
      const rows: DrillRow[] = [
        { id: 'rev-rooms', date: range.from, kind: 'Revenue', ref: 'Rooms', name: 'Room revenue', detail: 'From bookings', amount: sum((p) => p.rooms) },
        { id: 'rev-fnb', date: range.from, kind: 'Revenue', ref: 'F&B', name: 'Food and drink', detail: facts.salesAreSample ? 'Sample till history' : 'From the till', amount: sum((p) => p.pos) },
        { id: 'rev-extras', date: range.from, kind: 'Revenue', ref: 'Extras', name: 'Extras', detail: 'From folios', amount: sum((p) => p.extras) },
      ]
      if (cost) {
        const t = { payroll: 0, utilities: 0, rooms: 0, fnb: 0, other: 0 }
        for (const p of points) {
          const c = costsFor(p.sellable, p.occupied, p.pos, p.rooms + p.pos + p.extras, cost)
          t.payroll += c.payroll
          t.utilities += c.utilities
          t.rooms += c.rooms
          t.fnb += c.fnb
          t.other += c.other
        }
        rows.push(
          { id: 'c-pay', date: range.from, kind: 'Cost (sample)', ref: 'Payroll', name: 'Payroll', detail: `${cost.payrollPerRoomDay.toLocaleString('en-US')} per room per day`, amount: -t.payroll },
          { id: 'c-util', date: range.from, kind: 'Cost (sample)', ref: 'Utilities', name: 'Power and water', detail: `${cost.utilitiesPerRoomDay.toLocaleString('en-US')} per room per day`, amount: -t.utilities },
          { id: 'c-rooms', date: range.from, kind: 'Cost (sample)', ref: 'Rooms', name: 'Room supplies and laundry', detail: `${cost.costPerOccupiedRoom.toLocaleString('en-US')} per occupied room`, amount: -t.rooms },
          { id: 'c-fnb', date: range.from, kind: 'Cost (sample)', ref: 'F&B', name: 'Cost of food and drink', detail: `${cost.fnbCostPercent}% of F&B`, amount: -t.fnb },
          { id: 'c-other', date: range.from, kind: 'Cost (sample)', ref: 'Other', name: 'Other operating costs', detail: `${cost.otherCostPercent}% of revenue`, amount: -t.other },
        )
      }
      return { title: 'Revenue less operating costs', rows }
    }
    case 'pickup':
      return {
        title: 'Bookings taken in the last 7 days',
        rows: pickupList(facts).map((r) => reservationRow(r, r.total, `${r.arrival} to ${r.departure} · ${segmentOf(r)}`, r.bookedAt ?? r.arrival)),
      }
    case 'pace': {
      const p = paceVsLastYear(facts)
      return {
        title: 'On the books for the next 30 nights',
        rows: stayRows(facts, { from: facts.today, to: addDays(facts.today, 29) }, p.stays),
      }
    }
    case 'cancellations':
      return {
        title: 'Cancellations and no-shows',
        rows: cancellationsIn(facts, range).map((r) =>
          reservationRow(r, r.cancellation?.charge ?? 0, `${r.status} · ${r.cancellation?.reason ?? 'no reason recorded'}`, r.cancellation?.at?.slice(0, 10) ?? r.arrival),
        ),
      }
    case 'channel': {
      const mix = channelMix(facts, range)
      const stays = segment ? (mix.find((m) => m.label === segment)?.stays ?? []) : undefined
      return { title: segment ? `${segment}: stays in the period` : 'Stays by segment', rows: stayRows(facts, range, stays) }
    }
    case 'cash':
      return {
        title: 'Money received in the period',
        rows: cashPosition(facts, range).entries.map((p) => ({ id: p.id, date: p.date, kind: p.kind, ref: p.reference, name: p.guest, detail: p.method, amount: p.amount, to: p.to })),
      }
  }
}

/** Percentage change, or null when there is nothing to compare against. */
export function change(now: number, before: number): number | null {
  if (!before) return null
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10
}
