// Paying the bill from the guest's own page.
//
// A guest who can see what they owe and cannot pay it from the same page will telephone, or queue at
// the desk on the morning they leave. This lets them pay all of it, or part of it, by mobile money or
// card, whenever they like.
//
// The payment itself is simulated exactly the way the booking page simulates a deposit (see
// bookingEngine.ts, "The payment, simulated"): the guest approves it, the provider takes a moment, and
// nothing is recorded until the provider says yes. No money moves and no provider is contacted.
//
// Where the money goes depends on where the guest is:
//
//   - In the hotel: the payment is a line on their folio, the same as one the desk takes.
//   - Not arrived yet: there is no folio until check-in, so it is recorded against the booking the way a
//     deposit is. It still carries a line, so the desk can see where it came from.
//
// Pure rules only: no React.

import type { PayMethod } from './bookingEngine'
import type { Reservation } from '../types'

export const isMobileMoney = (m: PayMethod): boolean => m !== 'Card'

/** The smallest part payment worth sending a provider. Below this the fee is more than the money. */
export const MIN_PART_PAYMENT = 1000

/** Ugandan mobile numbers by network. Ported numbers exist, so a mismatch is a question, not a refusal. */
const PREFIXES: Record<'MTN MoMo' | 'Airtel Money', string[]> = {
  'MTN MoMo': ['076', '077', '078', '079'],
  'Airtel Money': ['070', '074', '075'],
}

/** 0772 123 456, +256 772 123 456 and 256772123456 all become 0772123456. */
export function tidyPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('256') && digits.length === 12) return `0${digits.slice(3)}`
  return digits
}

/** What the guest sees on the receipt: never the whole number. */
export const maskPhone = (raw: string): string => {
  const p = tidyPhone(raw)
  return p.length >= 4 ? `•••• ${p.slice(-3)}` : p
}

export interface PayInput {
  method: PayMethod
  amount: number
  phone: string
  /** Card number as typed. Only the last four are ever kept. */
  card: string
}

/** Why this payment cannot be sent yet, in words a guest understands. */
export function payProblem(input: PayInput, balance: number): string | undefined {
  if (balance <= 0) return 'There is nothing to pay.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter how much you want to pay.'
  if (input.amount > balance) return `You owe UGX ${balance.toLocaleString('en-US')}. You cannot pay more than that here.`
  if (input.amount < Math.min(MIN_PART_PAYMENT, balance)) return `The smallest payment is UGX ${MIN_PART_PAYMENT.toLocaleString('en-US')}.`
  if (isMobileMoney(input.method)) {
    const p = tidyPhone(input.phone)
    if (p.length !== 10 || !p.startsWith('07')) return 'Enter the mobile number the money comes from, like 0772 123 456.'
    const net = input.method as 'MTN MoMo' | 'Airtel Money'
    if (!PREFIXES[net].includes(p.slice(0, 3))) {
      return `${p.slice(0, 4)}… does not look like ${net === 'MTN MoMo' ? 'an MTN' : 'an Airtel'} number. Check the number or choose the other network.`
    }
  } else {
    const c = input.card.replace(/\D/g, '')
    if (c.length < 12 || c.length > 19) return 'Enter the card number.'
  }
  return undefined
}

/** A receipt for a payment the guest made themselves. Kept so they can open it again later. */
export interface GuestPayment {
  id: string
  at: string
  reservationId: string
  guest: string
  amount: number
  method: PayMethod
  /** "•••• 456" or "Card ending 4242". */
  from: string
  /** The provider's reference. Simulated: a real one comes back from MTN, Airtel or the bank. */
  providerRef: string
  /** Where the hotel recorded it. */
  postedAs: 'folio' | 'booking'
  balanceBefore: number
  balanceAfter: number
}

export function receiptNumber(list: GuestPayment[]): string {
  let n = list.length + 1
  while (list.some((p) => p.id === `RCP-${String(n).padStart(4, '0')}`)) n += 1
  return `RCP-${String(n).padStart(4, '0')}`
}

/** Stands in for the provider's transaction id. */
export function fakeProviderRef(method: PayMethod, seed: string): string {
  let h = 11
  for (const ch of seed) h = (h * 37 + ch.charCodeAt(0)) % 1000000007
  const prefix = method === 'MTN MoMo' ? 'MP' : method === 'Airtel Money' ? 'AM' : 'CD'
  return `${prefix}${String(h).padStart(10, '0')}-SIM`
}

/** Only a stay that is coming or here can be paid for from the page. */
export const canPayFor = (r: Reservation): boolean => r.status === 'booked' || r.status === 'in-house'

export const postedAsFor = (r: Reservation): GuestPayment['postedAs'] => (r.status === 'in-house' ? 'folio' : 'booking')
