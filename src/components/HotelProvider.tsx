import { useState } from 'react'
import type { ReactNode } from 'react'
import { reservations as sampleReservations, rooms as sampleRooms, TODAY } from '../data/sample'
import { guests as sampleGuests } from '../data/guests'
import { makeBigHotel } from '../data/bigHotel'
import { deriveGuests } from '../lib/guests'
import { stamp } from '../lib/folio'
import { HotelContext } from '../lib/hotelContext'
import type { AmendPatch, CancelPatch } from '../lib/hotelContext'
import type {
  Amendment,
  Cancellation,
  FolioCharge,
  FolioPayment,
  Guest,
  GuestDetails,
  HkRequest,
  Invoice,
  NewReservation,
  Reservation,
} from '../types'

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

// Stands in for the URA EFRIS fiscal code. The real one comes back from EFRIS.
function fakeFiscalCode(seed: string) {
  let h = 7
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 1000000007
  return `SIM-${String(h).padStart(10, '0')}`
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
      list.map((room) =>
        room.number === roomNumber
          ? { ...room, status: 'occupied' as const, hk: undefined, hkReason: undefined }
          : room,
      ),
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

  // The total becomes the charge kept, and paid drops by the simulated refund, so the balance shows what is still owed.
  function cancelReservation(reservationId: string, patch: CancelPatch, entry: Cancellation) {
    setReservations((list) =>
      list.map((r) => (r.id === reservationId ? { ...r, ...patch, cancellation: entry } : r)),
    )
  }

  // A charge raises the total, so the balance and every screen that shows it stay correct.
  function addCharge(reservationId: string, input: Omit<FolioCharge, 'id' | 'at'>) {
    setReservations((list) =>
      list.map((r) => {
        if (r.id !== reservationId || r.status !== 'in-house') return r
        const charge: FolioCharge = { ...input, id: `C-${(r.charges?.length ?? 0) + 1}`, at: stamp() }
        return { ...r, total: r.total + input.amount, charges: [...(r.charges ?? []), charge] }
      }),
    )
  }

  // A payment raises paid. In the real system a mobile money payment is recorded only after the provider confirms it.
  function addPayment(reservationId: string, input: Omit<FolioPayment, 'id' | 'at'>) {
    setReservations((list) =>
      list.map((r) => {
        if (r.id !== reservationId || r.status !== 'in-house') return r
        const payment: FolioPayment = { ...input, id: `P-${(r.payments?.length ?? 0) + 1}`, at: stamp() }
        return { ...r, paid: r.paid + input.amount, payments: [...(r.payments ?? []), payment] }
      }),
    )
  }

  // BR-FO-06: the screen only allows this with no balance, or a manager's reason. The room goes dirty for housekeeping.
  function checkOut(reservationId: string, note?: string) {
    const r = reservations.find((x) => x.id === reservationId)
    if (!r || r.status !== 'in-house') return
    const count = reservations.filter((x) => x.invoice).length + 1
    const number = `INV-${TODAY.slice(0, 4)}-${String(count).padStart(4, '0')}`
    const invoice: Invoice = {
      number,
      issuedAt: stamp(),
      amount: r.total,
      fiscalCode: fakeFiscalCode(`${number}${r.id}`),
    }
    const balance = r.total - r.paid
    setReservations((list) =>
      list.map((x) =>
        x.id === reservationId
          ? {
              ...x,
              status: 'checked-out' as const,
              checkedOutAt: stamp(),
              invoice,
              unpaidAtCheckout: balance > 0 ? balance : undefined,
              checkoutNote: note,
            }
          : x,
      ),
    )
    if (r.room) {
      setRooms((list) =>
        list.map((room) =>
          room.number === r.room
            ? { ...room, status: 'dirty' as const, hk: undefined, hkReason: undefined }
            : room,
        ),
      )
    }
  }

  // One place decides how a housekeeping request maps onto the room, so every screen agrees.
  // Occupied rooms are never cleaned or taken out of sale from here; they can only be flagged as a discrepancy.
  function setHousekeeping(roomNumber: string, request: HkRequest, reason?: string) {
    setRooms((list) =>
      list.map((room) => {
        if (room.number !== roomNumber) return room
        if (room.status === 'occupied') {
          if (request === 'discrepancy') return { ...room, hk: 'discrepancy' as const, hkReason: reason }
          if (request === 'dirty') return { ...room, hk: undefined, hkReason: undefined } // reset a flag
          return room
        }
        switch (request) {
          case 'dirty':
            return { ...room, status: 'dirty' as const, hk: undefined, hkReason: undefined }
          case 'cleaning':
            return { ...room, status: 'dirty' as const, hk: 'cleaning' as const, hkReason: undefined }
          case 'ready':
            return { ...room, status: 'clean' as const, hk: undefined, hkReason: undefined }
          case 'cleaned':
            return { ...room, status: 'clean' as const, hk: 'cleaned' as const, hkReason: undefined }
          default:
            return { ...room, status: 'blocked' as const, hk: request, hkReason: reason }
        }
      }),
    )
  }

  return (
    <HotelContext.Provider
      value={{
        reservations,
        rooms,
        guests,
        checkIn,
        addReservation,
        addGuest,
        amendReservation,
        cancelReservation,
        addCharge,
        addPayment,
        checkOut,
        setHousekeeping,
      }}
    >
      {children}
    </HotelContext.Provider>
  )
}