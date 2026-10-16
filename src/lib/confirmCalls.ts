import type { Reservation } from '../types'

/**
 * A booking with no deposit and no card is not really held: there is nothing to charge and nothing to
 * keep. The protection was never a penalty, it is ringing the guest on the arrival day and getting the
 * room back on sale early enough to sell it again.
 */

export type CallOutcome = 'confirmed' | 'no answer' | 'cancelling'

export interface ConfirmCall {
  at: string
  by: string
  outcome: CallOutcome
}

export const CALL_OUTCOMES: { key: CallOutcome; label: string; note: string }[] = [
  { key: 'confirmed', label: 'They are coming', note: 'The guest confirmed. The room is held.' },
  { key: 'no answer', label: 'No answer', note: 'Nobody picked up. Try again before the release time.' },
  { key: 'cancelling', label: 'They are not coming', note: 'Cancel the booking and put the room back on sale.' },
]

/** Nothing is securing this booking: no money paid, no card, no company behind it. */
export function isUnguaranteed(r: Reservation): boolean {
  if (r.corporate) return false
  if (r.guarantee === 'deposit' || r.guarantee === 'card' || r.guarantee === 'company') return false
  return r.paid <= 0
}

export type CallState = 'to call' | 'chase' | 'confirmed' | 'not coming' | 'overdue'

/** HH:MM comparison. Both come from the same clock, so a plain string compare is enough. */
export const pastTime = (now: string, mark: string) => now >= mark

export function callState(r: Reservation, releaseTime: string, now: string): CallState {
  const outcome = r.confirmCall?.outcome
  if (outcome === 'confirmed') return 'confirmed'
  if (outcome === 'cancelling') return 'not coming'
  if (pastTime(now, releaseTime)) return 'overdue'
  return outcome === 'no answer' ? 'chase' : 'to call'
}

export const CALL_STATE_LABEL: Record<CallState, string> = {
  'to call': 'To call',
  chase: 'Try again',
  confirmed: 'Coming',
  'not coming': 'Not coming',
  overdue: 'Past the release time',
}

/** Today's arrivals that nothing is securing, worst first. */
export function toConfirm(reservations: Reservation[], today: string, releaseTime: string, now: string) {
  const rank: Record<CallState, number> = {
    overdue: 0,
    'not coming': 1,
    chase: 2,
    'to call': 3,
    confirmed: 4,
  }
  return reservations
    .filter((r) => r.status === 'booked' && r.arrival === today && isUnguaranteed(r))
    .map((r) => ({ reservation: r, state: callState(r, releaseTime, now) }))
    .sort((a, b) => rank[a.state] - rank[b.state] || a.reservation.id.localeCompare(b.reservation.id))
}

/** Rooms the hotel could put back on sale right now, because nobody confirmed and the time has passed. */
export function releasable(reservations: Reservation[], today: string, releaseTime: string, now: string) {
  return toConfirm(reservations, today, releaseTime, now).filter((x) => x.state === 'overdue' || x.state === 'not coming')
}
