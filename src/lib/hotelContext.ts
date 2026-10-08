import { createContext, useContext } from 'react'
import type { Amendment, Guest, GuestDetails, NewReservation, Reservation, Room } from '../types'

export type AmendPatch = { arrival: string; departure: string; total: number; room: string | null }

export type HotelValue = {
  reservations: Reservation[]
  rooms: Room[]
  guests: Guest[]
  checkIn: (reservationId: string, roomNumber: string, details: GuestDetails) => void
  addReservation: (input: NewReservation) => Reservation
  addGuest: (input: Omit<Guest, 'id'>) => Guest
  amendReservation: (reservationId: string, patch: AmendPatch, entry: Amendment) => void
}

export const HotelContext = createContext<HotelValue | null>(null)

export function useHotel() {
  const value = useContext(HotelContext)
  if (!value) throw new Error('useHotel must be used inside HotelProvider')
  return value
}