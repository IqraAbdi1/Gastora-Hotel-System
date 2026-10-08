import { useState } from 'react'
import type { ReactNode } from 'react'
import { reservations as sampleReservations, rooms as sampleRooms } from '../data/sample'
import { guests as sampleGuests } from '../data/guests'
import { makeBigHotel } from '../data/bigHotel'
import { deriveGuests } from '../lib/guests'
import { HotelContext } from '../lib/hotelContext'
import type { AmendPatch } from '../lib/hotelContext'
import type { Amendment, Guest, GuestDetails, NewReservation, Reservation } from '../types'

// Test switch: open the app with ?big=1 for a 400-room hotel, ?big=0 to go back to the 12-room sample.
function wantsBigHotel() {
  try {
    const param = new URLSearchParams(window.location.search).get('big')
    if (param === '1') sessionStorage.setItem('gastora-big', '1')
    if (param === '0') sessionStorage.removeItem('gastora-big')
    return sessionStorage.getItem('gastora-big') === '1'
  } catch {
    return false
  }
}

const big = wantsBigHotel()
const bigData = big ? makeBigHotel() : null
const start = {
  reservations: bigData ? bigData.reservations : sampleReservations,
  rooms: bigData ? bigData.rooms : sampleRooms,
  guests: bigData ? deriveGuests(bigData.reservations) : sampleGuests,
}

function nextId(list: Reservation[]) {
  let max = 1000
  for (const r of list) {
    const n = parseInt(r.id.replace('R-', ''), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `R-${max + 1}`
}

export default function HotelProvider({ children }: { children: ReactNode }) {
  const [reservations, setReservations] = useState(start.reservations)
  const [rooms, setRooms] = useState(start.rooms)
  const [guests, setGuests] = useState<Guest[]>(start.guests)

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

  function addReservation(input: NewReservation) {
    const created: Reservation = { ...input, id: nextId(reservations), status: 'booked' }
    setReservations((list) => [...list, created])
    return created
  }

  function addGuest(input: Omit<Guest, 'id'>) {
    const created: Guest = { ...input, id: `G-${guests.length + 1}` }
    setGuests((list) => [...list, created])
    return created
  }

  function amendReservation(reservationId: string, patch: AmendPatch, entry: Amendment) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId ? { ...r, ...patch, changes: [...(r.changes ?? []), entry] } : r,
      ),
    )
  }

  return (
    <HotelContext.Provider
      value={{ reservations, rooms, guests, checkIn, addReservation, addGuest, amendReservation }}
    >
      {children}
    </HotelContext.Provider>
  )
}