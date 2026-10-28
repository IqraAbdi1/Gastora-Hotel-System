// Promotional codes: a price the hotel offers to people who know a word.
//
// The point of a code, as against a lower rate, is that it is given to somebody - a conference list, a
// returning guest, a radio advertisement - and can be counted afterwards. So every code here carries
// its own limits and its own tally: what it takes off, which rooms and packages it covers, which dates
// a guest may travel on, how long it may be used for, and how many times it has been.
//
// One code at a time, and never on top of a company's agreed price. Discounts that stack are how a
// hotel sells a room for less than it costs and only finds out at the end of the month.
//
// Pure rules only: no React.

import { nightsOf } from './booking'
import type { Room } from '../types'

export interface Promo {
  id: string
  /** What the guest types. Compared without case or spaces. */
  code: string
  name: string
  how: 'percent' | 'amount'
  /** A percentage off, or an amount off each night. */
  value: number
  /** Travel dates it covers. Empty means any date. */
  from?: string
  to?: string
  /** The last day it may be used. Empty means no closing date. */
  bookBy?: string
  /** Room types it covers. Empty means every type. */
  types?: Room['type'][]
  /** Rate plans it covers. Empty means every plan. */
  plans?: string[]
  minNights?: number
  /** How many bookings may use it. 0 means no limit. */
  maxUses: number
  used: number
  on: boolean
}

export const tidyCode = (s: string): string => s.replace(/\s+/g, '').toUpperCase()

export const findPromo = (list: Promo[], code: string): Promo | undefined =>
  list.find((p) => tidyCode(p.code) === tidyCode(code))

export interface PromoUse {
  arrival: string
  departure: string
  type: Room['type']
  planId: string
  /** True when a company's agreed price already applies to this booking. */
  onCompanyPrice?: boolean
}

/**
 * Why a code cannot be used, in words the guest reading them deserves. Returns nothing when it may.
 *
 * Each reason says what is wrong rather than "invalid code", because a guest told only that a code is
 * invalid telephones the hotel, and the hotel cannot see what they typed.
 */
export function promoProblem(promo: Promo, use: PromoUse, today: string): string | undefined {
  if (!promo.on) return 'That code is no longer being offered.'
  if (promo.bookBy && today > promo.bookBy) return `That code closed on ${promo.bookBy}.`
  if (promo.maxUses > 0 && promo.used >= promo.maxUses) return 'That code has been used as many times as it was meant to be.'
  if (promo.from && use.arrival < promo.from) return `That code is for stays from ${promo.from}.`
  // The last night of the stay, not the departure day: a guest leaving on the 5th did not sleep on it.
  if (promo.to && use.departure > nextDay(promo.to)) return `That code is for stays up to ${promo.to}.`
  if (promo.types?.length && !promo.types.includes(use.type)) return `That code is for ${promo.types.join(' and ')} rooms.`
  if (promo.plans?.length && !promo.plans.includes(use.planId)) return 'That code does not cover this package.'
  if (promo.minNights && nightsOf(use.arrival, use.departure) < promo.minNights) {
    return `That code needs a stay of at least ${promo.minNights} nights.`
  }
  if (use.onCompanyPrice) return 'This booking already has a company price, and the two are not added together.'
  return undefined
}

const nextDay = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

/** What the code takes off a stay. Never more than the stay is worth. */
export function promoSaving(promo: Promo, total: number, nights: number): number {
  const raw = promo.how === 'percent' ? (total * promo.value) / 100 : promo.value * Math.max(1, nights)
  return Math.min(total, Math.max(0, Math.round(raw / 100) * 100))
}

export const describePromo = (p: Promo): string =>
  p.how === 'percent' ? `${p.value}% off` : `UGX ${p.value.toLocaleString('en-US')} off each night`

export function newPromoId(list: Promo[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `promo-${n}`)) n += 1
  return `promo-${n}`
}
