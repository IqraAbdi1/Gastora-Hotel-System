// The guests the hotel had to turn away.
//
// A full hotel loses these people twice: once when they are told no, and again when a cancellation
// frees the room an hour later and nobody remembers who wanted it. The list itself is the easy part.
// The value is that the system watches availability and says, without being asked, that the room this
// person wanted is now free.
//
// One rule decides the shape of it: a room is never held for somebody on this list. It is offered, for
// a stated length of time, and if they do not answer it goes to the next person or back on sale. A held
// room that nobody pays for is the same loss as the one this list exists to prevent.
//
// Pure rules only: no React.

import type { Room } from '../types'

export type WaitStatus = 'waiting' | 'offered' | 'booked' | 'gone'

export interface WaitEntry {
  id: string
  guestName: string
  phone: string
  /** Set when the person is already known to the hotel. */
  guestId?: string
  roomType: Room['type']
  arrival: string
  departure: string
  adults: number
  /** Anything the desk was told: a company, a wedding, "any room will do". */
  note?: string
  /** When they were put on the list, and by whom. */
  at: string
  by: string
  status: WaitStatus
  /** The moment the room was offered to them, which starts their clock. */
  offeredAt?: string
  /** How long they have to answer before it goes to the next person. */
  offerHours: number
  /** The booking that came out of it. */
  bookedId?: string
  closedAt?: string
  closedReason?: string
}

export const WAIT_STATUS_LABEL: Record<WaitStatus, string> = {
  waiting: 'Waiting',
  offered: 'Offered a room',
  booked: 'Booked',
  gone: 'Off the list',
}

export const WAIT_STATUS_TONE: Record<WaitStatus, 'neutral' | 'warn' | 'good' | 'info'> = {
  waiting: 'info',
  offered: 'warn',
  booked: 'good',
  gone: 'neutral',
}

/** Why a name came off the list without becoming a booking. */
export const OFF_LIST_REASONS = ['Went elsewhere', 'No longer coming', 'Could not be reached', 'Dates changed', 'Other']

export const DEFAULT_OFFER_HOURS = 2

export interface NewWaitEntry {
  guestName: string
  phone: string
  guestId?: string
  roomType: Room['type']
  arrival: string
  departure: string
  adults: number
  note?: string
}

export function newWaitId(entries: WaitEntry[]): string {
  let n = entries.length + 1
  while (entries.some((e) => e.id === `WL-${n}`)) n += 1
  return `WL-${n}`
}

/** Hours between a recorded time and now, for an offer that is running out. */
export function hoursSince(at: string, now: Date = new Date()): number {
  const then = Date.parse(at.replace(' ', 'T'))
  if (Number.isNaN(then)) return 0
  return (now.getTime() - then) / 3600000
}

export function offerExpired(entry: WaitEntry, now: Date = new Date()): boolean {
  if (entry.status !== 'offered' || !entry.offeredAt) return false
  return hoursSince(entry.offeredAt, now) >= entry.offerHours
}

/** What is left of an offer, in the words the desk would use. */
export function offerLeft(entry: WaitEntry, now: Date = new Date()): string {
  if (entry.status !== 'offered' || !entry.offeredAt) return ''
  const left = entry.offerHours - hoursSince(entry.offeredAt, now)
  if (left <= 0) return 'Time is up'
  if (left < 1) return `${Math.round(left * 60)} minutes left`
  return `${left.toFixed(1)} hours left`
}

/**
 * Whether a room of this type is free for the whole of what this person asked for. The count comes from
 * the same availability the booking screen uses, so the list can never offer a room the desk cannot sell.
 */
export function roomIsFree(entry: WaitEntry, freeOf: (type: Room['type'], from: string, to: string) => number): boolean {
  return freeOf(entry.roomType, entry.arrival, entry.departure) > 0
}

/**
 * Who should be told first. Oldest on the list wins, because a queue people cannot see has to be one
 * they would agree with if they could.
 */
export function nextInLine(entries: WaitEntry[], freeOf: (type: Room['type'], from: string, to: string) => number): WaitEntry | undefined {
  return entries
    .filter((e) => e.status === 'waiting' && roomIsFree(e, freeOf))
    .sort((a, b) => a.at.localeCompare(b.at))[0]
}

/** Everyone whose room has come free, oldest first. */
export function readyToOffer(entries: WaitEntry[], freeOf: (type: Room['type'], from: string, to: string) => number): WaitEntry[] {
  return entries.filter((e) => e.status === 'waiting' && roomIsFree(e, freeOf)).sort((a, b) => a.at.localeCompare(b.at))
}

/** Still in the past is not waiting for anything. */
export function stale(entry: WaitEntry, today: string): boolean {
  return entry.status === 'waiting' && entry.arrival < today
}

export function nightsAsked(entry: WaitEntry): number {
  const a = Date.parse(`${entry.arrival}T00:00:00`)
  const b = Date.parse(`${entry.departure}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}
