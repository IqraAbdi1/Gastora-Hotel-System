import { folioOf } from './folio'
import { nightsOf } from './booking'
import type { Reservation, Room } from '../types'

// The night audit is the end-of-day check. It is run once, after the last arrival, before the date rolls.
// Rules, not AI. Nothing is changed until the front desk clears each item, so the audit never hides a problem.
export type AuditKind = 'not-arrived' | 'not-departed' | 'balance' | 'unposted' | 'dirty-occupied'

export interface AuditItem {
  kind: AuditKind
  reservation?: Reservation
  room?: string
  severity: 'bad' | 'warn'
  title: string
  detail: string
  /** Money this item is about, for the totals line. */
  amount?: number
}

export interface AuditReport {
  items: AuditItem[]
  /** Stays that are in the house tonight and have a night to post. */
  toPost: { reservation: Reservation; nightly: number }[]
  postTotal: number
  arrivals: number
  departures: number
  inHouse: number
  occupied: number
  sellable: number
  owed: number
}

export function auditReport(reservations: Reservation[], rooms: Room[], today: string): AuditReport {
  const items: AuditItem[] = []
  const toPost: AuditReport['toPost'] = []
  let arrivals = 0
  let departures = 0
  let inHouse = 0
  let owed = 0

  for (const r of reservations) {
    if (r.status === 'booked' && r.arrival <= today) {
      arrivals += 1
      items.push({
        kind: 'not-arrived',
        reservation: r,
        severity: 'bad',
        title: `${r.guest} has not arrived`,
        detail: `Booked to arrive ${r.arrival}. Check the guest in or record a no-show before the date rolls.`,
      })
    }
    if (r.status === 'checked-out' && r.checkedOutAt?.startsWith(today)) departures += 1
    if (r.status !== 'in-house') continue

    inHouse += 1
    const f = folioOf(r)
    if (f.balance > 0) owed += f.balance

    if (r.departure <= today) {
      items.push({
        kind: 'not-departed',
        reservation: r,
        severity: 'bad',
        title: `${r.guest} should have left`,
        detail: `Room ${r.room ?? '?'}. Departure was ${r.departure}. Check out, or extend the stay with Change stay.`,
        amount: f.balance,
      })
      continue
    }

    // A stay going on tonight owes another night. The prototype's totals already cover the whole stay,
    // so the audit only reports the night; the hotel's real system posts it to the ledger.
    const nights = Math.max(1, nightsOf(r.arrival, r.departure))
    toPost.push({ reservation: r, nightly: Math.round(f.roomCharge / nights) })

    if (f.balance > 0) {
      items.push({
        kind: 'balance',
        reservation: r,
        severity: 'warn',
        title: `${r.guest} owes money`,
        detail: `Room ${r.room ?? '?'}. Balance carried into tomorrow.`,
        amount: f.balance,
      })
    }
  }

  let occupied = 0
  let sellable = 0
  for (const room of rooms) {
    if (room.status !== 'blocked') sellable += 1
    if (room.status === 'occupied') occupied += 1
  }

  // A room marked dirty with a guest in it means the board and the folio disagree.
  for (const room of rooms) {
    if (room.status !== 'occupied') continue
    const stay = reservations.find((r) => r.status === 'in-house' && r.room === room.number)
    if (!stay)
      items.push({
        kind: 'dirty-occupied',
        room: room.number,
        severity: 'warn',
        title: `Room ${room.number} is occupied with no guest`,
        detail: 'The board says occupied but no stay is in the house. Check the room and put it right.',
      })
  }

  const rank = { bad: 0, warn: 1 }
  items.sort((a, b) => rank[a.severity] - rank[b.severity])
  const postTotal = toPost.reduce((n, x) => n + x.nightly, 0)
  return { items, toPost, postTotal, arrivals, departures, inHouse, occupied, sellable, owed }
}
