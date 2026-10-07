import { useState } from 'react'
import type { ReactNode } from 'react'
import { reservations as initialReservations, rooms as initialRooms } from '../data/sample'
import { HotelContext } from '../lib/hotelContext'
import type { GuestDetails } from '../types'

export default function HotelProvider({ children }: { children: ReactNode }) {
  const [reservations, setReservations] = useState(initialReservations)
  const [rooms, setRooms] = useState(initialRooms)

  function checkIn(reservationId: string, roomNumber: string, details: GuestDetails) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId ? { ...r, status: 'in-house' as const, room: roomNumber, details } : r,
      ),
    )
    setRooms((list) =>
      list.map((room) => (room.number === roomNumber ? { ...room, status: 'occupied' as const } : room)),
    )
  }

  return <HotelContext.Provider value={{ reservations, rooms, checkIn }}>{children}</HotelContext.Provider>
}