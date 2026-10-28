// Checking out from the guest's own page.
//
// The guest looks at the final bill on their phone, pays it there or has it covered by what is already
// securing the stay, says where they will leave the key, and goes. It is express checkout started by
// the guest rather than the desk, and it follows the same rule (expressCheckout.ts): a stay can only
// leave by itself if there is nothing to collect, or something the hotel can actually charge - a card,
// or a company account for a guest who owes nothing of their own. A deposit already taken cannot be
// charged again, so a guest with only a deposit and a balance is asked to pay first.
//
// Two outcomes:
//
//   - Done by itself: on the day of departure, when the hotel has express checkout and lets guests
//     finish it themselves. The money is taken first and the stay is checked out second.
//   - A request: the day before, or when the hotel wants a person to look. The desk completes it with
//     one click on the Today page, and the check is made again at that moment.
//
// The guest can start the day before but is never checked out early: a request made the evening before
// waits for the morning. The key is not tracked here; the guest only says where it will be, and the
// desk reads that.
//
// Pure rules only: no React.

import { addDays } from './availability'
import { expressCheck } from './expressCheckout'
import type { ExpressCheck } from './expressCheckout'
import type { Reservation } from '../types'

export type KeyReturn = 'room' | 'desk'

export const KEY_RETURN_LABEL: Record<KeyReturn, string> = {
  room: 'Key left in the room',
  desk: 'Key left at the desk',
}

export interface OnlineCheckout {
  id: string
  at: string
  reservationId: string
  guest: string
  room?: string
  /** The day the stay ends, so a request made the evening before reads as tomorrow's. */
  departure: string
  keys: KeyReturn
  state: 'requested' | 'done' | 'cancelled'
  /** What was owed by the guest when they asked, and where it would go. */
  owed: number
  chargeTo: string
  /** Who finished it: the guest's own page, or a person at the desk. */
  doneVia?: 'guest' | 'desk'
  doneBy?: string
  doneAt?: string
  /** Why the desk could not finish it, in words the guest could be told. */
  note?: string
}

/** In the hotel, and leaving today or tomorrow. Someone past their departure date can still use it. */
export function inCheckoutWindow(r: Reservation, today: string): boolean {
  return r.status === 'in-house' && r.departure <= addDays(today, 1)
}

export interface OnlineCheck {
  ok: boolean
  /** Why not, in words for the guest. */
  why?: string
  express: ExpressCheck
}

/** Whether this guest may check out online, using the same rule as express checkout. */
export function onlineCheck(r: Reservation, accountName: string | undefined, limit: number): OnlineCheck {
  const express = expressCheck(r, accountName, limit)
  if (express.ok) return { ok: true, express }
  const why =
    express.why === 'over the limit'
      ? 'Your bill is larger than the hotel settles without somebody looking at it. Please pay it here first, or stop at the desk.'
      : express.why === 'company only covers the room'
        ? 'Your company pays for the room, but the extras are yours to pay. Please pay them here first.'
        : 'There is a balance to pay and nothing on file to charge it to. Please pay it here first.'
  return { ok: false, why, express }
}

/** Finished by itself only on the day, when the hotel has express checkout and allows guests to finish it. */
export function finishesItself(r: Reservation, today: string, expressOn: boolean, selfAllowed: boolean, check: OnlineCheck): boolean {
  return expressOn && selfAllowed && check.ok && r.departure <= today
}

export function newCheckoutId(list: OnlineCheckout[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `OC-${String(n).padStart(3, '0')}`)) n += 1
  return `OC-${String(n).padStart(3, '0')}`
}

/** The guest's open or finished checkout for this stay, if any. A cancelled one does not count. */
export const checkoutFor = (list: OnlineCheckout[], reservationId: string): OnlineCheckout | undefined =>
  list.find((x) => x.reservationId === reservationId && x.state !== 'cancelled')
