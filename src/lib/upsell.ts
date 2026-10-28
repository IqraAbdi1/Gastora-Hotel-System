// Offering a guest something more, at the moment they would say yes.
//
// Upselling has a bad name because most of it is done badly: an email a week before arrival offering a
// suite to somebody who booked the cheapest room, or a desk clerk reciting a list. What works is
// narrow - offer the thing the hotel can actually deliver on those dates, at a price the guest can see
// is fair, at a moment they are already thinking about the stay.
//
// So every offer here has to pass three tests before it is shown:
//
//   1. The hotel can deliver it. An upgrade is only offered when a better room is genuinely free for
//      every night of the stay. An offer the desk has to withdraw costs more goodwill than it earns.
//   2. It is worth something to the guest and to the hotel. The upgrade is the real difference in
//      price, less the hotel's own discount for taking it now rather than selling it to nobody.
//   3. It is not already theirs. A guest who booked half board is not offered breakfast.
//
// Nothing here charges anybody. An offer accepted becomes a request the desk answers, because the room
// has to be moved by a person and because a room free an hour ago may not be free now.
//
// Pure rules only: no React.

import { freeByType, nightsOf } from './booking'
import { averageNightly } from './rateCalendar'
import type { SoldOn } from './rateCalendar'
import type { RatesPolicy } from './rates'
import type { AddOn } from './addOns'
import { priceOf } from './addOns'
import type { Reservation, Room } from '../types'

export type OfferKind = 'upgrade' | 'early' | 'late' | 'extra'

export const OFFER_LABEL: Record<OfferKind, string> = {
  upgrade: 'A better room',
  early: 'Come in early',
  late: 'Leave later',
  extra: 'Something extra',
}

export interface Offer {
  id: string
  kind: OfferKind
  title: string
  blurb: string
  /** What the guest pays. */
  price: number
  /** What it would normally cost, where the offer is cheaper than the rack price. */
  was?: number
  /** The room type being offered, for an upgrade. */
  toType?: Room['type']
  /** The extra being offered. */
  addOnId?: string
}

const ORDER: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

export interface UpsellSettings {
  /** How much is taken off the real difference to make an upgrade worth saying yes to. */
  upgradeDiscountPercent: number
  /** What coming in early costs, as a share of one night. */
  earlyPercent: number
  /** What leaving later costs, as a share of one night. */
  latePercent: number
  on: boolean
}

export const DEFAULT_UPSELL: UpsellSettings = {
  on: true,
  upgradeDiscountPercent: 30,
  earlyPercent: 50,
  latePercent: 50,
}

const tidy = (n: number) => Math.max(0, Math.round(n / 1000) * 1000)

/**
 * What this stay could be offered, worked out against the hotel's real availability and its own prices.
 *
 * `bought` is what the guest already has on their folio, so nothing is offered twice.
 */
export function offersFor(
  stay: Reservation,
  rooms: Room[],
  reservations: Reservation[],
  rates: RatesPolicy,
  addOns: AddOn[],
  settings: UpsellSettings,
  soldOn?: SoldOn,
): Offer[] {
  if (!settings.on) return []
  const out: Offer[] = []
  const nights = Math.max(1, nightsOf(stay.arrival, stay.departure))
  const adults = stay.adults ?? 2
  const bought = (stay.charges ?? []).map((c) => c.description)

  // A better room, only where one is genuinely free for every night of the stay.
  const free = freeByType(rooms, reservations, stay.arrival, stay.departure)
  const mine = ORDER.indexOf(stay.roomType)
  for (let i = ORDER.length - 1; i > mine; i--) {
    const type = ORDER[i]
    if ((free[type] ?? 0) < 1) continue
    const theirs = averageNightly(stay.roomType, stay.arrival, stay.departure, rates, soldOn)
    const better = averageNightly(type, stay.arrival, stay.departure, rates, soldOn)
    const difference = (better - theirs) * nights
    if (difference <= 0) continue
    const price = tidy(difference * (1 - settings.upgradeDiscountPercent / 100))
    out.push({
      id: `up-${type}`,
      kind: 'upgrade',
      title: `Move up to a ${type}`,
      blurb: `${nights} night${nights === 1 ? '' : 's'} in a ${type} instead of a ${stay.roomType}.`,
      price,
      was: tidy(difference),
      toType: type,
    })
    break
  }

  const nightly = averageNightly(stay.roomType, stay.arrival, stay.departure, rates, soldOn)

  if (stay.status === 'booked') {
    out.push({
      id: 'early',
      kind: 'early',
      title: 'Come in early',
      blurb: 'Your room held from the morning, instead of the usual hour.',
      price: tidy((nightly * settings.earlyPercent) / 100),
    })
  }

  if (stay.status === 'in-house' || stay.status === 'booked') {
    out.push({
      id: 'late',
      kind: 'late',
      title: 'Leave later',
      blurb: 'Keep the room into the afternoon on the day you go.',
      price: tidy((nightly * settings.latePercent) / 100),
    })
  }

  for (const a of addOns) {
    if (!a.on) continue
    if (bought.some((d) => d.startsWith(a.name))) continue
    out.push({
      id: `add-${a.id}`,
      kind: 'extra',
      title: a.name,
      blurb: a.blurb,
      price: priceOf(a, nights, adults),
      addOnId: a.id,
    })
  }

  return out
}

/** What an accepted offer should be posted as, where it is money rather than a room move. */
export function chargeFor(offer: Offer, addOns: AddOn[]): { category: string; description: string; amount: number } | null {
  if (offer.kind === 'upgrade') return null
  if (offer.kind === 'extra') {
    const a = addOns.find((x) => x.id === offer.addOnId)
    return a ? { category: a.category, description: `${a.name} (asked for by the guest)`, amount: offer.price } : null
  }
  return {
    category: 'Other',
    description: offer.kind === 'early' ? 'Early check-in (asked for by the guest)' : 'Late check-out (asked for by the guest)',
    amount: offer.price,
  }
}
