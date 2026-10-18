// Leaving without stopping at the desk.
//
// On a busy morning every departing guest queues for the same receptionist to read out a bill they
// already expect. Express checkout removes the queue: the bill settles itself against whatever is
// already securing the stay, and a copy goes to the guest.
//
// The whole feature turns on one question - is there something the hotel can actually charge? A card
// or a company account can be charged. A deposit already taken cannot be charged again, and a booking
// with no guarantee has nothing behind it at all. Offering express checkout to those guests would mean
// letting them walk out owing money, so the system refuses and says why.
//
// Pure rules only: no React.

import type { Reservation } from '../types'
import { splitFolio } from './folioSplit'

export interface Express {
  agreedAt: string
  agreedBy: string
  /** How the guest said yes: at the desk, or by answering the message. */
  agreedVia: 'desk' | 'guest'
  doneAt?: string
  chargedAmount?: number
  method?: string
}

export type ExpressRefusal =
  | 'nothing to charge'
  | 'company only covers the room'
  | 'over the limit'
  | 'not in house'

export const REFUSAL_NOTE: Record<ExpressRefusal, string> = {
  'nothing to charge':
    'Nothing on file to charge. A deposit already taken cannot be charged again, so this guest has to settle at the desk.',
  'company only covers the room':
    'The company pays the room but the guest owes extras, and there is no card on file for them.',
  'over the limit': 'The balance is above what this hotel allows to be settled without a person looking at it.',
  'not in house': 'The guest is not in house.',
}

export interface ExpressCheck {
  ok: boolean
  why?: ExpressRefusal
  /** What the guest's own side comes to. */
  guestOwed: number
  /** What goes to the company account instead of being charged now. */
  companyOwed: number
  /** Where the guest's side would be charged. */
  chargeTo: string
}

/**
 * Whether this stay can leave by itself, and what would happen if it did.
 * `limit` is the most the hotel allows to be settled with nobody looking; 0 means no limit.
 */
export function expressCheck(r: Reservation, accountName: string | undefined, limit: number): ExpressCheck {
  const s = splitFolio(r, accountName)
  const guestOwed = s.split ? s.guestBalance : Math.max(0, s.guest.total - s.paid)
  const companyOwed = s.split ? s.companyBalance : 0
  const card = r.guarantee === 'card'
  const company = r.guarantee === 'company' || !!r.corporate
  const chargeTo = card ? 'the card on file' : company && guestOwed === 0 ? 'the company account' : ''

  if (r.status !== 'in-house') return { ok: false, why: 'not in house', guestOwed, companyOwed, chargeTo }
  // Nothing owed by the guest is the simplest case of all: there is nothing to collect.
  if (guestOwed === 0) return { ok: true, guestOwed, companyOwed, chargeTo: companyOwed > 0 ? 'the company account' : 'nothing to collect' }
  if (!card) {
    return {
      ok: false,
      why: company ? 'company only covers the room' : 'nothing to charge',
      guestOwed,
      companyOwed,
      chargeTo,
    }
  }
  if (limit > 0 && guestOwed > limit) return { ok: false, why: 'over the limit', guestOwed, companyOwed, chargeTo }
  return { ok: true, guestOwed, companyOwed, chargeTo }
}

export type ExpressState = 'not offered' | 'agreed' | 'done'

export function expressState(r: Reservation): ExpressState {
  if (r.express?.doneAt) return 'done'
  if (r.express?.agreedAt) return 'agreed'
  return 'not offered'
}

/** Everyone leaving today who has agreed to it and can still go through with it. */
export function readyToGo(
  reservations: Reservation[],
  today: string,
  accountNameOf: (r: Reservation) => string | undefined,
  limit: number,
): { reservation: Reservation; check: ExpressCheck }[] {
  return reservations
    .filter((r) => r.status === 'in-house' && r.departure === today && expressState(r) === 'agreed')
    .map((r) => ({ reservation: r, check: expressCheck(r, accountNameOf(r), limit) }))
}

/** Agreed, but something has changed since and it can no longer go through. The desk must catch these. */
export function blocked(
  reservations: Reservation[],
  today: string,
  accountNameOf: (r: Reservation) => string | undefined,
  limit: number,
): { reservation: Reservation; check: ExpressCheck }[] {
  return readyToGo(reservations, today, accountNameOf, limit).filter((x) => !x.check.ok)
}

export const DEFAULT_EXPRESS_MAX = 1000000
