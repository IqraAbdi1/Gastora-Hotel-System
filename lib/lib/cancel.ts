import { TODAY } from '../data/sample'
import { FEE_WINDOW_DAYS } from './amend'
import { nightsOf } from './booking'
import type { Reservation } from '../types'

// Sample policy, not from the SRS. Each hotel will set its own.
export type CancelMode = 'cancel' | 'no-show'

export const cancelReasons = ['Guest request', 'Change of plans', 'Found another hotel', 'Travel problem', 'Duplicate booking', 'Other']

export type CancelCheck = {
  error: string | null
  perNight: number
  fullCharge: number // charge before any waiver
  charge: number
  refund: number // simulated: what would go back to the guest
  owed: number // what the guest (or company) still owes
  chargeApplies: boolean
}

export function checkCancel(r: Reservation, mode: CancelMode, waive: boolean): CancelCheck {
  const perNight = Math.round(r.total / Math.max(1, nightsOf(r.arrival, r.departure)))
  const base: CancelCheck = { error: null, perNight, fullCharge: 0, charge: 0, refund: 0, owed: 0, chargeApplies: false }

  if (r.status !== 'booked') return { ...base, error: 'Only a booked stay can be cancelled or marked no-show.' }
  if (mode === 'no-show' && r.arrival > TODAY) return { ...base, error: `The guest is not due yet. Arrival is ${r.arrival}.` }

  let fullCharge = 0
  if (mode === 'cancel') {
    // Free until FEE_WINDOW_DAYS before arrival, then one night
    fullCharge = nightsOf(TODAY, r.arrival) < FEE_WINDOW_DAYS ? perNight : 0
  } else {
    // No-show follows the guarantee on the booking (see data/rates.ts)
    const g = r.guarantee ?? (r.paid > 0 ? 'deposit' : 'none')
    if (g === 'deposit') fullCharge = r.paid
    else if (g === 'card' || g === 'company') fullCharge = perNight
  }

  const charge = waive ? 0 : fullCharge
  return {
    ...base,
    fullCharge,
    charge,
    refund: Math.max(0, r.paid - charge),
    owed: Math.max(0, charge - r.paid),
    chargeApplies: fullCharge > 0,
  }
}