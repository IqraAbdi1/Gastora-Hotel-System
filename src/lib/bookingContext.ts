import { createContext, useContext } from 'react'

export type BookingPreset = { walkin?: boolean; room?: string; date?: string }

export type BookingValue = { openBooking: (preset?: BookingPreset) => void }

export const BookingContext = createContext<BookingValue | null>(null)

export function useBooking() {
  const value = useContext(BookingContext)
  if (!value) throw new Error('useBooking must be used inside AppShell')
  return value
}