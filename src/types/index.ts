import type { ConfirmCall } from '../lib/confirmCalls'
import type { Express } from '../lib/expressCheckout'
import type { Release } from '../lib/dayRun'
import type { GroupLink } from '../lib/groups'
import type { RoutingRule } from '../lib/routing'
import type { LegLink, ShareLink } from '../lib/sharing'
import type { PreReg } from '../lib/preRegistration'
export type { PreReg, Express, Release, GroupLink, RoutingRule, ShareLink, LegLink }

export type RoomStatus = 'clean' | 'dirty' | 'occupied' | 'blocked'

// Housekeeping detail the four front-desk statuses cannot express.
// cleaning = dirty and being cleaned. cleaned = clean, attendant finished, waiting for inspection.
// A clean room with no detail is ready to sell (inspected). The last three take the room out of sale
// (or, for a discrepancy on an occupied room, flag it).
export type HkState = 'cleaning' | 'cleaned' | 'out-of-service' | 'out-of-order' | 'discrepancy'

// What housekeeping can ask for. 'dirty' and 'ready' simply clear any detail.
export type HkRequest = 'dirty' | 'ready' | HkState

export type Room = {
  number: string
  type: 'Standard' | 'Deluxe' | 'Suite'
  status: RoomStatus
  hk?: HkState
  hkReason?: string
}

export type Cancellation = {
  kind: 'cancelled' | 'no-show'
  at: string
  reason: string
  charge: number
  refund: number
  owed: number
  waived: boolean
}

export type FolioCharge = {
  id: string
  at: string
  category: string
  description: string
  amount: number
  /** Set when the charge was routed here from another stay, under that guest's instruction. */
  routedFrom?: { reservationId: string; guest: string; room: string | null }
  /** Set on a reversing line: the id of the charge it cancels. The wrong line is never deleted. */
  reverses?: string
  /** Set on a charge that has been reversed, so the folio can grey it out. */
  reversedBy?: string
  /** Why it was reversed and who approved it. On the reversing line. */
  reason?: string
  approvedBy?: string
}

export type FolioPayment = {
  id: string
  at: string
  method: string
  reference?: string
  amount: number
}

export type Invoice = {
  number: string
  issuedAt: string
  amount: number
  fiscalCode: string // simulated, not a real URA EFRIS code
  /** How the hotel's EFRIS choice applied to this invoice. Missing when the hotel does not use tax lines. */
  fiscal?: 'efris' | 'exempt' | 'notSet'
  tin?: string
  /** Simulated verification code. The real one comes back from URA. */
  verification?: string
  exemptReason?: string
  /** Printed when the guest stayed in a higher room type than booked, at no extra charge. */
  roomNote?: string
}

export type ReservationStatus = 'booked' | 'in-house' | 'checked-out' | 'cancelled' | 'no-show'

export type GuaranteeType = 'deposit' | 'card' | 'company' | 'none'

export type GuestNote = { id: string; at: string; by: string; text: string }

export type GuestPreferences = {
  room?: string
  bed?: string
  diet?: string
  language?: string
  other?: string
  /** Quick things the desk taps at check-in, such as "Quiet room" or "High floor". */
  tags?: string[]
}

export type Guest = {
  id: string
  name: string
  phone: string
  email?: string
  nationality?: string
  dateOfBirth?: string
  gender?: string
  address?: string
  idType?: IdType
  idNumber?: string
  vip?: boolean
  marketingConsent?: boolean
  /** The guest agreed to be remembered between stays. Without it there is no tier and no profile. */
  loyaltyConsent?: boolean
  /** The guest agreed to the hotel keeping dietary or access needs, which the law treats as sensitive. */
  sensitiveConsent?: boolean
  /** When the guest last answered those questions, so the hotel can show what was agreed and when. */
  consentAt?: string
  preferences?: GuestPreferences
  notes?: GuestNote[]
}

export type Reservation = {
  id: string
  guest: string
  roomType: Room['type']
  room: string | null
  arrival: string
  departure: string
  status: ReservationStatus
  total: number
  paid: number
  details?: GuestDetails
  /** The day the booking was taken. Without it there is no lead time and no pickup. */
  bookedAt?: string
  guestId?: string
  plan?: string
  guarantee?: GuaranteeType
    source?: 'walk-in' | 'front desk' | 'phone' | 'email' | 'online' | 'ota'
  adults?: number
  children?: number
  overrideReason?: string
  changes?: Amendment[]
  cancellation?: Cancellation
  charges?: FolioCharge[]
  payments?: FolioPayment[]
  invoice?: Invoice
  checkedOutAt?: string
  unpaidAtCheckout?: number
  checkoutNote?: string
  /** Set when the stay is booked for a company. */
  corporate?: CorporateBooking
  /** Room moves during the stay. The newest is last. */
  moves?: RoomMove[]
  /** A free upgrade given because no room of the booked type could be used. The price does not change. */
  upgrade?: { from: Room['type']; to: Room['type']; at: string; reason: string }
  /** The arrival-day call to a guest whose booking nothing is securing. */
  confirmCall?: ConfirmCall
  /** What the guest filled in themselves before arriving, and how far they got. */
  preReg?: PreReg
  /** The guest asked to leave without stopping at the desk. */
  express?: Express
  /** The room was taken back because nobody confirmed and the hour passed. */
  release?: Release
  /** This booking is one room of a block held under a group's name. */
  group?: GroupLink
  /** Standing instructions sending some of this guest's charges to another bill. */
  routing?: RoutingRule[]
  /** Two guests in one room, each with their own bill. */
  share?: ShareLink
  /** One stay across more than one room, a night or more in each. */
  legs?: LegLink
}
export type RoomMove = {
  at: string
  from: string
  to: string
  reason: string
  by: string
  /** Set when the new room is a different type from the old one. */
  typeChange?: { from: Room['type']; to: Room['type'] }
  /** A move to a higher type at no extra charge. */
  free?: boolean
}

export type Amendment = {
  at: string
  fromArrival: string
  fromDeparture: string
  toArrival: string
  toDeparture: string
  reason: string
  fee: number
  waived: boolean
}

/**
 * A booking being created. Identification is not part of it: the desk records that when it can see the
 * guest. A booking made by the guest themselves may carry their own telephone and their own words about
 * the stay, which is the one case where some of this is known before anybody arrives.
 */
export type NewReservation = Omit<Reservation, 'id' | 'status' | 'details'> & { details?: GuestDetails }

export type GoAction = { kind: 'go'; label: string; to: string }

export type DraftAction = {
  kind: 'draft'
  label: string
  title: string
  recipient: string
  body: string
}

export type AssistantAction = GoAction | DraftAction

export type Answer = { text: string; actions: AssistantAction[] }

export type Suggestion = Answer & { source: 'rule' | 'ai' }

export type IdType = 'NIN' | 'Passport' | 'Driving permit'

export type GuestDetails = {
  idType: IdType
  idNumber: string
  nationality: string
  phone: string
  specialRequests: string
  idExpiry?: string
  idPhoto?: string
  dateOfBirth?: string
  gender?: string
  address?: string
  email?: string
  purpose?: string
  comingFrom?: string
  nextDestination?: string
  adults?: number
  children?: number
  vehiclePlate?: string
  emergencyName?: string
  emergencyPhone?: string
  marketingConsent?: boolean
  termsAccepted?: boolean
  signature?: string
  /** How the ID details reached the form: read from the card by camera, from a photograph, or typed. */
  idReadFrom?: 'camera' | 'photo' | 'typed'
  /** The strip exactly as it was read, so a dispute can be settled against the card itself. */
  idMrz?: string
  /** The name printed on the ID, kept when it differs from the name the booking was made in. */
  idName?: string
}

// ---- Company bookings ----
// A company booking has four separate checks. Passing one never passes another: a guest who says
// they work for a company does not, by that alone, get to charge the stay to the company.

/** Who pays. "company-room" = the company pays the room and meal plan, the guest pays extras. */
export type BillTo = 'company-all' | 'company-room' | 'guest'

export type BookerCheckMethod = 'authorised-list' | 'callback' | 'written-authorisation'
export type BillingCheckMethod = 'email' | 'signed-form' | 'purchase-order' | 'phone-callback'

export type CorporateLogEntry = { at: string; by: string; action: string }

export type CorporateBooking = {
  accountId: string
  accountName: string
  /** 2. Is the person who made the booking allowed to book for the company? */
  booker: {
    contactId?: string
    name: string
    phone?: string
    status: 'verified' | 'pending' | 'failed'
    method?: BookerCheckMethod
    reference?: string
    by?: string
    at?: string
  }
  billTo: BillTo
  /** 4. Has this booking been approved for company billing? */
  billing: {
    status: 'not-required' | 'pending' | 'approved' | 'declined'
    /** The company contact who approved the charges, and their reference (PO, email, form). */
    approverContactId?: string
    approverName?: string
    method?: BillingCheckMethod
    reference?: string
    /** The LPO number the guest or booker gave at booking. Not verified until check-in. */
    claimedLpo?: string
    /** The company's purchase order (LPO), when the company needs one. Recorded when the hotel receives it. */
    lpo?: { number: string; amount: number; receivedOn: string; recordedBy: string; recordedAt: string }
    /** Hotel sign-off, needed when the booking takes the company over its credit limit. */
    overCreditApprovedBy?: string
    overCreditReason?: string
    by?: string
    at?: string
    note?: string
  }
  /** Company price applied from the agreement. Rules that need approval are not charged until approved. */
  pricing?: {
    ruleIds: string[]
    labels: string[]
    nights: number
    perNightOriginal: number
    perNightFinal: number
    originalTotal: number
    finalTotal: number
    status: 'applied' | 'pending' | 'approved' | 'declined'
    decidedBy?: string
    at?: string
  }
  log: CorporateLogEntry[]
}
