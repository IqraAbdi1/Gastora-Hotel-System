import { addDays } from './availability'
import type { Reservation, Room } from '../types'

// What the front desk needs to know about one day, worked out from reservations and rooms.
// Pure functions: no React, no sample data imports, so they work the same when the data comes from the API.

export type DaySummary = {
  /** Booked to arrive today and not yet checked in. */
  expected: Reservation[]
  /** Arrived today and already checked in. */
  arrivedCount: number
  /** In house and due out today or earlier, in room order. */
  leaving: Reservation[]
  checkedOutCount: number
  inHouse: Reservation[]
  occupied: number
  sellable: number
  /** In-house stays with money still owed, and the total owed. */
  owing: Reservation[]
  owedTotal: number
  roomsToClean: number
}

export function summarizeDay(reservations: Reservation[], rooms: Room[], today: string): DaySummary {
  const expected: Reservation[] = []
  const leaving: Reservation[] = []
  const inHouse: Reservation[] = []
  const owing: Reservation[] = []
  let arrivedCount = 0
  let checkedOutCount = 0
  let owedTotal = 0

  for (const r of reservations) {
    if (r.status === 'booked' && r.arrival === today) expected.push(r)
    if (r.status === 'in-house') {
      inHouse.push(r)
      if (r.arrival === today) arrivedCount += 1
      if (r.departure <= today) leaving.push(r)
      if (r.total > r.paid) {
        owing.push(r)
        owedTotal += r.total - r.paid
      }
    }
    // checkedOutAt is "YYYY-MM-DD HH:MM".
    if (r.status === 'checked-out' && r.checkedOutAt?.startsWith(today)) checkedOutCount += 1
  }
  leaving.sort((a, b) => Number(a.room) - Number(b.room))

  let occupied = 0
  let sellable = 0
  let roomsToClean = 0
  for (const room of rooms) {
    if (room.status !== 'blocked') sellable += 1
    if (room.status === 'occupied') occupied += 1
    if (room.status === 'dirty') roomsToClean += 1
  }

  return { expected, arrivedCount, leaving, checkedOutCount, inHouse, occupied, sellable, owing, owedTotal, roomsToClean }
}

// Booked stays arriving after today, up to `days` ahead, earliest first.
export function upcomingArrivals(reservations: Reservation[], today: string, days = 3): Reservation[] {
  const last = addDays(today, days)
  return reservations
    .filter((r) => r.status === 'booked' && r.arrival > today && r.arrival <= last)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.guest.localeCompare(b.guest))
}

// A clean room with no housekeeping detail has been inspected and can be sold.
export function isReady(room: Room) {
  return room.status === 'clean' && !room.hk
}

export type AttentionKind = 'missed-arrival' | 'overdue-departure' | 'no-guarantee' | 'no-ready-room'

export type Attention = {
  kind: AttentionKind
  reservation: Reservation
  severity: 'bad' | 'warn'
  title: string
  detail: string
}

// Reservations someone at the desk should look at today. Each rule is listed here, in one place,
// so the list can be checked against the hotel's own policy. Assumptions are noted on each rule.
export function reservationsNeedingAttention(reservations: Reservation[], rooms: Room[], today: string): Attention[] {
  const out: Attention[] = []

  for (const r of reservations) {
    // Arrival day has passed but the stay is still "booked". Hotel policy decides between
    // late check-in and no-show; the app only flags it.
    if (r.status === 'booked' && r.arrival < today) {
      out.push({
        kind: 'missed-arrival',
        reservation: r,
        severity: 'bad',
        title: 'Arrival date has passed',
        detail: 'Still booked. Check the guest in or record a no-show.',
      })
    }
    // Guest should have left already.
    if (r.status === 'in-house' && r.departure < today) {
      out.push({
        kind: 'overdue-departure',
        reservation: r,
        severity: 'bad',
        title: 'Past departure date',
        detail: `Room ${r.room ?? '?'}. Extend the stay or check the guest out.`,
      })
    }
    // Arriving today with nothing paid and no card or company guarantee.
    // Assumption: a recorded card or company guarantee is enough; the hotel may require more.
    if (
      r.status === 'booked' &&
      r.arrival === today &&
      r.paid === 0 &&
      r.guarantee !== 'card' &&
      r.guarantee !== 'company'
    ) {
      out.push({
        kind: 'no-guarantee',
        reservation: r,
        severity: 'warn',
        title: 'No deposit or guarantee',
        detail: 'Arrives today with nothing paid. Ask for a deposit at check-in.',
      })
    }
  }

  // Today's arrivals that no ready room can cover yet. Rooms already given to a guest arriving
  // today are kept for that guest; the rest are shared out by room type.
  const arrivals = reservations.filter((r) => r.status === 'booked' && r.arrival === today)
  const taken = new Set(arrivals.map((r) => r.room).filter((n): n is string => !!n))
  const pool = new Map<string, number>()
  for (const room of rooms) {
    if (isReady(room) && !taken.has(room.number)) pool.set(room.type, (pool.get(room.type) ?? 0) + 1)
  }
  for (const r of arrivals) {
    if (r.room) {
      const room = rooms.find((x) => x.number === r.room)
      if (room && !isReady(room)) {
        out.push({
          kind: 'no-ready-room',
          reservation: r,
          severity: 'warn',
          title: `Room ${room.number} is not ready`,
          detail: 'Assigned room is not clean and inspected yet.',
        })
      }
      continue
    }
    const left = pool.get(r.roomType) ?? 0
    if (left > 0) pool.set(r.roomType, left - 1)
    else
      out.push({
        kind: 'no-ready-room',
        reservation: r,
        severity: 'warn',
        title: `No ready ${r.roomType} room`,
        detail: 'Every ready room of this type is already spoken for. Ask housekeeping.',
      })
  }

  const rank = { bad: 0, warn: 1 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}
