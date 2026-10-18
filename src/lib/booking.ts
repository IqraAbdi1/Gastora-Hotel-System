import { DEPOSIT_RATE, ratePlans, roomRate } from '../data/rates'
import { averageNightly, roomTotalFor } from './rateCalendar'
import type { SoldOn } from './rateCalendar'
import { depositFor, nightlyRate } from './rates'
import type { RatesPolicy } from './rates'
import { holdsRoom, isRoomFree } from './availability'
import type { Reservation, Room } from '../types'

export const roomTypes: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

export function nightsOf(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

export function planFor(id: string, rates?: RatesPolicy) {
  const list = rates?.plans ?? ratePlans
  return list.find((p) => p.id === id) ?? list[0]
}

/** The flat price of a stay: the published rate, times nights. Use it only where no dates are known. */
export function stayTotal(type: Room['type'], planId: string, nights: number, rates?: RatesPolicy) {
  const rate = rates?.roomRates[type] ?? roomRate[type]
  return nights * (rate + planFor(planId, rates).extraPerNight)
}

/**
 * What a stay on these dates costs, each night priced on its own through the rate calendar. This is the
 * one to use wherever the dates are known, which is almost everywhere: the same room is not the same
 * price in December as in April.
 */
export function stayTotalBetween(
  type: Room['type'],
  planId: string,
  arrival: string,
  departure: string,
  rates?: RatesPolicy,
  /** How full the house is each night, when the hotel prices on occupancy. */
  soldOn?: SoldOn,
) {
  const nights = nightsOf(arrival, departure)
  if (nights < 1) return 0
  if (!rates) return stayTotal(type, planId, nights)
  return roomTotalFor(type, arrival, departure, rates, soldOn) + planFor(planId, rates).extraPerNight * nights
}

/** The average night of a stay, room plus meal plan. One number standing for nights that may differ. */
export function nightlyForStay(
  type: Room['type'],
  planId: string,
  arrival: string,
  departure: string,
  rates?: RatesPolicy,
  soldOn?: SoldOn,
) {
  if (!rates) return (roomRate[type] ?? 0) + planFor(planId).extraPerNight
  return averageNightly(type, arrival, departure, rates, soldOn) + planFor(planId, rates).extraPerNight
}

export function suggestedDeposit(total: number, percent?: number) {
  const share = percent === undefined ? DEPOSIT_RATE : percent / 100
  return Math.round((total * share) / 1000) * 1000
}

/** The deposit for a stay, following the hotel's rule. Use this wherever the room type and nights are known. */
export function depositForStay(
  type: Room['type'],
  planId: string,
  nights: number,
  rates?: RatesPolicy,
  /** The dates, when they are known, so a December deposit follows the December rate. */
  dates?: { arrival: string; departure: string },
  soldOn?: SoldOn,
): number {
  if (!rates) return suggestedDeposit(stayTotal(type, planId, nights, rates))
  const nightly = dates
    ? nightlyForStay(type, planId, dates.arrival, dates.departure, rates, soldOn)
    : nightlyRate(type, planFor(planId, rates).extraPerNight, rates)
  return depositFor(nightly, nights, rates)
}

// Rooms of each type still free for every night of the stay: total minus booked minus blocked (FR-RMS-012).
// A negative number means that type is already overbooked. Counted in one pass over the reservations.
export function freeByType(rooms: Room[], reservations: Reservation[], from: string, to: string) {
  const nights = nightsOf(from, to)
  const result: Record<Room['type'], number> = { Standard: 0, Deluxe: 0, Suite: 0 }
  if (nights < 1) return result

  const total: Record<Room['type'], number> = { Standard: 0, Deluxe: 0, Suite: 0 }
  const booked: Record<Room['type'], number[]> = {
    Standard: new Array<number>(nights).fill(0),
    Deluxe: new Array<number>(nights).fill(0),
    Suite: new Array<number>(nights).fill(0),
  }

  for (const r of rooms) if (r.status !== 'blocked') total[r.type] += 1
  for (const r of reservations) {
    if (!holdsRoom(r)) continue
    const a = Math.max(0, nightsOf(from, r.arrival))
    const d = Math.min(nights, nightsOf(from, r.departure))
    for (let i = a; i < d; i++) booked[r.roomType][i] += 1
  }

  for (const t of roomTypes) result[t] = total[t] - Math.max(...booked[t])
  return result
}

// Specific rooms of a type that are free for the stay. Capped, so a 400-room hotel never builds a huge list.
export function freeRooms(rooms: Room[], reservations: Reservation[], type: Room['type'], from: string, to: string, cap = 40) {
  const out: Room[] = []
  for (const r of rooms) {
    if (r.type === type && isRoomFree(r, from, to, reservations)) {
      out.push(r)
      if (out.length >= cap) break
    }
  }
  return out
}