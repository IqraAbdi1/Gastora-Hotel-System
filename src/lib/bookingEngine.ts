// The hotel's own booking engine: what a guest sees on the hotel's website, not what the desk sees.
//
// Everything a guest is shown here comes from the same rules the desk works under - the rate calendar,
// the restrictions, the real free-room count - because a website quoting a price the hotel will not
// honour, or selling a night the hotel has closed, is worse than no website.
//
// Two rules a guest's booking follows that a clerk's does not:
//
//   - No overbooking. A manager may knowingly sell the eleventh of ten rooms and carry the risk. A
//     stranger on a website may not, because nobody is there to decide.
//   - No override of a closed date, a minimum stay or a maximum stay. Those are the hotel's own
//     decisions and the website is not the place to argue with them.
//
// Pure rules only: no React.

import { depositForStay, freeByType, nightlyForStay, nightsOf, stayTotalBetween } from './booking'
import { priceNights, stayDiscountOf } from './rateCalendar'
import type { SoldOn } from './rateCalendar'
import type { RatesPolicy } from './rates'
import { refusedBy } from './rateRules'
import type { Reservation, Room } from '../types'

/** The address a hotel's own site points at: /book/lakeview-grand-hotel. */
export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export interface Search {
  arrival: string
  departure: string
  adults: number
  children: number
}

export interface Offer {
  type: Room['type']
  planId: string
  /** Rooms of this type free for every night of the stay. */
  free: number
  /** The average night, room and package together. */
  nightly: number
  total: number
  deposit: number
  /** Set when the hotel will not sell these dates at all, with the reason the hotel wrote. */
  refusal?: string
  /** The length-of-stay discount already inside the total, with the words the guest is shown. */
  stayDeal?: { label: string; saving: number }
}

export const MAX_ADULTS_PER_ROOM = 3

/** Whether the dates themselves make sense before anything is looked up. */
export function searchProblem(s: Search, today: string): string | undefined {
  if (!s.arrival || !s.departure) return 'Choose the day you arrive and the day you leave.'
  if (s.arrival < today) return 'The day you arrive cannot be in the past.'
  if (nightsOf(s.arrival, s.departure) < 1) return 'The day you leave must be after the day you arrive.'
  if (nightsOf(s.arrival, s.departure) > 60) return 'For a stay longer than sixty nights, please telephone the hotel.'
  if (s.adults < 1) return 'A booking needs at least one adult.'
  return undefined
}

/**
 * What the hotel can honestly sell for these dates, one line per room type and package.
 *
 * A type with no room free is still returned, so the guest is told it is taken rather than left to
 * wonder whether the hotel has it at all.
 */
export function offersFor(
  s: Search,
  rooms: Room[],
  reservations: Reservation[],
  rates: RatesPolicy,
  soldOn?: SoldOn,
): Offer[] {
  const free = freeByType(rooms, reservations, s.arrival, s.departure)
  const nights = nightsOf(s.arrival, s.departure)
  const types = Object.keys(free) as Room['type'][]
  const out: Offer[] = []

  for (const type of types) {
    for (const plan of rates.plans) {
      const no = refusedBy(rates.rules, type, s.arrival, s.departure, plan.id, plan.name)
      out.push({
        type,
        planId: plan.id,
        // A website never sells past the house. The overbooking allowance is the desk's to spend.
        free: Math.max(0, free[type]),
        nightly: nightlyForStay(type, plan.id, s.arrival, s.departure, rates, soldOn),
        total: stayTotalBetween(type, plan.id, s.arrival, s.departure, rates, soldOn),
        deposit: depositForStay(type, plan.id, nights, rates, { arrival: s.arrival, departure: s.departure }, soldOn),
        refusal: no?.why,
        stayDeal: stayDiscountOf(priceNights(type, s.arrival, s.departure, rates, soldOn, { planId: plan.id })),
      })
    }
  }
  return out
}

export const bookable = (o: Offer): boolean => !o.refusal && o.free > 0

/** How many rooms of a type a party of this size needs, so a guest is not sold one room for six people. */
export const roomsNeeded = (adults: number): number => Math.max(1, Math.ceil(adults / MAX_ADULTS_PER_ROOM))

// ---- The payment, simulated ----
//
// The shape is the real one: the hotel asks, the provider takes a moment, and the booking is confirmed
// only when the provider says so. Mobile money in Uganda works exactly this way - the guest approves it
// on their handset and the hotel waits for the callback - so a prototype that confirmed instantly would
// be teaching the wrong thing. No money moves here and no provider is contacted.

export type PayState = 'idle' | 'pending' | 'paid' | 'failed'

export const PAY_METHODS = ['MTN MoMo', 'Airtel Money', 'Card'] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export const PAY_PROMPT: Record<PayMethod, string> = {
  'MTN MoMo': 'Approve the payment on your handset. We are waiting for MTN to confirm it.',
  'Airtel Money': 'Approve the payment on your handset. We are waiting for Airtel to confirm it.',
  Card: 'Your bank is checking the card. This takes a few seconds.',
}

export const PAY_FAILED: Record<PayMethod, string> = {
  'MTN MoMo': 'MTN did not confirm the payment. Nothing has been taken. Try again, or telephone the hotel.',
  'Airtel Money': 'Airtel did not confirm the payment. Nothing has been taken. Try again, or telephone the hotel.',
  Card: 'The bank declined the card. Nothing has been taken. Try another card, or telephone the hotel.',
}

/** A booking reference a guest can read down a telephone. */
export function reference(seed: string): string {
  let h = 17
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) % 1000000
  return `GB-${String(h).padStart(6, '0')}`
}
