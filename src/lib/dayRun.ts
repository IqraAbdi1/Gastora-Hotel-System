// The two things that should happen without anybody remembering them.
//
// A room nobody confirmed goes back on sale at the time the hotel set, instead of sitting empty all
// evening while the desk is busy. And the day closes itself: the figures are recorded, and a booking
// that never arrived stops being an arrival and becomes a no-show, so tomorrow's list is true.
//
// Both are rules, not judgement. Each one states what it did and who it was done by, and a hotel that
// would rather decide for itself can switch either off and press the button instead.
//
// Pure rules only: no React.

import type { Reservation } from '../types'
import { isUnguaranteed } from './confirmCalls'

/** The record left on a booking whose room was taken back. */
export interface Release {
  at: string
  /** The person who pressed it, or the system. */
  by: string
  auto: boolean
  reason: string
}

/** One closing of the day. */
export interface AuditRun {
  /** The business date that was closed. */
  date: string
  at: string
  by: string
  auto: boolean
  /** What the hotel looked like at the moment it closed. */
  inHouse: number
  arrivals: number
  departures: number
  owed: number
  /** Bookings turned into no-shows by the run itself. */
  noShows: string[]
  /** Things the run could not settle, left for the morning. */
  open: number
}

export const ran = (runs: AuditRun[], date: string): AuditRun | undefined => runs.find((r) => r.date === date)

/** Minutes past midnight, for comparing clock times written as HH:MM. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const timeNow = (at: Date = new Date()): string =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

/** Whether the clock has reached a time the hotel set. */
export const reached = (now: string, mark: string): boolean => minutesOf(now) >= minutesOf(mark)

/**
 * Bookings whose room should go back on sale now: arriving today, nothing securing them, nobody
 * confirmed, and the hour the hotel set has passed. A guest who said they are coming is never
 * released by the clock - somebody has to decide that, because they may simply be late.
 */
export function toRelease(reservations: Reservation[], today: string, releaseTime: string, now: string): Reservation[] {
  if (!reached(now, releaseTime)) return []
  return reservations.filter(
    (r) => r.status === 'booked' && r.arrival === today && isUnguaranteed(r) && r.confirmCall?.outcome !== 'confirmed',
  )
}

/** The guest said they were coming and then did not. The desk decides on these, not the clock. */
export function lateButConfirmed(reservations: Reservation[], today: string, releaseTime: string, now: string): Reservation[] {
  if (!reached(now, releaseTime)) return []
  return reservations.filter(
    (r) => r.status === 'booked' && r.arrival === today && isUnguaranteed(r) && r.confirmCall?.outcome === 'confirmed',
  )
}

/** Everyone who should stop being counted as an arrival when the day closes. */
export function noShowsAtClose(reservations: Reservation[], today: string): Reservation[] {
  return reservations.filter((r) => r.status === 'booked' && r.arrival <= today)
}

export function auditDue(runs: AuditRun[], today: string, now: string, auditAt: string, on: boolean): boolean {
  return on && !ran(runs, today) && reached(now, auditAt)
}

export const DEFAULT_AUDIT_AT = '23:00'
