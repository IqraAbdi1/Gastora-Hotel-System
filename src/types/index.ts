export type RoomStatus = 'clean' | 'dirty' | 'occupied' | 'blocked'

export type Room = {
  number: string
  type: 'Standard' | 'Deluxe' | 'Suite'
  status: RoomStatus
}

export type ReservationStatus = 'booked' | 'in-house' | 'checked-out'

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
}

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
}