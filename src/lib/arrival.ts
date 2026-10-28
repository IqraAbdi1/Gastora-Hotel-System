import { isRoomFree, stayOverlaps } from './availability'
import { roomTypes } from './booking'
import type { Reservation, Room } from '../types'

// What the front desk can do for a guest arriving when no clean room of the booked type is free.
// Rules, not AI. A clean room of the booked type means nothing to do. Otherwise, in this order:
//  1. A dirty room of the type: rush it with housekeeping.
//  2. A room of the type whose guest leaves today: ask housekeeping to clean it first once it is empty.
//  3. A clean room of a higher type: a free upgrade. The price stays the same and nobody has to approve it.
//  4. Nothing at all: a front desk task to find a room.
export interface ArrivalPlan {
  state: 'ok' | 'rush' | 'wait' | 'upgrade' | 'none'
  /** Clean and free for the whole stay, same type. */
  ready: Room[]
  /** Dirty or being cleaned, free for the stay: these can be rushed. */
  dirty: Room[]
  /** Occupied now by a guest who leaves today. */
  leaving: Room[]
  /** Out of service for the stay. */
  outOfService: Room[]
  /** Higher room types that have a clean free room, nearest type first. */
  upgrades: { type: Room['type']; rooms: Room[] }[]
}

export function arrivalPlan(r: Reservation, rooms: Room[], reservations: Reservation[], today: string): ArrivalPlan {
  const of = rooms.filter((x) => x.type === r.roomType)
  const free = (x: Room) => isRoomFree(x, r.arrival, r.departure, reservations, r.id)
  const ready = of.filter((x) => x.status === 'clean' && free(x))
  const dirty = of.filter((x) => x.status === 'dirty' && free(x))
  const leaving = of.filter(
    (x) => x.status === 'occupied' && reservations.some((s) => s.status === 'in-house' && s.room === x.number && s.departure <= today) && free(x),
  )
  const outOfService = of.filter((x) => x.status === 'blocked')

  const upgrades: ArrivalPlan['upgrades'] = []
  for (const t of roomTypes.slice(roomTypes.indexOf(r.roomType) + 1)) {
    const list = rooms.filter((x) => x.type === t && x.status === 'clean' && free(x))
    // Other booked guests of that type who have no room yet will need one of these rooms, so they are not offered away.
    const needed = reservations.filter(
      (s) => s.id !== r.id && s.status === 'booked' && s.roomType === t && !s.room && stayOverlaps(r.arrival, r.departure, s.arrival, s.departure),
    ).length
    if (list.length > needed) upgrades.push({ type: t, rooms: list })
  }

  let state: ArrivalPlan['state'] = 'none'
  if (ready.length) state = 'ok'
  else if (dirty.length) state = 'rush'
  else if (leaving.length) state = 'wait'
  else if (upgrades.length) state = 'upgrade'
  return { state, ready, dirty, leaving, outOfService, upgrades }
}
