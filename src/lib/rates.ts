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
  /** How the deposit is worked out. A percentage alone does not cover a one-night penalty on a short stay. */
  depositMode: DepositMode
  /** Nights the deposit must cover, for the 'nights' and 'floor' rules. */
  depositNights: number
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
  /** Whether the clock may take the room back by itself, or only suggest it to the desk. */
  autoRelease: boolean
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
  depositMode: 'floor',
  depositNights: 1,
  changeFreeDays: 2,
  changeFeeNights: 1,
  cancelFreeDays: 2,
  cancelChargeNights: 1,
  noShowNights: 1,
  releaseTime: '18:00',
  autoRelease: true,
  houseRules: '',
}

/** The wording a hotel starts with, built from its own check-in and check-out times. */
export function defaultHouseRules(checkInTime: string, checkOutTime: string) {
  return (
    `Check-in from ${checkInTime}. Check-out by ${checkOutTime}. Smoking is not allowed in the rooms. ` +
    'Your booking, the identification shown at check-in and your bill are kept because the law and your stay ' +
    'require it. Being remembered between stays, and hearing from us afterwards, are your choice and you can ' +
    'change your mind at any time.'
  )
}

/** A meal plan id that is not already taken. */
export function newPlanId(plans: MealPlanSetting[]) {
  let n = plans.length + 1
  while (plans.some((p) => p.id === `plan-${n}`)) n += 1
  return `plan-${n}`
}

export const roomTypeList: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

/**
 * Every penalty in this system is counted in nights, so it scales with the room by itself. A deposit
 * set as a flat percentage does not: 30% of a three-night Standard is less than the one night the
 * hotel loses on a no-show, and 30% of a ten-night stay is far more. The rule closes that gap.
 */
export type DepositMode = 'percent' | 'nights' | 'floor'

export const DEPOSIT_MODE_LABEL: Record<DepositMode, string> = {
  percent: 'A share of the whole stay',
  nights: "A number of nights' rate",
  floor: 'A share, but never less than the nights below',
}

export const DEPOSIT_MODE_NOTE: Record<DepositMode, string> = {
  percent: 'Good for long stays and groups. On a short stay it can fall below what a no-show costs you.',
  nights: 'What most small hotels ask for: pay a night to hold the room. It follows the room price by itself.',
  floor: 'The safe default: the larger of the two, so short stays are covered and long stays are not over-charged.',
}

/** The nightly price of this stay, room plus whatever the meal plan adds. */
export function nightlyRate(type: Room['type'], planExtra: number, p: RatesPolicy): number {
  return (p.roomRates[type] ?? 0) + planExtra
}

/**
 * What the desk should ask for up front. Never more than the stay is worth — a one-night booking with a
 * one-night floor is simply paid in full — and rounded to a number someone can hand over in cash or on MoMo.
 */
export function depositFor(nightly: number, nights: number, p: RatesPolicy): number {
  const total = nightly * Math.max(1, nights)
  const byPercent = (total * p.depositPercent) / 100
  const byNights = nightly * Math.max(0, p.depositNights)
  const raw =
    p.depositMode === 'percent' ? byPercent : p.depositMode === 'nights' ? byNights : Math.max(byPercent, byNights)
  return Math.round(Math.min(raw, total) / 1000) * 1000
}

/** The words the desk and the guest see, so nobody has to work out where the number came from. */
export function depositExplained(nightly: number, nights: number, p: RatesPolicy): string {
  const total = nightly * Math.max(1, nights)
  const byPercent = (total * p.depositPercent) / 100
  const byNights = nightly * Math.max(0, p.depositNights)
  const nightWord = `${p.depositNights} night${p.depositNights === 1 ? '' : 's'}`
  if (p.depositMode === 'percent') return `${p.depositPercent}% of the stay`
  if (p.depositMode === 'nights') return `${nightWord} at this room's rate`
  if (Math.min(byPercent, total) >= byNights) return `${p.depositPercent}% of the stay, which is more than ${nightWord}`
  return `${nightWord} at this room's rate, which is more than ${p.depositPercent}%`
}

/** What a guarantee means for this hotel, in the hotel's own numbers. */
export function guaranteeRules(p: RatesPolicy) {
  const nights = (n: number) => `${n} night${n === 1 ? '' : 's'}`
  return {
    deposit: `If the guest does not arrive, ${nights(p.noShowNights)} is kept from the deposit and the rest is refunded.`,
    card: `If the guest does not arrive, ${nights(p.noShowNights)} is charged to the card.`,
    company: 'If the guest does not arrive, the stay is billed to the company.',
    none: `The room is released at ${p.releaseTime} on the arrival day if the guest has not arrived.`,
  }
}
