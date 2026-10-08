import { TODAY } from '../data/sample'
import { clashingStay } from './availability'
import { freeByType, nightsOf } from './booking'
import type { Reservation, Room } from '../types'

// Sample policy, not from the SRS. The hotel will set these in its own settings later.
export const FEE_WINDOW_DAYS = 2 // changes closer than this to arrival cost one night

export const reasons = ['Guest request', 'Flight or travel change', 'Business change', 'Hotel request', 'Other']

export type AmendCheck = {
  error: string | null
  nights: number
  perNight: number
  newTotal: number // nights x original nightly rate, before any fee
  fee: number
  feeApplies: boolean
  typeFree: number
  needsOverride: boolean // booked stay, that room type is sold out on the new dates
  roomLost: boolean // booked stay, the assigned room is taken on the new dates, so it is released
  blockedByRoom: boolean // in-house guest, own room is taken on the new nights
}

export function checkAmend(
  r: Reservation,
  arrival: string,
  departure: string,
  rooms: Room[],
  reservations: Reservation[],
): AmendCheck {
  const inHouse = r.status === 'in-house'
  const oldNights = Math.max(1, nightsOf(r.arrival, r.departure))
  const perNight = Math.round(r.total / oldNights) // keeps the original rate
  const nights = nightsOf(arrival, departure)
  const base: AmendCheck = {
    error: null,
    nights,
    perNight,
    newTotal: perNight * Math.max(nights, 0),
    fee: 0,
    feeApplies: false,
    typeFree: 0,
    needsOverride: false,
    roomLost: false,
    blockedByRoom: false,
  }

  if (r.status === 'checked-out') return { ...base, error: 'This stay is already checked out.' }
  if (nights < 1) return { ...base, error: 'Departure must be after arrival.' }
  if (!inHouse && arrival < TODAY) return { ...base, error: 'Arrival cannot be in the past.' }
  if (inHouse && departure <= TODAY) return { ...base, error: 'Departure must be after today.' }
  if (arrival === r.arrival && departure === r.departure) return { ...base, error: 'Change a date to continue.' }

  const shortened = departure < r.departure
  const feeApplies =
    !inHouse && nightsOf(TODAY, r.arrival) < FEE_WINDOW_DAYS && (arrival !== r.arrival || shortened)

  const others = reservations.filter((x) => x.id !== r.id)
  const typeFree = freeByType(rooms, others, arrival, departure)[r.roomType]
  const clash = r.room ? clashingStay(r.room, arrival, departure, reservations, r.id) : undefined

  return {
    ...base,
    fee: feeApplies ? perNight : 0,
    feeApplies,
    typeFree,
    needsOverride: !inHouse && typeFree < 1,
    roomLost: !inHouse && !!clash,
    blockedByRoom: inHouse && !!clash,
  }
}