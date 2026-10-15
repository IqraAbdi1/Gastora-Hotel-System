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

export type NewReservation = Omit<Reservation, 'id' | 'status' | 'details'>

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
