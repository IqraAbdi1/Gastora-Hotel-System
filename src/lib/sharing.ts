// Two people in one room with two bills, and one stay across two rooms.
//
// A share is two colleagues sent by the same employer who each settle their own bar bill, or two
// friends splitting a room between them. One room, two guests, two folios - and the room must be
// counted once, or the hotel will think it has sold a room it still has.
//
// A split stay is the opposite shape: one guest, several rooms, one after another. It happens when
// the room they want is only free for part of the stay, and a hotel that cannot plan it ends up
// moving the guest on the morning with no warning.
//
// Both are built out of ordinary bookings rather than a new kind of thing. A share is a booking that
// holds no room of its own, because the room is already held by the person it shares with. A split
// stay is two bookings end to end, which is exactly what it is.
//
// Pure rules only: no React.

import type { Reservation } from '../types'

export interface ShareLink {
  /** The booking that actually holds the room. A share never holds one itself. */
  withReservationId: string
  /** The other guest's name, so the desk reads the link without looking it up. */
  withGuest: string
  /** True on the booking that holds the room. */
  primary: boolean
  /** Whether the room charge is divided between them, or carried by the primary alone. */
  splitRoom: boolean
}

export interface LegLink {
  /** The booking this one continues from, or continues into. */
  previousId?: string
  nextId?: string
  /** Which part of the stay this is, for the desk: "nights 1 to 2 of 4". */
  index: number
  of: number
}

/** A share that is not the primary holds no room: the room it sits in is already counted. */
export const holdsOwnRoom = (r: Reservation): boolean => !r.share || r.share.primary

/** Everybody in this room tonight, the primary first. */
export function sharersOf(reservations: Reservation[], reservationId: string): Reservation[] {
  const r = reservations.find((x) => x.id === reservationId)
  if (!r?.share) return []
  const primaryId = r.share.primary ? r.id : r.share.withReservationId
  return reservations.filter((x) => x.id === primaryId || x.share?.withReservationId === primaryId)
}

/** Every leg of a split stay, in order. */
export function legsOf(reservations: Reservation[], reservationId: string): Reservation[] {
  const start = reservations.find((x) => x.id === reservationId)
  if (!start?.legs) return []
  // Walk back to the first, then forward through the chain.
  let first = start
  const seen = new Set<string>()
  while (first.legs?.previousId && !seen.has(first.id)) {
    seen.add(first.id)
    const prev = reservations.find((x) => x.id === first.legs?.previousId)
    if (!prev) break
    first = prev
  }
  const out: Reservation[] = [first]
  let cursor = first
  while (cursor.legs?.nextId && out.length < 20) {
    const next = reservations.find((x) => x.id === cursor.legs?.nextId)
    if (!next) break
    out.push(next)
    cursor = next
  }
  return out
}

/** What the share arrangement costs each of them, for the desk to read out. */
export function shareOfRoom(r: Reservation, roomCharge: number, people: number): number {
  if (!r.share || !r.share.splitRoom) return r.share?.primary === false ? 0 : roomCharge
  return Math.round(roomCharge / Math.max(1, people))
}

export const SHARE_NOTE = {
  split: 'The room is divided between them. Each pays their share of it and everything they use themselves.',
  primary: 'One guest carries the room. The other pays only for what they use themselves.',
}
