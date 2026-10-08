import type { Reservation, Room } from '../types'

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
      r.status !== 'checked-out' &&
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