import type { Reservation } from '../types'

export const chargeCategories = ['Restaurant', 'Laundry', 'Minibar', 'Transport', 'Spa', 'Other']
export const paymentMethods = ['MTN MoMo', 'Airtel Money', 'Card', 'Cash']

const total = (list: { amount: number }[] | undefined) => (list ?? []).reduce((s, x) => s + x.amount, 0)

// Extras posted to the folio. The reservation total always includes them.
export function extrasOf(r: Reservation) {
  return total(r.charges)
}

// The folio is built from the reservation: room charge = total minus extras,
// and "earlier payments" = deposits taken before the folio existed.
export function folioOf(r: Reservation) {
  const extras = extrasOf(r)
  const received = total(r.payments)
  return {
    roomCharge: r.total - extras,
    extras,
    earlier: r.paid - received,
    received,
    total: r.total,
    paid: r.paid,
    balance: r.total - r.paid,
  }
}

// The hotel's own clock, not UTC. A stamp written at 00:30 in Kampala must read as that day, not the one before.
export function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}