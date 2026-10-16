import { nightsOf } from './booking'
import type { Guest, Reservation } from '../types'

// Recognising guests who come back. Rules, not AI: a stay count is arithmetic, not a guess.
// Every hotel sets its own tiers, so a lodge and a city hotel can reward very differently.

export interface LoyaltyTier {
  id: string
  name: string
  /** A guest reaches the tier on either count, whichever comes first. */
  minStays: number
  minNights: number
  /** Off the room rate. The meal plan and extras are never discounted. */
  discountPercent: number
  freeUpgrade: boolean
  lateCheckout: boolean
  /** Anything else the hotel gives, in its own words. */
  perks: string[]
}

export interface LoyaltySettings {
  on: boolean
  /** Three tiers, smallest first. The hotel renames them as it likes. */
  tiers: LoyaltyTier[]
  /** On: the discount is taken off automatically. Off: the desk sees it and a manager must approve. */
  autoApply: boolean
}

export const DEFAULT_LOYALTY: LoyaltySettings = {
  on: true,
  autoApply: false,
  tiers: [
    { id: 'T1', name: 'Bronze', minStays: 3, minNights: 5, discountPercent: 5, freeUpgrade: false, lateCheckout: true, perks: [] },
    { id: 'T2', name: 'Silver', minStays: 6, minNights: 12, discountPercent: 10, freeUpgrade: true, lateCheckout: true, perks: ['Welcome drink'] },
    { id: 'T3', name: 'Gold', minStays: 12, minNights: 25, discountPercent: 15, freeUpgrade: true, lateCheckout: true, perks: ['Welcome drink', 'Airport pickup'] },
  ],
}

export interface StayHistory {
  stays: number
  nights: number
  lastStay?: string
  /** Money the guest has spent on finished stays. */
  spent: number
}

/** A guest's finished stays. Only checked-out stays count, so a booking cannot be used to climb a tier. */
export function stayHistory(guest: Pick<Guest, 'id' | 'name'>, reservations: Reservation[], ignoreId?: string): StayHistory {
  let stays = 0
  let nights = 0
  let spent = 0
  let lastStay: string | undefined
  for (const r of reservations) {
    if (r.id === ignoreId) continue
    if (r.status !== 'checked-out') continue
    const mine = r.guestId ? r.guestId === guest.id : r.guest === guest.name
    if (!mine) continue
    stays += 1
    nights += Math.max(1, nightsOf(r.arrival, r.departure))
    spent += r.paid
    if (!lastStay || r.departure > lastStay) lastStay = r.departure
  }
  return { stays, nights, lastStay, spent }
}

/** The tier a history earns, or null. The highest tier the guest qualifies for wins. */
export function tierFor(history: StayHistory, settings: LoyaltySettings): LoyaltyTier | null {
  if (!settings.on) return null
  let found: LoyaltyTier | null = null
  for (const t of settings.tiers) {
    if (history.stays >= t.minStays || history.nights >= t.minNights) found = t
  }
  return found
}

/** What the guest still needs for the next tier up, for the desk to mention. */
export function nextTier(history: StayHistory, settings: LoyaltySettings): { tier: LoyaltyTier; staysToGo: number; nightsToGo: number } | null {
  if (!settings.on) return null
  const current = tierFor(history, settings)
  const index = current ? settings.tiers.findIndex((t) => t.id === current.id) : -1
  const next = settings.tiers[index + 1]
  if (!next) return null
  return {
    tier: next,
    staysToGo: Math.max(0, next.minStays - history.stays),
    nightsToGo: Math.max(0, next.minNights - history.nights),
  }
}

/**
 * The loyalty discount on a stay. The room only: the meal plan and extras are never discounted.
 * A company-priced stay gets nothing, because the company already has an agreed rate.
 */
export function loyaltyDiscount(tier: LoyaltyTier | null, roomTotal: number, hasCompanyPrice: boolean): number {
  if (!tier || tier.discountPercent <= 0 || hasCompanyPrice) return 0
  return Math.round((roomTotal * tier.discountPercent) / 100 / 100) * 100
}

/** The few things worth tapping at check-in. Short, so the desk actually uses them. */
export const PREFERENCE_TAGS = [
  'Quiet room',
  'High floor',
  'Ground floor',
  'Near the lift',
  'Twin beds',
  'Double bed',
  'Extra pillows',
  'Early breakfast',
  'No pork',
  'Vegetarian',
  'Halal',
  'Airport pickup',
]

export const benefitList = (t: LoyaltyTier): string[] =>
  [
    t.discountPercent > 0 ? `${t.discountPercent}% off the room` : '',
    t.freeUpgrade ? 'Free upgrade when a better room is free' : '',
    t.lateCheckout ? 'Late check-out at no charge' : '',
    ...t.perks,
  ].filter(Boolean)
