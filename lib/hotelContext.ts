import { createContext, useContext } from 'react'
import type {
  Amendment,
  Cancellation,
  FolioCharge,
  FolioPayment,
  Guest,
  GuestDetails,
  HkRequest,
  NewReservation,
  Reservation,
  Room,
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
  addPayment: (reservationId: string, input: Omit<FolioPayment, 'id' | 'at'>) => void
  checkOut: (reservationId: string, note?: string) => void
  setHousekeeping: (roomNumber: string, request: HkRequest, reason?: string) => void

}

export const HotelContext = createContext<HotelValue | null>(null)

export function useHotel() {
  const value = useContext(HotelContext)
  if (!value) throw new Error('useHotel must be used inside HotelProvider')
  return value
}