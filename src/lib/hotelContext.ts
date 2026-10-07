import { createContext, useContext } from 'react'
import type { GuestDetails, Reservation, Room } from '../types'

export type HotelContextValue = {
  reservations: Reservation[]
  rooms: Room[]
  checkIn: (reservationId: string, roomNumber: string, details: GuestDetails) => void
}

export const HotelContext = createContext<HotelContextValue | null>(null)

export function useHotel(): HotelContextValue {
  const value = useContext(HotelContext)
  if (!value) throw new Error('useHotel must be used inside HotelProvider')
  return value
}