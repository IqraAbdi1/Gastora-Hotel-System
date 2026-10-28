import { addDays } from './availability'
import { nightsOf } from './booking'
import { folioOf } from './folio'
import { isTaxCategory } from './tax'
import type { Reservation, Room } from '../types'

// Every figure on the dashboard is worked out here, from the hotel's own records.
// Rules, not AI. Nothing is invented: if the data is not there, the number is not shown.

export type Period = 'today' | '7' | '30'
export const PERIOD_LABEL: Record<Period, string> = { today: 'Today', '7': 'Last 7 days', '30': 'Last 30 days' }

/** The days a period covers, oldest first, ending today. */
export function periodDays(period: Period, today: string): string[] {
  const n = period === 'today' ? 1 : period === '7' ? 7 : 30
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)))
}

/** A stay covers a night if the guest is in the room that night: arrival up to, but not including, departure. */
const coversNight = (r: Reservation, day: string) => r.arrival <= day && r.departure > day
const sold = (r: Reservation) => r.status === 'in-house' || r.status === 'checked-out'
const booked = (r: Reservation) => r.status === 'booked'

/** One night's room charge for a stay, so a night can be valued without a nightly ledger. */
export function nightlyOf(r: Reservation): number {
  const nights = Math.max(1, nightsOf(r.arrival, r.departure))
  const extras = (r.charges ?? []).filter((c) => !isTaxCategory(c.category)).reduce((n, c) => n + c.amount, 0)
  return Math.round((r.total - extras) / nights)
}

export interface DayPoint {
  day: string
  /** Rooms with a guest in them that night. */
  occupied: number
  /** Rooms that could be sold. */
  sellable: number
  /** Room charges earned that night. */
  rooms: number
  /** Food and drink from the point of sale. */
  pos: number
  /** Laundry, transport, spa and the rest, from folios. */
  extras: number
}

export interface PosSale {
  createdAt: string
  total: number
}

/**
 * Day by day, back over the period and forward for the next week.
 * Past and today use stays that happened; future days use bookings, which is a forecast, not earnings.
 */
export function daySeries(
  days: string[],
  reservations: Reservation[],
  rooms: Room[],
  sales: PosSale[],
  today: string,
): DayPoint[] {
  const sellable = rooms.filter((x) => x.status !== 'blocked').length
  return days.map((day) => {
    let occupied = 0
    let roomMoney = 0
    let extras = 0
    for (const r of reservations) {
      const future = day > today
      const counts = future ? sold(r) || booked(r) : sold(r)
      if (counts && coversNight(r, day)) {
        occupied += 1
        roomMoney += nightlyOf(r)
      }
      // Extras are posted on the day they happen, so they land on that day only.
      if (!future)
        for (const c of r.charges ?? []) {
          if (!isTaxCategory(c.category) && c.at.startsWith(day)) extras += c.amount
        }
    }
    const pos = sales.filter((s) => (s.createdAt ?? '').slice(0, 10) === day).reduce((n, s) => n + s.total, 0)
    return { day, occupied, sellable, rooms: roomMoney, pos, extras }
  })
}

export interface Kpis {
  occupancy: number
  /** Average rate of the rooms actually sold. */
  adr: number
  /** Room earnings spread over every sellable room, sold or not. */
  revpar: number
  roomRevenue: number
  posRevenue: number
  extrasRevenue: number
  total: number
  roomsSold: number
  roomNights: number
}

export function kpisOf(points: DayPoint[]): Kpis {
  const roomsSold = points.reduce((n, p) => n + p.occupied, 0)
  const roomNights = points.reduce((n, p) => n + p.sellable, 0)
  const roomRevenue = points.reduce((n, p) => n + p.rooms, 0)
  const posRevenue = points.reduce((n, p) => n + p.pos, 0)
  const extrasRevenue = points.reduce((n, p) => n + p.extras, 0)
  return {
    occupancy: roomNights ? Math.round((roomsSold / roomNights) * 100) : 0,
    adr: roomsSold ? Math.round(roomRevenue / roomsSold) : 0,
    revpar: roomNights ? Math.round(roomRevenue / roomNights) : 0,
    roomRevenue,
    posRevenue,
    extrasRevenue,
    total: roomRevenue + posRevenue + extrasRevenue,
    roomsSold,
    roomNights,
  }
}

export interface RoomMix {
  occupied: number
  ready: number
  dirty: number
  blocked: number
}

export function roomMix(rooms: Room[]): RoomMix {
  const mix: RoomMix = { occupied: 0, ready: 0, dirty: 0, blocked: 0 }
  for (const r of rooms) {
    if (r.status === 'occupied') mix.occupied += 1
    else if (r.status === 'blocked') mix.blocked += 1
    else if (r.status === 'dirty') mix.dirty += 1
    else mix.ready += 1
  }
  return mix
}

export interface Debtor {
  reservation: Reservation
  owed: number
  /** Days since the guest left. 0 while they are still in the house. */
  age: number
}

/** Who owes money, oldest debt first. Guests in the house are included: that money is at risk too. */
export function debtors(reservations: Reservation[], today: string): Debtor[] {
  const out: Debtor[] = []
  for (const r of reservations) {
    if (r.status !== 'in-house' && r.status !== 'checked-out') continue
    const owed = folioOf(r).balance
    if (owed <= 0) continue
    const left = r.checkedOutAt?.slice(0, 10)
    const age = left ? Math.max(0, Math.round((Date.parse(today) - Date.parse(left)) / 86400000)) : 0
    out.push({ reservation: r, owed, age })
  }
  return out.sort((a, b) => b.age - a.age || b.owed - a.owed)
}

/** Debt grouped by how old it is, the way a hotel chases it. */
export function debtorBands(list: Debtor[]) {
  const bands = [
    { label: 'In the house', min: -1, max: 0 },
    { label: '1 to 7 days', min: 1, max: 7 },
    { label: '8 to 30 days', min: 8, max: 30 },
    { label: 'Over 30 days', min: 31, max: Infinity },
  ]
  return bands.map((b) => ({
    label: b.label,
    amount: list.filter((d) => d.age >= b.min && d.age <= b.max && (b.min !== -1 || d.age === 0)).reduce((n, d) => n + d.owed, 0),
    count: list.filter((d) => d.age >= b.min && d.age <= b.max && (b.min !== -1 || d.age === 0)).length,
  }))
}

/** Money given away or lost, for the owner to look at. Each line names who allowed it. */
export interface GiveAway {
  kind: 'Free upgrade' | 'Room move' | 'Left unpaid'
  what: string
  who: string
  amount?: number
  at: string
}

export function giveAways(reservations: Reservation[]): GiveAway[] {
  const out: GiveAway[] = []
  for (const r of reservations) {
    if (r.upgrade) out.push({ kind: 'Free upgrade', what: `${r.guest}: ${r.upgrade.from} to ${r.upgrade.to}`, who: 'Front desk', at: r.upgrade.at })
    for (const m of r.moves ?? []) {
      if (m.free) out.push({ kind: 'Room move', what: `${r.guest}: ${m.from} to ${m.to}, free`, who: m.by, at: m.at })
    }
    if (r.unpaidAtCheckout)
      out.push({
        kind: 'Left unpaid',
        what: `${r.guest}: ${r.checkoutNote ?? 'no reason given'}`,
        who: 'Checked out',
        amount: r.unpaidAtCheckout,
        at: r.checkedOutAt ?? '',
      })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}
