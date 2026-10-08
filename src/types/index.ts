export type RoomStatus = 'clean' | 'dirty' | 'occupied' | 'blocked'

export type Room = {
  number: string
  type: 'Standard' | 'Deluxe' | 'Suite'
  status: RoomStatus
}

export type ReservationStatus = 'booked' | 'in-house' | 'checked-out'

export type GuaranteeType = 'deposit' | 'card' | 'company' | 'none'

export type Guest = {
  id: string
  name: string
  phone: string
  email?: string
  nationality?: string
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