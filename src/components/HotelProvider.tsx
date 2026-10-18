import { useState } from 'react'
import { tokenFor } from '../lib/preRegistration'
import type { PreRegDetails } from '../lib/preRegistration'
import type { ReactNode } from 'react'
import { reservations as sampleReservations, rooms as sampleRooms, TODAY } from '../data/sample'
import { guests as sampleGuests } from '../data/guests'
import { makeBigHotel } from '../data/bigHotel'
import { deriveGuests } from '../lib/guests'
import { stamp } from '../lib/folio'
import type { CallOutcome } from '../lib/confirmCalls'
import { HotelContext } from '../lib/hotelContext'
import type { EfrisSettings } from '../lib/tax'
import { useFeatures } from '../features/platform/featuresContext'
import type { AmendPatch, CancelPatch } from '../lib/hotelContext'
import type {
  Amendment,
  Cancellation,
  CorporateBooking,
  FolioCharge,
  FolioPayment,
  Guest,
  GuestDetails,
  HkRequest,
  Invoice,
  NewReservation,
  Reservation,
  Room,
  RoomMove,
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

// What the hotel's EFRIS choice means for one invoice. Registered hotels get a simulated fiscal document number and
// verification code. Exempt hotels print their reason instead. With the Tax lines feature off nothing changes.
function efrisFields(e: EfrisSettings | undefined, seed: string): Partial<Invoice> {
  if (!e) return {}
  if (e.status === 'registered') return { fiscal: 'efris', tin: e.tin, verification: fakeFiscalCode(`v${seed}`).replace('SIM-', 'VER-') }
  if (e.status === 'exempt') return { fiscal: 'exempt', fiscalCode: 'EFRIS exempt', exemptReason: e.exemptReason }
  return { fiscal: 'notSet', fiscalCode: 'Not fiscalised' }
}

// Stands in for the URA EFRIS fiscal code. The real one comes back from EFRIS.
function fakeFiscalCode(seed: string) {
  let h = 7
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 1000000007
  return `SIM-${String(h).padStart(10, '0')}`
}

export default function HotelProvider({ children }: { children: ReactNode }) {
  const { tax } = useFeatures()
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

  function updateGuest(guestId: string, patch: Partial<Omit<Guest, 'id'>>) {
    setGuests((list) => list.map((guest) => guest.id === guestId ? { ...guest, ...patch } : guest))
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

  // Moving an in-house guest. The room they leave goes dirty for housekeeping and the new one becomes occupied,
  // so the board, housekeeping and the folio all agree. The price does not change: a move is not a re-booking.
  function moveRoom(reservationId: string, toRoom: string, entry: Omit<RoomMove, 'at'>) {
    const r = reservations.find((x) => x.id === reservationId)
    if (!r || r.status !== 'in-house' || !r.room || r.room === toRoom) return
    const target = rooms.find((x) => x.number === toRoom)
    if (!target) return
    // The booked room type stays on the stay, so the folio and the invoice keep billing what the guest booked.
    const from = r.room
    const move: RoomMove = { ...entry, at: stamp() }
    setReservations((list) =>
      list.map((x) =>
        x.id === reservationId
          ? { ...x, room: toRoom, moves: [...(x.moves ?? []), move] }
          : x,
      ),
    )
    setRooms((list) =>
      list.map((room) => {
        if (room.number === from) return { ...room, status: 'dirty' as const, hk: undefined, hkReason: undefined }
        if (room.number === toRoom) return { ...room, status: 'occupied' as const, hk: undefined, hkReason: undefined }
        return room
      }),
    )
  }

  // A free upgrade: only a stay that has not checked in yet. The price stays the same and nobody has to approve it.
  function upgradeStay(reservationId: string, toType: Room['type'], roomNumber: string, reason: string) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId && r.status === 'booked'
          ? { ...r, roomType: toType, room: roomNumber, upgrade: { from: r.upgrade?.from ?? r.roomType, to: toType, at: stamp(), reason } }
          : r,
      ),
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

  // A wrong charge is never deleted: a reversing line of the same amount is added next to it, both carrying
  // the reason and who approved it. The folio total falls back and the guest can see what happened.
  function reverseCharge(reservationId: string, chargeId: string, reason: string, approvedBy: string) {
    setReservations((list) =>
      list.map((r) => {
        if (r.id !== reservationId || r.status !== 'in-house') return r
        const wrong = (r.charges ?? []).find((c) => c.id === chargeId)
        if (!wrong || wrong.reversedBy || wrong.reverses) return r
        const id = `C-${(r.charges?.length ?? 0) + 1}R`
        const entry: FolioCharge = {
          id,
          at: stamp(),
          category: wrong.category,
          description: `Reversal of ${wrong.description}`,
          amount: -wrong.amount,
          reverses: wrong.id,
          reason,
          approvedBy,
        }
        return {
          ...r,
          total: r.total - wrong.amount,
          charges: [...(r.charges ?? []).map((c) => (c.id === chargeId ? { ...c, reversedBy: id } : c)), entry],
        }
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

  /**
   * The arrival-day call to a guest whose booking nothing is securing. Recording it is the point:
   * by the release time the desk knows which rooms it can honestly put back on sale.
   */
  function recordConfirmCall(reservationId: string, outcome: CallOutcome, by: string) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId && r.status === 'booked'
          ? { ...r, confirmCall: { at: stamp(), by, outcome } }
          : r,
      ),
    )
  }

  // Pre-registration. The guest fills these in from their own phone, so every one of these changes
  // arrives from outside the hotel and none of them touches the dates, the room or the money.
  function sendPreReg(reservationId: string) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId
          ? { ...r, preReg: { ...(r.preReg ?? { token: tokenFor(r.id, r.arrival) }), token: r.preReg?.token ?? tokenFor(r.id, r.arrival), sentAt: stamp() } }
          : r,
      ),
    )
  }

  function openPreReg(token: string) {
    setReservations((list) =>
      list.map((r) =>
        tokenFor(r.id, r.arrival) === token && r.preReg && !r.preReg.openedAt ? { ...r, preReg: { ...r.preReg, openedAt: stamp() } } : r,
      ),
    )
  }

  function submitPreReg(token: string, details: PreRegDetails) {
    setReservations((list) =>
      list.map((r) =>
        tokenFor(r.id, r.arrival) === token
          ? { ...r, preReg: { ...(r.preReg ?? { token }), token: r.preReg?.token ?? token, details, submittedAt: stamp() } }
          : r,
      ),
    )
  }

  /** A member of staff has seen it against the ID in their hand. Until then it is only what the guest said. */
  function acceptPreReg(reservationId: string, by: string) {
    setReservations((list) =>
      list.map((r) => (r.id === reservationId && r.preReg ? { ...r, preReg: { ...r.preReg, acceptedAt: stamp(), acceptedBy: by } } : r)),
    )
  }

  // Express checkout. Agreeing is one step and leaving is another, deliberately: what the hotel can
  // charge may have changed between the two, so the check is made again at the moment of leaving.
  function agreeExpress(reservationId: string, by: string, via: 'desk' | 'guest') {
    setReservations((list) =>
      list.map((r) => (r.id === reservationId ? { ...r, express: { agreedAt: stamp(), agreedBy: by, agreedVia: via } } : r)),
    )
  }

  function cancelExpress(reservationId: string) {
    setReservations((list) => list.map((r) => (r.id === reservationId ? { ...r, express: undefined } : r)))
  }

  /** The guest leaves. The money is taken first, so a failure here never checks anybody out unpaid. */
  function runExpress(reservationId: string, amount: number, method: string) {
    if (amount > 0) addPayment(reservationId, { method, amount, reference: 'Express checkout' })
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId && r.express ? { ...r, express: { ...r.express, doneAt: stamp(), chargedAmount: amount, method } } : r,
      ),
    )
    checkOut(reservationId, 'Left without stopping at the desk')
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
      ...efrisFields(tax?.efris, `${number}${r.id}`),
      ...(r.upgrade ? { roomNote: `${r.upgrade.to}, complimentary upgrade from ${r.upgrade.from}. Charged at the ${r.upgrade.from} rate.` } : {}),
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

  // Company booking checks change here. `patch` carries what follows from them, such as the total
  // when a company price is approved or the guarantee when billing is approved.
  function setCorporate(reservationId: string, corporate: CorporateBooking, patch: Partial<Pick<Reservation, 'total' | 'guarantee'>> = {}) {
    setReservations((list) => list.map((r) => (r.id === reservationId ? { ...r, ...patch, corporate } : r)))
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
        updateGuest,
        amendReservation,
        cancelReservation,
        addCharge,
        reverseCharge,
        moveRoom,
        upgradeStay,
        addPayment,
    recordConfirmCall,
        sendPreReg,
        openPreReg,
        submitPreReg,
        acceptPreReg,
        agreeExpress,
        cancelExpress,
        runExpress,
        checkOut,
        setHousekeeping,
        setCorporate,
      }}
    >
      {children}
    </HotelContext.Provider>
  )
}