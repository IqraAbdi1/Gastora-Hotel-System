import { useBrowserSyncedState } from '../hooks/useBrowserSyncedState'
import type { AuditRun } from '../lib/dayRun'
import { newKeyId } from '../lib/keys'
import type { RoomKey } from '../lib/keys'
import { targetFor } from '../lib/routing'
import type { RoutingRule } from '../lib/routing'
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

const KEYS = {
  reservations: 'gastora:hotel:reservations',
  rooms: 'gastora:hotel:rooms',
  guests: 'gastora:hotel:guests',
  audits: 'gastora:hotel:audits',
  keys: 'gastora:hotel:keys',
} as const

export default function HotelProvider({ children }: { children: ReactNode }) {
  const { tax, stayTimes } = useFeatures()
  // The hotel's own record is shared between tabs on this browser, because the guest's pages - the
  // pre-arrival form and the bill - are opened from a link and are therefore never the tab the desk is
  // working in. Browser-only: two tabs on one machine see each other, two devices do not. A real build
  // replaces this with the server, and that is the same line that makes it work across devices.
  const [reservations, setReservations] = useBrowserSyncedState(KEYS.reservations, start.reservations)
  const [rooms, setRooms] = useBrowserSyncedState(KEYS.rooms, start.rooms)
  const [guests, setGuests] = useBrowserSyncedState<Guest[]>(KEYS.guests, start.guests)
  const [auditRuns, setAuditRuns] = useBrowserSyncedState<AuditRun[]>(KEYS.audits, [])
  const [keys, setKeys] = useBrowserSyncedState<RoomKey[]>(KEYS.keys, [])

  /** Put the demonstration back to how it started, on this browser. */
  function resetDemo() {
    for (const key of [...Object.values(KEYS), 'gastora:hotel:options', 'gastora:hotel:tax', 'gastora:hotel:stayTimes', 'gastora:platform:tenants', 'gastora:hotel:groups', 'gastora:hotel:channels', 'gastora:hotel:channelPushes']) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Nothing stored to clear.
      }
    }
    // Reloading is the honest way to put everything back, settings included: those live in another
    // provider, and clearing what is stored without reloading would leave the screen showing the old
    // values until something happened to redraw it.
    window.location.reload()
  }

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
    const created: Reservation = { bookedAt: TODAY, ...input, id: nextId(reservations), status: 'booked' }
    setReservations((list) => [...list, created])
    return created
  }

  /**
   * Several bookings at once, which is what holding a block of rooms is. The ids are worked out inside
   * the update, against the list as it really is: handing out ids from the list as it was when the
   * screen last drew gives every room in the block the same number.
   */
  function addReservations(inputs: NewReservation[]): void {
    if (inputs.length === 0) return
    setReservations((list) => {
      const made: Reservation[] = []
      for (const input of inputs) {
        made.push({ bookedAt: TODAY, ...input, id: nextId([...list, ...made]), status: 'booked' })
      }
      return [...list, ...made]
    })
  }

  function addGuest(input: Omit<Guest, 'id'>) {
    const created: Guest = { ...input, id: `G-${guests.length + 1}` }
    setGuests((list) => [...list, created])
    return created
  }

  function updateGuest(guestId: string, patch: Partial<Omit<Guest, 'id'>>) {
    setGuests((list) => list.map((guest) => guest.id === guestId ? { ...guest, ...patch } : guest))
  }

  /**
   * Two records of one person become one.
   *
   * The bookings move first and the record goes second, so there is no moment at which a booking
   * points at a guest who is no longer there. The name on an old booking is left as it was written:
   * that is what the guest was called that night, and rewriting history to tidy a spelling would make
   * the folios disagree with the invoices already printed.
   */
  function mergeGuests(keepId: string, dropId: string, result: Guest, dropName: string) {
    if (keepId === dropId) return
    setReservations((list) =>
      // An older booking may carry no guest id at all, in which case the name it was written under is
      // the only link there is - and it is the name of the record being dropped, not the one being kept.
      list.map((r) => (r.guestId === dropId || (!r.guestId && r.guest === dropName) ? { ...r, guestId: keepId } : r)),
    )
    setGuests((list) => list.filter((g) => g.id !== dropId).map((g) => (g.id === keepId ? result : g)))
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
  /**
   * Where a charge belongs is decided here, once, at the moment it is posted. A standing instruction
   * sends it to the bill that agreed to pay it, carrying the name of the guest it was for, so nobody
   * at checkout has to work out why the manager's bill has somebody else's dinner on it.
   */
  function addCharge(reservationId: string, input: Omit<FolioCharge, 'id' | 'at'>) {
    setReservations((list) => {
      const from = list.find((x) => x.id === reservationId)
      const rule = from ? targetFor(from.routing, input.category) : undefined
      const target = rule?.toReservationId ?? reservationId
      const routedFrom =
        rule && from ? { reservationId: from.id, guest: from.guest, room: from.room } : undefined
      return list.map((r) => {
        if (r.id !== target || r.status !== 'in-house') return r
        const charge: FolioCharge = { ...input, id: `C-${(r.charges?.length ?? 0) + 1}`, at: stamp(), routedFrom }
        return { ...r, total: r.total + input.amount, charges: [...(r.charges ?? []), charge] }
      })
    })
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

  /** Cut a key. The record is the hotel's; writing the card itself belongs to the lock vendor. */
  function issueKey(reservationId: string, by: string, copy: boolean): void {
    const r = reservations.find((x) => x.id === reservationId)
    if (!r || !r.room) return
    setKeys((list) => [
      {
        id: newKeyId(list),
        reservationId,
        room: r.room as string,
        guest: r.guest,
        copy,
        issuedAt: stamp(),
        issuedBy: by,
        worksUntil: `${r.departure} ${stayTimes.checkOutTime}`,
        state: 'active' as const,
      },
      ...list,
    ])
  }

  function returnKey(keyId: string): void {
    setKeys((list) => list.map((k) => (k.id === keyId && k.state === 'active' ? { ...k, state: 'returned', returnedAt: stamp() } : k)))
  }

  /** A key that is lost, or one the hotel wants to stop working now. */
  function cancelKey(keyId: string, reason: string): void {
    setKeys((list) => list.map((k) => (k.id === keyId && k.state === 'active' ? { ...k, state: 'cancelled', cancelledReason: reason } : k)))
  }

  /**
   * A second guest in the same room, with their own bill. Their booking holds no room: the room is
   * already held by the person they are sharing with.
   */
  function addShare(reservationId: string, guest: string, phone: string, splitRoom: boolean): void {
    setReservations((list) => {
      const host = list.find((x) => x.id === reservationId)
      if (!host || !host.room) return list
      const id = nextId(list)
      const half = splitRoom ? Math.round(host.total / 2) : 0
      const sharer: Reservation = {
        id,
        guest: guest.trim(),
        roomType: host.roomType,
        room: host.room,
        arrival: host.arrival,
        departure: host.departure,
        status: host.status,
        total: half,
        paid: 0,
        share: { withReservationId: host.id, withGuest: host.guest, primary: false, splitRoom },
        ...(phone.trim() ? { details: { idType: 'NIN' as const, idNumber: '', nationality: '', specialRequests: '', phone: phone.trim() } } : {}),
      }
      return list.map((r) =>
        r.id === host.id
          ? {
              ...r,
              total: splitRoom ? r.total - half : r.total,
              share: { withReservationId: id, withGuest: sharer.guest, primary: true, splitRoom },
            }
          : r,
      ).concat(sharer)
    })
  }

  /**
   * The rest of a stay, in another room. Two bookings end to end rather than one booking pretending to
   * be in two places, so availability counts each room on the nights it is actually used.
   */
  function splitStay(reservationId: string, fromDate: string, toRoomType: Room['type'], toRoom: string | null): void {
    setReservations((list) => {
      const first = list.find((x) => x.id === reservationId)
      if (!first || fromDate <= first.arrival || fromDate >= first.departure) return list
      const id = nextId(list)
      const allNights = Math.max(1, Math.round((Date.parse(`${first.departure}T00:00:00`) - Date.parse(`${first.arrival}T00:00:00`)) / 86400000))
      const firstNights = Math.max(1, Math.round((Date.parse(`${fromDate}T00:00:00`) - Date.parse(`${first.arrival}T00:00:00`)) / 86400000))
      const perNight = first.total / allNights
      const second: Reservation = {
        id,
        guest: first.guest,
        guestId: first.guestId,
        roomType: toRoomType,
        room: toRoom,
        arrival: fromDate,
        departure: first.departure,
        status: 'booked',
        total: Math.round(perNight * (allNights - firstNights)),
        paid: 0,
        plan: first.plan,
        guarantee: first.guarantee,
        legs: { previousId: first.id, index: 2, of: 2 },
      }
      return list
        .map((r) =>
          r.id === first.id
            ? { ...r, departure: fromDate, total: Math.round(perNight * firstNights), legs: { nextId: id, index: 1, of: 2 } }
            : r,
        )
        .concat(second)
    })
  }

  /** A standing instruction that some of this guest's charges belong on another bill. */
  function setRouting(reservationId: string, rules: RoutingRule[]) {
    setReservations((list) => list.map((r) => (r.id === reservationId ? { ...r, routing: rules } : r)))
  }

  /** Somebody is put in one of a block's rooms, whether days ahead or at the desk. */
  function nameGroupRoom(reservationId: string, guest: string, phone: string, guestId?: string) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId && r.group
          ? {
              ...r,
              guest: guest.trim() || r.guest,
              guestId: guestId ?? r.guestId,
              group: { ...r.group, named: guest.trim() !== '' },
              details: phone.trim() ? { ...(r.details ?? { idType: 'NIN' as const, idNumber: '', nationality: '', specialRequests: '' }), phone: phone.trim() } : r.details,
            }
          : r,
      ),
    )
  }

  /**
   * The room goes back on sale. The booking becomes a no-show rather than being deleted, because the
   * hotel needs to be able to say what happened to it, and a guest who turns up at nine deserves a
   * truthful answer rather than a shrug.
   */
  function releaseRoom(reservationId: string, by: string, auto: boolean, reason: string) {
    setReservations((list) =>
      list.map((r) =>
        r.id === reservationId && r.status === 'booked'
          ? { ...r, status: 'no-show' as const, room: null, release: { at: stamp(), by, auto, reason } }
          : r,
      ),
    )
    // A room that was being held for this booking is free again.
    const held = reservations.find((x) => x.id === reservationId)?.room
    if (held) {
      setRooms((list) => list.map((room) => (room.number === held && room.status !== 'occupied' ? { ...room, status: 'clean' as const } : room)))
    }
  }

  /** Close the day: record what the hotel looked like, and stop counting arrivals that never came. */
  function closeDay(run: AuditRun) {
    setAuditRuns((list) => (list.some((x) => x.date === run.date) ? list : [run, ...list]))
    setReservations((list) =>
      list.map((r) =>
        run.noShows.includes(r.id) && r.status === 'booked'
          ? { ...r, status: 'no-show' as const, release: r.release ?? { at: run.at, by: run.by, auto: run.auto, reason: 'Never arrived; the day was closed' } }
          : r,
      ),
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
        addReservations,
        addGuest,
        updateGuest,
        mergeGuests,
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
        nameGroupRoom,
        setRouting,
        keys,
        issueKey,
        returnKey,
        cancelKey,
        addShare,
        splitStay,
        releaseRoom,
        auditRuns,
        closeDay,
        resetDemo,
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