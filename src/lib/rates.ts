import type { Room } from '../types'

// The hotel's own prices and booking rules, set by the hotel admin or owner.
// These are the normal rates every guest pays. A company's agreed prices are separate:
// they live on that company's account and only apply to its own bookings.

export interface MealPlanSetting {
  id: string
  name: string
  inclusions: string
  /** Added to the room rate, per night. */
  extraPerNight: number
}

export interface RatesPolicy {
  /** The published price of one night, by room type. */
  roomRates: Record<Room['type'], number>
  plans: MealPlanSetting[]
  /** Share of the total suggested as a deposit when the desk takes a booking. */
  depositPercent: number
  /** Changing a booking is free this many days or more before arrival. */
  changeFreeDays: number
  /** Nights charged for a change made closer than that. */
  changeFeeNights: number
  /** Cancelling is free this many days or more before arrival. */
  cancelFreeDays: number
  /** Nights charged for a late cancellation. */
  cancelChargeNights: number
  /** Nights charged when a guest never arrives. */
  noShowNights: number
  /** A booking with no deposit or card is released at this time on the arrival day. */
  releaseTime: string
  /** Printed on the registration card. Empty means use the wording built from the hotel's times. */
  houseRules: string
}

export const DEFAULT_RATES: RatesPolicy = {
  roomRates: { Standard: 150000, Deluxe: 180000, Suite: 350000 },
  plans: [
    { id: 'room-only', name: 'Room only', inclusions: 'Room and Wi-Fi', extraPerNight: 0 },
    { id: 'bb', name: 'Bed and breakfast', inclusions: 'Room, Wi-Fi and breakfast for two', extraPerNight: 30000 },
    { id: 'hb', name: 'Half board', inclusions: 'Room, breakfast and dinner for two', extraPerNight: 70000 },
  ],
  depositPercent: 30,
  changeFreeDays: 2,
  changeFeeNights: 1,
  cancelFreeDays: 2,
  cancelChargeNights: 1,
  noShowNights: 1,
  releaseTime: '18:00',
  houseRules: '',
}

/** The wording a hotel starts with, built from its own check-in and check-out times. */
export function defaultHouseRules(checkInTime: string, checkOutTime: string) {
  return `Check-in from ${checkInTime}. Check-out by ${checkOutTime}. Smoking is not allowed in the rooms.`
}

/** A meal plan id that is not already taken. */
export function newPlanId(plans: MealPlanSetting[]) {
  let n = plans.length + 1
  while (plans.some((p) => p.id === `plan-${n}`)) n += 1
  return `plan-${n}`
}

export const roomTypeList: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

/** What a guarantee means for this hotel, in the hotel's own numbers. */
export function guaranteeRules(p: RatesPolicy) {
  const nights = (n: number) => `${n} night${n === 1 ? '' : 's'}`
  return {
    deposit: 'If the guest does not arrive, the deposit is kept as the no-show charge.',
    card: `If the guest does not arrive, ${nights(p.noShowNights)} is charged to the card.`,
    company: 'If the guest does not arrive, the stay is billed to the company.',
    none: `The room is released at ${p.releaseTime} on the arrival day if the guest has not arrived.`,
  }
}
