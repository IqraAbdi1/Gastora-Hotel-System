import type { Reservation, Room } from '../types'

// Only booked and in-house stays hold a room. Cancelled, no-show and checked-out stays do not.
// Nor does the second guest in a shared room: the room is already held by the person they share with,
// and counting it twice would have the hotel believe it had sold a room it still has.
export function holdsRoom(r: Reservation) {
  if (r.share && !r.share.primary) return false
  return r.status === 'booked' || r.status === 'in-house'
}

// A stay uses the nights from arrival up to, but not including, departure.
// So a guest leaving on the 7th and another arriving on the 7th do not clash (BR-FO-01).
export function stayOverlaps(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  return aFrom < bTo && bFrom < aTo
}

export function clashingStay(
  roomNumber: string,
  from: string,
  to: string,
  reservations: Reservation[],
  ignoreId?: string,
) {
  return reservations.find(
    (r) =>
      r.room === roomNumber &&
      holdsRoom(r) &&
      r.id !== ignoreId &&
      stayOverlaps(from, to, r.arrival, r.departure),
  )
}

// Free for the dates = not blocked and no overlapping stay. Cleanliness is a separate check at check-in (BR-FO-02).
export function isRoomFree(room: Room, from: string, to: string, reservations: Reservation[], ignoreId?: string) {
  return room.status !== 'blocked' && !clashingStay(room.number, from, to, reservations, ignoreId)
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
/**
 * How full the house is on each night, as a percentage of the rooms that can be sold.
 *
 * This is the whole hotel, every room type together, because that is the number a hotelier prices on:
 * the Deluxe rate rises because the hotel is filling, not because four Deluxes went. Blocked rooms are
 * not counted on either side - a room out of order is not an empty room the hotel failed to sell.
 *
 * The stay being quoted is not in here, so a quote does not raise its own price.
 */
export function soldByNight(
  rooms: Room[],
  reservations: Reservation[],
  from: string,
  to: string,
): Record<string, number> {
  const sellable = rooms.filter((r) => r.status !== 'blocked').length
  const out: Record<string, number> = {}
  if (sellable === 0) return out
  for (let d = from; d < to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
    let held = 0
    for (const r of reservations) {
      if (!holdsRoom(r)) continue
      if (r.arrival <= d && d < r.departure) held += 1
    }
    out[d] = Math.min(100, Math.round((held / sellable) * 100))
    if (Object.keys(out).length > 400) break
  }
  return out
}
