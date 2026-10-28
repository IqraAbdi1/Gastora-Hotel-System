// What a guest is worth, and what they cost.
//
// A word about "lifetime value". In most systems it is a projection: what this guest is expected to
// spend before they stop coming. That projection rests on years of history and a churn model, and a
// hotel that has been running this software for six months has neither. A number like that, invented,
// gets quoted in a meeting and then used to decide who gets the upgrade.
//
// So nothing here is projected. Everything is counted:
//
//   - What they have actually paid, across finished stays.
//   - What that comes to in a year of knowing them, which is the figure that compares a guest of five
//     years with a guest of five months honestly.
//   - How long since they were last here, because a good guest who has not come for two years is a
//     different problem from a good guest who was here last week.
//   - What they have cost: bookings cancelled or not arrived, and complaints raised.
//
// The band at the end is a rule, written out, not a score out of a hundred that nobody can argue with.
//
// Pure rules only: no React.

import { nightsOf } from './booking'
import type { Feedback } from './feedback'
import type { Guest, Reservation } from '../types'

export type Band = 'new' | 'occasional' | 'regular' | 'best'

export const BAND_LABEL: Record<Band, string> = {
  new: 'New',
  occasional: 'Comes now and then',
  regular: 'Comes regularly',
  best: 'One of the best',
}

export const BAND_TONE: Record<Band, 'neutral' | 'good' | 'warn'> = {
  new: 'neutral',
  occasional: 'neutral',
  regular: 'good',
  best: 'good',
}

export const BAND_RULE: Record<Band, string> = {
  new: 'No finished stay yet.',
  occasional: 'Has stayed, but not often enough to count on.',
  regular: 'Three stays or more, and here within the last year.',
  best: 'Five stays or more, here within the last year, and in the top of what guests spend.',
}

export interface GuestValue {
  stays: number
  nights: number
  /** What they have actually paid on finished stays. */
  paid: number
  /** What they pay on an average night. */
  perNight: number
  firstStay?: string
  lastStay?: string
  /** Days since they left, where they have ever stayed. */
  daysSince?: number
  /** How long the hotel has known them, in months. */
  monthsKnown: number
  /** What they are worth in a year of knowing them. */
  perYear: number
  /** Bookings they cancelled or never arrived for. */
  fellThrough: number
  /** Money still owed across open stays. */
  owing: number
  complaints: number
  band: Band
}

const daysBetween = (from: string, to: string): number => Math.max(0, nightsOf(from, to))

/**
 * Counted from the guest's own bookings. `today` is passed rather than read so the same guest reads
 * the same whenever this is called.
 */
export function valueOf(
  guest: Guest,
  reservations: Reservation[],
  feedback: Feedback[],
  today: string,
  /** What the hotel's better guests pay in a year, for the top band. */
  topPerYear = 2000000,
): GuestValue {
  const mine = reservations.filter((r) => (r.guestId ? r.guestId === guest.id : r.guest === guest.name))

  let stays = 0
  let nights = 0
  let paid = 0
  let fellThrough = 0
  let owing = 0
  let firstStay: string | undefined
  let lastStay: string | undefined

  for (const r of mine) {
    if (r.status === 'cancelled' || r.status === 'no-show') {
      fellThrough += 1
      continue
    }
    if (r.status !== 'checked-out') {
      owing += Math.max(0, r.total - r.paid)
      continue
    }
    stays += 1
    nights += Math.max(1, nightsOf(r.arrival, r.departure))
    paid += r.paid
    if (!firstStay || r.arrival < firstStay) firstStay = r.arrival
    if (!lastStay || r.departure > lastStay) lastStay = r.departure
  }

  const daysSince = lastStay ? daysBetween(lastStay, today) : undefined
  const monthsKnown = firstStay ? Math.max(1, Math.round(daysBetween(firstStay, today) / 30)) : 0
  const perYear = monthsKnown > 0 ? Math.round((paid / monthsKnown) * 12) : 0
  const perNight = nights > 0 ? Math.round(paid / nights) : 0
  const complaints = feedback.filter(
    (f) => f.kind === 'complaint' && ((guest.id && f.guestId === guest.id) || f.guestName === guest.name),
  ).length

  const recent = daysSince !== undefined && daysSince <= 365
  let band: Band = 'new'
  if (stays >= 5 && recent && perYear >= topPerYear) band = 'best'
  else if (stays >= 3 && recent) band = 'regular'
  else if (stays >= 1) band = 'occasional'

  return { stays, nights, paid, perNight, firstStay, lastStay, daysSince, monthsKnown, perYear, fellThrough, owing, complaints, band }
}

/** Plain words for how long ago, because "412" means nothing at a glance. */
export function sinceWords(days?: number): string {
  if (days === undefined) return 'Never stayed'
  if (days === 0) return 'Left today'
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`
  return `${Math.round(days / 365)} years ago`
}

/** Guests worth telephoning: they used to come and have not for a while. */
export function slippingAway(values: { guest: Guest; value: GuestValue }[]): { guest: Guest; value: GuestValue }[] {
  return values
    .filter((v) => v.value.stays >= 3 && (v.value.daysSince ?? 0) > 180)
    .sort((a, b) => b.value.paid - a.value.paid)
}
