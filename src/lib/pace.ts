// How fast a date is filling, and what that says about where it will end up.
//
// Occupancy tells a hotel what it has. Pace tells it what is happening: 40% sold for a Saturday three
// weeks out is good news or bad news depending entirely on what this hotel normally has three weeks
// out, and that is a question about its own history, not an industry rule of thumb.
//
// Everything here rests on one fact being recorded: the day a booking was taken. Without it there is no
// lead time, no pickup and no curve, and a screen claiming to show pace would be showing decoration.
//
// The curve is the hotel's own. For every night already past, we can reconstruct what was on the books
// at each point before it, because every booking carries the day it was made. Averaged over those
// nights, that gives the share of the final house this hotel normally holds at any number of days out.
// Compare today's share against it and the date is ahead, behind, or where it usually is.
//
// Pure rules only: no React.

import { nightsOf } from './booking'
import type { Reservation, Room } from '../types'

/** A booking that counts as sold for a night: not cancelled, not a no-show, not the second guest in a share. */
function sold(r: Reservation): boolean {
  if (r.share && !r.share.primary) return false
  return r.status === 'booked' || r.status === 'in-house' || r.status === 'checked-out'
}

/**
 * A booking with no recorded day of sale is not a booking made today. It is one taken before the hotel
 * started recording it, so it counts as already on the books and never as this week's pickup. Guessing
 * the arrival day instead would turn every old record into a last-minute sale and flatter every number
 * on the page.
 */
const bookedOn = (r: Reservation): string | undefined => r.bookedAt

/**
 * Rooms held for one night. Pass `asOf` to ask the question as it stood on an earlier day: only
 * bookings taken on or before that day are counted, which is what makes the history readable.
 */
export function soldNight(reservations: Reservation[], date: string, asOf?: string): number {
  let n = 0
  for (const r of reservations) {
    if (!sold(r)) continue
    if (!(r.arrival <= date && date < r.departure)) continue
    const taken = bookedOn(r)
    if (asOf && taken && taken > asOf) continue
    n += 1
  }
  return n
}

/** Rooms added for a night in the last so many days. The number a revenue manager looks at first. */
export function pickup(reservations: Reservation[], date: string, days: number, today: string): number {
  const since = addDays(today, -Math.max(1, days))
  let n = 0
  for (const r of reservations) {
    if (!sold(r)) continue
    if (!(r.arrival <= date && date < r.departure)) continue
    const taken = bookedOn(r)
    // Taken in the window, and not dated in the future by a clock nobody trusts.
    if (taken && taken > since && taken <= today) n += 1
  }
  return n
}

export const addDays = (date: string, by: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

/** Days between taking the booking and the guest arriving, where the hotel recorded the sale. */
export const leadTimeOf = (r: Reservation): number | undefined => {
  const taken = bookedOn(r)
  return taken ? Math.max(0, nightsOf(taken, r.arrival)) : undefined
}

/**
 * The average lead time of bookings taken for stays in a window. Bookings whose day of sale was never
 * recorded are left out rather than counted as nought, which would drag the average towards the floor
 * and tell a hotel it sells last-minute when it does not.
 */
export function averageLeadTime(reservations: Reservation[], from: string, to: string): number | undefined {
  const days = reservations
    .filter((r) => sold(r) && r.arrival >= from && r.arrival <= to)
    .map(leadTimeOf)
    .filter((d): d is number => d !== undefined)
  if (days.length === 0) return undefined
  return Math.round(days.reduce((n, d) => n + d, 0) / days.length)
}

/**
 * The hotel's own build-up curve: at N days before a night, what share of the rooms it finished with
 * were already on the books. Index 0 is the night itself, and the curve only runs as far as `out`.
 *
 * Nights that ended empty are left out: a share of nothing is not a number, and one dead Tuesday would
 * drag the whole curve.
 */
export function buildUpCurve(reservations: Reservation[], today: string, back = 120, out = 60): number[] {
  const totals = new Array<number>(out + 1).fill(0)
  const counts = new Array<number>(out + 1).fill(0)

  for (let i = 1; i <= back; i++) {
    const night = addDays(today, -i)
    const final = soldNight(reservations, night)
    if (final === 0) continue
    for (let n = 0; n <= out; n++) {
      totals[n] += soldNight(reservations, night, addDays(night, -n)) / final
      counts[n] += 1
    }
  }

  return totals.map((t, n) => (counts[n] ? t / counts[n] : 0))
}

export type PaceVerdict = 'ahead' | 'behind' | 'on track' | 'too early to say'

export const VERDICT_TONE: Record<PaceVerdict, 'good' | 'bad' | 'neutral' | 'warn'> = {
  ahead: 'good',
  behind: 'bad',
  'on track': 'neutral',
  'too early to say': 'neutral',
}

export interface NightPace {
  date: string
  daysOut: number
  /** Rooms held for that night now. */
  onBooks: number
  sellable: number
  occupancy: number
  /** Rooms added in the last week. */
  pickup: number
  /** The share of a finished house this hotel normally holds this far out, 0 to 1. */
  normalShare: number
  /** Where the night is likely to finish if it fills the way this hotel usually fills. */
  forecast?: number
  verdict: PaceVerdict
}

/**
 * One night, measured. The forecast is the plainest arithmetic there is - what is on the books, divided
 * by the share normally on the books by now - and it is offered only where the curve has something to
 * say. It is a projection of this hotel's own habit, not a prediction of the world.
 */
export function paceForNight(
  reservations: Reservation[],
  rooms: Room[],
  date: string,
  today: string,
  curve: number[],
): NightPace {
  const sellable = rooms.filter((r) => r.status !== 'blocked').length
  const onBooks = soldNight(reservations, date)
  const daysOut = Math.max(0, nightsOf(today, date))
  const normalShare = curve[Math.min(daysOut, curve.length - 1)] ?? 0
  const occupancy = sellable ? Math.round((onBooks / sellable) * 100) : 0

  let forecast: number | undefined
  let verdict: PaceVerdict = 'too early to say'
  // Below a tenth, the curve is saying "almost nothing is normally booked by now", and dividing by it
  // turns one early booking into a full hotel. That is how forecasts get laughed out of a meeting.
  if (normalShare >= 0.1) {
    forecast = Math.min(sellable, Math.round(onBooks / normalShare))
    const expected = normalShare * sellable
    const gap = onBooks - expected
    // A room either side is not news in a hotel this size.
    verdict = gap > 1 ? 'ahead' : gap < -1 ? 'behind' : 'on track'
  }

  return {
    date,
    daysOut,
    onBooks,
    sellable,
    occupancy,
    pickup: pickup(reservations, date, 7, today),
    normalShare,
    forecast,
    verdict,
  }
}

/** The next so many nights, measured against the hotel's own curve. */
export function paceAhead(
  reservations: Reservation[],
  rooms: Room[],
  today: string,
  nights = 30,
): NightPace[] {
  // With too little history the curve is one or two nights' habits wearing a lab coat. Measuring thirty
  // nights against it and painting them all red says something the data cannot support, so nothing is
  // judged until there is a month of trading to judge against.
  const curve = curveIsThin(reservations, today) ? [] : buildUpCurve(reservations, today)
  const out: NightPace[] = []
  for (let i = 0; i < nights; i++) {
    out.push(paceForNight(reservations, rooms, addDays(today, i), today, curve))
  }
  return out
}

/** Whether there is enough history for the curve to mean anything. */
export function curveIsThin(reservations: Reservation[], today: string): boolean {
  let nights = 0
  for (let i = 1; i <= 120; i++) if (soldNight(reservations, addDays(today, -i)) > 0) nights += 1
  // A month of trading nights is the least that makes an average of anything.
  return nights < 30
}
