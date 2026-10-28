// Automatic room assignment: a proposed room for each booked stay that has none yet.
//
// The desk has always picked rooms by hand, and on a busy morning that means the first clean room on
// the list, which is how a regular who always has the lake side ends up over the kitchen and a
// one-night guest takes the only room that was free for the whole of next week. These are the rules
// a good head receptionist uses, written down:
//
//   1. Only a room of the booked type, not out of order or out of service, and free for every night
//      of the stay. For a guest arriving today it must also be clean; a room still waiting for its
//      inspection is offered, but an inspected one comes first.
//   2. Guests are served in order: VIPs, then guests who have stayed before (most stays first), then
//      longer stays, then whoever booked first. The guest at the desk right now can be put first.
//   3. Whatever the guest's profile says - the same room as last time, a quiet room, a high or a low
//      floor, near the lift, a room number they asked for - counts for the room that matches.
//   4. The better rooms (lake view, quiet, higher up) are kept for VIPs and returning guests; a
//      first-time guest is given a plain room when one will do.
//   5. Best fit: a stay goes into the room whose free run it fills most closely, so a two-night
//      guest does not break up a room that was free for a long stay arriving tomorrow.
//   6. A room another guest in the same batch is known to want (their last room, the number they
//      asked for) is avoided unless nothing else fits.
//
// Honest limits: a room has no view, wing or bed field in this prototype, so "lake view" and "quiet"
// come from the optional tags on a room, and the floor from the room number. Nothing here ever changes
// a room somebody chose by hand: a stay that already has a room is not looked at.
//
// Pure rules only: no React.

import { clashingStay, stayOverlaps } from './availability'
import { floorOf } from './rooms'
import type { Guest, Reservation, Room } from '../types'

/** Room tags that make a room one of the better ones, kept for VIPs and returning guests. */
export const BETTER_TAGS = ['Lake view', 'Quiet', 'Balcony']

/** What a guest's preference tag asks of a room tag. */
const TAG_FOR_PREF: Record<string, string> = {
  'Quiet room': 'Quiet',
  'Near the lift': 'Near the lift',
}

export interface Proposal {
  reservationId: string
  /** The room proposed, or null when nothing suitable is free. */
  room: string | null
  /** The short reasons, in the order they are read out: "clean", "lake view", "as last time". */
  parts: string[]
  /** One line for the desk. */
  reason: string
}

export interface AssignInput {
  reservations: Reservation[]
  rooms: Room[]
  guests: Guest[]
  /** The hotel's business date, to know whose arrival is today and so needs a clean room. */
  today: string
  /** The stays to find rooms for. Any that already have a room are passed over untouched. */
  targets: Reservation[]
  /** Put this stay first, because the guest is standing at the desk. */
  first?: string
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

const profileOf = (r: Reservation, guests: Guest[]) =>
  guests.find((g) => (r.guestId ? g.id === r.guestId : g.name === r.guest))

/** Finished stays of this guest, newest first. */
function pastStays(r: Reservation, reservations: Reservation[]): Reservation[] {
  return reservations
    .filter(
      (x) =>
        x.id !== r.id &&
        x.status === 'checked-out' &&
        !!x.room &&
        (r.guestId ? x.guestId === r.guestId : x.guest === r.guest),
    )
    .sort((a, b) => b.departure.localeCompare(a.departure))
}

/** The room the guest had last time in this room type, if any. */
export function lastRoomOf(r: Reservation, reservations: Reservation[]): string | undefined {
  return pastStays(r, reservations).find((x) => x.roomType === r.roomType)?.room ?? undefined
}

/** Room numbers written in the guest's own room preference, such as "Always 203". */
function askedNumbers(g: Guest | undefined): string[] {
  return (g?.preferences?.room ?? '').match(/\b\d{3,4}\b/g) ?? []
}

const tagsOf = (room: Room) => room.tags ?? []

/** How good a room is, for keeping the best ones for the guests who matter most. */
export function quality(room: Room): number {
  return tagsOf(room).filter((t) => BETTER_TAGS.includes(t)).length + floorOf(room) / 10
}

/** Whether a stay is ready for the rules: booked, no room yet. */
export const needsRoom = (r: Reservation) => r.status === 'booked' && !r.room && !(r.share && !r.share.primary)

/** Order the batch: the desk's guest first, then VIPs, returning guests, longer stays, earlier bookings. */
function priority(input: AssignInput) {
  const stays = new Map(input.targets.map((r) => [r.id, pastStays(r, input.reservations).length]))
  const vip = new Map(input.targets.map((r) => [r.id, profileOf(r, input.guests)?.vip ? 1 : 0]))
  const nights = (r: Reservation) => Date.parse(r.departure) - Date.parse(r.arrival)
  return [...input.targets].sort(
    (a, b) =>
      Number(b.id === input.first) - Number(a.id === input.first) ||
      (vip.get(b.id) ?? 0) - (vip.get(a.id) ?? 0) ||
      (stays.get(b.id) ?? 0) - (stays.get(a.id) ?? 0) ||
      nights(b) - nights(a) ||
      (a.bookedAt ?? '').localeCompare(b.bookedAt ?? '') ||
      a.id.localeCompare(b.id),
  )
}

const DAY = 86400000
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)

/** Days the room stays empty after this stay before the next one, capped. */
function gapAfter(room: string, r: Reservation, held: Reservation[]): number {
  let next = 30
  for (const x of held) {
    if (x.room !== room || x.id === r.id) continue
    if (x.arrival >= r.departure) next = Math.min(next, daysBetween(r.departure, x.arrival))
  }
  return next
}

const holds = (x: Reservation) => (x.status === 'booked' || x.status === 'in-house') && !(x.share && !x.share.primary)

/**
 * Rooms this stay could go into: the right type, on sale, free every night. For a stay arriving today,
 * clean as well. Rooms held by anybody in `held` (which includes rooms already planned in this batch)
 * are out.
 */
export function candidatesFor(r: Reservation, rooms: Room[], held: Reservation[], today: string): Room[] {
  return rooms.filter(
    (room) =>
      room.type === r.roomType &&
      room.status !== 'blocked' &&
      !clashingStay(room.number, r.arrival, r.departure, held, r.id) &&
      (r.arrival > today || (room.status === 'clean' && (!room.hk || room.hk === 'cleaned'))),
  )
}

/** Propose rooms for a batch of stays. Returns one proposal for each stay that needs a room. */
export function proposeRooms(input: AssignInput): Proposal[] {
  const { rooms, guests, today } = input
  const todo = priority({ ...input, targets: input.targets.filter(needsRoom) })
  // Working copy: every stay holding a room, plus what this run has planned so far.
  const held: Reservation[] = input.reservations.filter(holds)

  // Rooms other guests in the batch are known to want, so a stranger is not put in them first.
  const wanted = new Map<string, string>()
  for (const r of todo) {
    const g = profileOf(r, guests)
    for (const n of [lastRoomOf(r, input.reservations), ...askedNumbers(g)]) if (n && !wanted.has(n)) wanted.set(n, r.id)
  }

  const out: Proposal[] = []
  for (const r of todo) {
    const g = profileOf(r, guests)
    const valued = !!g?.vip || pastStays(r, input.reservations).length > 0
    const prefs = g?.preferences?.tags ?? []
    const last = lastRoomOf(r, input.reservations)
    const asked = askedNumbers(g)
    const wantsLake = /lake/i.test(g?.preferences?.room ?? '')
    const arrivingToday = r.arrival <= today
    const options = candidatesFor(r, rooms, held, today)
    if (options.length === 0) {
      out.push({
        reservationId: r.id,
        room: null,
        parts: [],
        reason: arrivingToday
          ? `No clean ${r.roomType} room is free for the whole stay. Rush one with housekeeping.`
          : `No ${r.roomType} room is free for every night of the stay.`,
      })
      continue
    }
    const floors = options.map(floorOf)
    const top = Math.max(...floors)
    const bottom = Math.min(...floors)

    let best: { room: Room; score: number; parts: string[] } | null = null
    for (const room of options) {
      let score = 0
      const parts: string[] = []
      const tags = tagsOf(room)
      if (arrivingToday) {
        if (!room.hk) {
          score += 10
          parts.push('clean')
        } else parts.push('clean, waiting for inspection')
      }
      for (const t of tags) {
        const asks = prefs.some((p) => TAG_FOR_PREF[p] === t) || (t === 'Lake view' && wantsLake)
        if (asks) {
          score += 15
          parts.push(lower(t))
        }
      }
      if (prefs.includes('High floor') && top > bottom && floorOf(room) === top) {
        score += 12
        parts.push('high floor')
      }
      if (prefs.includes('Ground floor') && top > bottom && floorOf(room) === bottom) {
        score += 12
        parts.push('low floor')
      }
      if (asked.includes(room.number)) {
        score += 30
        parts.push('the room they asked for')
      }
      if (last === room.number) {
        score += 40
        parts.push('as last time')
      }
      // The better rooms go to the guests the hotel wants back; a plain room does for a first stay.
      const q = quality(room)
      if (valued) {
        score += q * 8
        if (q >= 1 && !parts.some((p) => BETTER_TAGS.some((t) => lower(t) === p))) {
          const better = tags.find((t) => BETTER_TAGS.includes(t))
          if (better) parts.push(lower(better))
        }
      } else score -= q * 3
      // Best fit: fill the free run, keep long runs for long stays.
      const gap = gapAfter(room.number, r, held)
      score -= Math.min(gap, 14) * 0.6
      if (gap === 0) parts.push('fits up to the next booking')
      const wantedBy = wanted.get(room.number)
      if (wantedBy && wantedBy !== r.id) score -= 25
      // Lowest number wins a tie, so the result is the same every time it is run.
      score -= Number(room.number) / 100000
      if (!best || score > best.score) best = { room, score, parts }
    }

    const chosen = best!
    held.push({ ...r, room: chosen.room.number })
    const parts = chosen.parts.length ? chosen.parts : ['free for the whole stay']
    out.push({ reservationId: r.id, room: chosen.room.number, parts, reason: `${chosen.room.number}, ${parts.join(', ')}` })
  }
  return out
}

/** One stay's proposal, from rooms the desk could pick, taking the rest of today's arrivals into account. */
export function proposeRoom(r: Reservation, input: Omit<AssignInput, 'targets' | 'first'>): Proposal | undefined {
  const others = input.reservations.filter(
    (x) => x.id !== r.id && needsRoom(x) && x.roomType === r.roomType && stayOverlaps(x.arrival, x.departure, r.arrival, r.departure),
  )
  return proposeRooms({ ...input, targets: [r, ...others], first: r.id }).find((p) => p.reservationId === r.id)
}

/** Today's arrivals still without a room, which is what the desk's button works on. */
export const unassignedArrivals = (reservations: Reservation[], today: string): Reservation[] =>
  reservations.filter((r) => needsRoom(r) && r.arrival === today)

/** When the hotel lets the morning assignment run by itself. Off unless the hotel turns it on. */
export interface AutoAssignSettings {
  on: boolean
  /** The time each morning it runs. */
  at: string
  /** The business date it last ran, so it runs once a day. */
  lastRun?: string
}

export const DEFAULT_AUTO_ASSIGN: AutoAssignSettings = { on: false, at: '07:00' }
