// Several rooms in one reservation: a family of five in two rooms, a manager booking three
// colleagues, parents with the grandparents next door.
//
// Before this, more than one room under one name only worked through a group block, which is the
// right tool for twenty-five workshop rooms and far too much ceremony for a family. A party is the
// small version: one booker, a few rooms booked in one go, each room an ordinary booking of its own
// so availability, the overbooking limit, the rate rules, check-in and the folio all work exactly as
// they do for one room. What ties them together is a shared party reference on each.
//
// Paying for all of them on one bill reuses the routing instructions the folio already has: every
// other room's charges are sent to the booker's room, and the desk can settle the rooms' balances in
// one go. The room money stays on each room, so the hotel's figures per room stay true.
//
// Honest limits: a party is booked for the same dates and the same rate plan for every room; rooms
// on different dates are separate bookings. A company booking is still one room at a time here; a
// company taking several rooms uses Groups, where the company's rules are set once for the block.
//
// Pure rules only: no React.

import type { Reservation, Room } from '../types'

export interface PartyLink {
  /** Shared by every room in the party. Also the reference read out on the phone. */
  id: string
  /** The person who made the booking. */
  booker: string
  /** Which room this is, counted from 1, and how many were booked together. */
  index: number
  of: number
  /** The booking that pays for every room, when the booker is paying for all of them. */
  payerId?: string
}

/** One room asked for on the booking form. */
export interface PartyRoomLine {
  type: Room['type']
  adults: number
  children: number
  /** Who will sleep in it, when the booker knows. */
  guest: string
}

export const partyRef = (leadId: string): string => `PTY-${leadId.replace(/^R-/, '')}`

/** Every room in this booking's party, in the order they were booked. Empty when it is not in one. */
export function partyOf(reservations: Reservation[], r: Reservation): Reservation[] {
  if (!r.party) return []
  const id = r.party.id
  return reservations.filter((x) => x.party?.id === id).sort((a, b) => (a.party?.index ?? 0) - (b.party?.index ?? 0))
}

export const partyLabel = (rooms: number): string => `Party of ${rooms} room${rooms === 1 ? '' : 's'}`

/** Whether a room of the party still counts: a cancelled or no-show room has left the party. */
export const stillIn = (r: Reservation): boolean => r.status !== 'cancelled' && r.status !== 'no-show'

/** Rooms of the party waiting to be checked in today. */
export const waitingToCheckIn = (party: Reservation[], today: string): Reservation[] =>
  party.filter((x) => x.status === 'booked' && x.arrival <= today)

/** What is still owed on every room that is in the house, which is what can be settled at the desk now. */
export function partyBalance(party: Reservation[]): { inHouse: Reservation[]; owed: number; all: number } {
  const inHouse = party.filter((x) => x.status === 'in-house' && x.total > x.paid)
  return {
    inHouse,
    owed: inHouse.reduce((n, x) => n + (x.total - x.paid), 0),
    all: party.filter(stillIn).reduce((n, x) => n + Math.max(0, x.total - x.paid), 0),
  }
}

/** How a room on the form stands against the hotel's free rooms and its overbooking limit. */
export type RoomStanding = 'free' | 'over' | 'full'

/**
 * Every room is checked on its own, in the order it was asked for, against what is left after the
 * rooms before it. So the third Deluxe of a party is the one that oversells, and the overbooking limit
 * is counted room by room exactly as if each had been booked separately.
 */
export function standings(
  types: Room['type'][],
  free: Record<Room['type'], number>,
  overbook: Partial<Record<Room['type'], number>>,
): RoomStanding[] {
  const used: Partial<Record<Room['type'], number>> = {}
  return types.map((t) => {
    const before = used[t] ?? 0
    used[t] = before + 1
    const left = (free[t] ?? 0) - before
    if (left >= 1) return 'free'
    const alreadyOver = Math.max(0, -left)
    return alreadyOver < (overbook[t] ?? 0) ? 'over' : 'full'
  })
}

/**
 * A deposit for the whole party, shared across the rooms in proportion to their price, so no room is
 * shown as paid beyond its own total. The last room takes what rounding leaves.
 */
export function shareDeposit(deposit: number, totals: number[]): number[] {
  const sum = totals.reduce((n, t) => n + t, 0)
  if (sum <= 0 || deposit <= 0) return totals.map(() => 0)
  const out = totals.map((t) => Math.floor((deposit * t) / sum / 100) * 100)
  out[out.length - 1] += deposit - out.reduce((n, x) => n + x, 0)
  return out
}
