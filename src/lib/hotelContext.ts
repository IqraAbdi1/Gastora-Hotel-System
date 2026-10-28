import { createContext, useContext } from 'react'
import type { AuditRun } from './dayRun'
import type { RoomKey } from './keys'
import type { PreRegDetails } from './preRegistration'
import type { RoutingRule } from './routing'
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
  /**
   * Several rooms booked in one go by one booker. The first input is the booker's own room. Each room is
   * an ordinary booking carrying the same party reference; with `oneBill` every other room's charges go
   * to the first room's bill. Returns the bookings made, the booker's first.
   */
  addParty: (inputs: NewReservation[], booker: string, oneBill: boolean, by: string) => Reservation[]
  /** Start or stop one room of a party paying for all the others. */
  setPartyPayer: (partyId: string, payerId: string | null, by: string) => void
  /** Several at once, for a block of rooms held under one name. */
  addReservations: (inputs: NewReservation[]) => void
  addGuest: (input: Omit<Guest, 'id'>) => Guest
  /** Join two records of the same person: the bookings move, the kept record becomes `result`. */
  mergeGuests: (keepId: string, dropId: string, result: Guest, dropName: string) => void
  updateGuest: (guestId: string, patch: Partial<Omit<Guest, 'id'>>) => void
  amendReservation: (reservationId: string, patch: AmendPatch, entry: Amendment) => void
  cancelReservation: (reservationId: string, patch: CancelPatch, entry: Cancellation) => void
  addCharge: (reservationId: string, input: Omit<FolioCharge, 'id' | 'at'>) => void
  /** Cancels a wrong charge with a reversing line. Both lines stay on the folio. */
  reverseCharge: (reservationId: string, chargeId: string, reason: string, approvedBy: string) => void
  addPayment: (reservationId: string, input: Omit<FolioPayment, 'id' | 'at'>) => void
  /** A payment the guest made from their own page: on the folio if in-house, on the booking if not yet arrived. */
  addGuestPayment: (reservationId: string, input: Omit<FolioPayment, 'id' | 'at'>) => void
  /** Record the arrival-day call to a guest whose booking nothing is securing. */
  recordConfirmCall: (reservationId: string, outcome: CallOutcome, by: string) => void
  /** Give this stay a pre-arrival link, so the guest can fill in their own details. */
  sendPreReg: (reservationId: string) => void
  /** The guest opened the link. Tells the desk the message arrived. */
  openPreReg: (token: string) => void
  /** The guest sent their answers. Nothing is believed until the desk checks it. */
  submitPreReg: (token: string, details: PreRegDetails) => void
  /** A member of staff checked what the guest sent against the ID in front of them. */
  acceptPreReg: (reservationId: string, by: string) => void
  /** The guest asks to leave without stopping at the desk. */
  agreeExpress: (reservationId: string, by: string, via: 'desk' | 'guest') => void
  cancelExpress: (reservationId: string) => void
  /** Take the money, then check them out. In that order. */
  runExpress: (reservationId: string, amount: number, method: string) => void
  /** Every key the hotel has cut, newest first. */
  keys: RoomKey[]
  /** Cut a key for a stay. The second and later ones are copies. */
  issueKey: (reservationId: string, by: string, copy: boolean) => void
  returnKey: (keyId: string) => void
  /** Stop a key working now, because it was lost. */
  cancelKey: (keyId: string, reason: string) => void
  /** A second guest in the same room, with a bill of their own. */
  addShare: (reservationId: string, guest: string, phone: string, splitRoom: boolean) => void
  /** The rest of the stay moves to another room from this date. */
  splitStay: (reservationId: string, fromDate: string, toRoomType: Room['type'], toRoom: string | null) => void
  /** Standing instructions sending some of a guest's charges to another bill. */
  setRouting: (reservationId: string, rules: RoutingRule[]) => void
  /** Put a name to one of a block's rooms, in advance or at the desk. */
  nameGroupRoom: (reservationId: string, guest: string, phone: string, guestId?: string) => void
  /** The room goes back on sale; the booking becomes a no-show with a record of why. */
  releaseRoom: (reservationId: string, by: string, auto: boolean, reason: string) => void
  /** Every closing of the day, newest first. */
  auditRuns: AuditRun[]
  /** Close the day. */
  closeDay: (run: AuditRun) => void
  /** Put the demonstration back to how it started, on this browser. */
  resetDemo: () => void
  checkOut: (reservationId: string, note?: string) => void
  /** Moves an in-house guest to another room. The old room goes dirty, the new one becomes occupied. */
  moveRoom: (reservationId: string, toRoom: string, entry: Omit<RoomMove, 'at'>) => void
  /** Free upgrade: moves a booked stay to a higher room type and assigns the room. The total stays the same. */
  upgradeStay: (reservationId: string, toType: Room['type'], roomNumber: string, reason: string) => void
  setHousekeeping: (roomNumber: string, request: HkRequest, reason?: string) => void
  /**
   * Put proposed rooms on booked stays. A stay that already has a room is never touched, and a room
   * that has been taken since the plan was made is skipped rather than double-booked.
   */
  assignRooms: (items: { reservationId: string; room: string; reason: string }[], by: string, auto: boolean) => number
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