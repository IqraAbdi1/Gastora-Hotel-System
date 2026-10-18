// Extras the hotel sells with a room: an airport pickup, a late checkout bought in advance, a cake
// waiting in the room.
//
// These are the things a guest would otherwise telephone about, and a hotel that lets them be bought
// at the moment of booking sells far more of them than one that waits to be asked. They are also the
// cheapest money a hotel makes, because the room is already sold.
//
// Each one is posted to the folio as an ordinary charge under one of the hotel's own categories, so it
// reaches the bill, the tax lines and the company's invoice by exactly the same road as a charge the
// desk posts by hand. Nothing here is a special kind of money.
//
// Pure rules only: no React.

import type { FolioCharge } from '../types'

/** How the price is worked out. A pickup is once; a cot is every night; a tour is each person. */
export type Per = 'stay' | 'night' | 'person'

export const PER_LABEL: Record<Per, string> = {
  stay: 'once',
  night: 'each night',
  person: 'each person',
}

export interface AddOn {
  id: string
  name: string
  /** One line the guest reads before deciding. */
  blurb: string
  price: number
  per: Per
  /** The hotel's own charge category, so it reaches the bill the usual way. */
  category: string
  on: boolean
}

export const DEFAULT_ADD_ONS: AddOn[] = [
  {
    id: 'addon-1',
    name: 'Airport pickup',
    blurb: 'A driver meets you at Entebbe with your name on a board.',
    price: 180000,
    per: 'stay',
    category: 'Transport',
    on: false,
  },
  {
    id: 'addon-2',
    name: 'Breakfast in the room',
    blurb: 'Brought up at the hour you ask for.',
    price: 35000,
    per: 'night',
    category: 'Restaurant',
    on: false,
  },
  {
    id: 'addon-3',
    name: 'Cake and flowers on arrival',
    blurb: 'Waiting in the room when you walk in.',
    price: 90000,
    per: 'stay',
    category: 'Other',
    on: false,
  },
]

/** What one add-on comes to for this stay. */
export function priceOf(a: AddOn, nights: number, adults: number): number {
  const times = a.per === 'night' ? Math.max(1, nights) : a.per === 'person' ? Math.max(1, adults) : 1
  return a.price * times
}

export const describeAddOn = (a: AddOn): string => `${PER_LABEL[a.per]}`

/** What a guest's choices come to altogether. */
export const addOnsTotal = (chosen: AddOn[], nights: number, adults: number): number =>
  chosen.reduce((n, a) => n + priceOf(a, nights, adults), 0)

/**
 * The folio lines for what was bought at booking.
 *
 * They are posted dated to the booking, not to the stay, because that is when the guest agreed to them
 * and that is when the hotel would have to refund them if the booking fell through.
 */
export function chargesFor(chosen: AddOn[], nights: number, adults: number, at: string): FolioCharge[] {
  return chosen.map((a, n) => ({
    id: `ADD-${at.slice(0, 10).replace(/-/g, '')}-${n + 1}-${a.id}`,
    at,
    category: a.category,
    description: `${a.name} (booked online, ${PER_LABEL[a.per]})`,
    amount: priceOf(a, nights, adults),
  }))
}

export function newAddOnId(list: AddOn[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `addon-${n}`)) n += 1
  return `addon-${n}`
}
