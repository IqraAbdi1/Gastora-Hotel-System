import { createContext, useContext } from 'react'
import type { CallOutcome } from './confirmCalls'
import type {
  Amendment,
  Cancellation,
  CorporateBooking,
  FolioCharge,
  FolioPayment,
  Guest,
  GuestDetails,
  HkRequest,
  NewReservation,
  Reservation,
  Room,
  RoomMove,
} from '../types'

export type AmendPatch = { arrival: string; departure: string; total: number; room: string | null }
export type CancelPatch = { status: 'cancelled' | 'no-show'; total: number; paid: number }

export type HotelValue = {
  reservations: Reservation[]
  rooms: Room[]
  guests: Guest[]
  checkIn: (reservationId: string, roomNumber: string, details: GuestDetails) => void
  addReservation: (input: NewReservation) => Reservation
  addGuest: (input: Omit<Guest, 'id'>) => Guest
  updateGuest: (guestId: string, patch: Partial<Omit<Guest, 'id'>>) => void
  amendReservation: (reservationId: string, patch: AmendPatch, entry: Amendment) => void
  cancelReservation: (reservationId: string, patch: CancelPatch, entry: Cancellation) => void
  addCharge: (reservationId: string, input: Omit<FolioCharge, 'id' | 'at'>) => void
  /** Cancels a wrong charge with a reversing line. Both lines stay on the folio. */
  reverseCharge: (reservationId: string, chargeId: string, reason: string, approvedBy: string) => void
  addPayment: (reservationId: string, input: Omit<FolioPayment, 'id' | 'at'>) => void
  /** Record the arrival-day call to a guest whose booking nothing is securing. */
  recordConfirmCall: (reservationId: string, outcome: CallOutcome, by: string) => void
  checkOut: (reservationId: string, note?: string) => void
  /** Moves an in-house guest to another room. The old room goes dirty, the new one becomes occupied. */
  moveRoom: (reservationId: string, toRoom: string, entry: Omit<RoomMove, 'at'>) => void
  /** Free upgrade: moves a booked stay to a higher room type and assigns the room. The total stays the same. */
  upgradeStay: (reservationId: string, toType: Room['type'], roomNumber: string, reason: string) => void
  setHousekeeping: (roomNumber: string, request: HkRequest, reason?: string) => void
  setCorporate: (
    reservationId: string,
    corporate: CorporateBooking,
    patch?: Partial<Pick<Reservation, 'total' | 'guarantee'>>,
  ) => void

}

export const HotelContext = createContext<HotelValue | null>(null)

export function useHotel() {
  const value = useContext(HotelContext)
  if (!value) throw new Error('useHotel must be used inside HotelProvider')
  return value
}