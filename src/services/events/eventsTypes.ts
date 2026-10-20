// Records for events, banqueting and sales. Named after the gst_events tables, one type per table,
// columns in camelCase. Money is whole Uganda shillings. Dates are YYYY-MM-DD, times HH:MM, stamps ISO.
import type { Actor } from '../types'

export type EventType = 'conference' | 'wedding' | 'meeting' | 'corporate' | 'social'
export type LeadStage = 'enquiry' | 'proposal' | 'tentative' | 'definite' | 'lost'

/** leads */
export interface Lead {
  id: string
  propertyId: string
  title: string
  eventType: EventType
  stage: LeadStage
  /** accounts link to companies: the corporate account, when the client has one. */
  companyId?: string
  /** The client's name when there is no company account (a family, a church). */
  clientName: string
  contactName: string
  contactPhone: string
  contactEmail?: string
  ownerId: string
  ownerName: string
  eventDate: string
  endDate: string
  expectedGuests: number
  estimatedValue: number
  /** 0 to 100. */
  probability: number
  source: string
  lostReason?: string
  notes?: string
  /** The event booking this lead became, once it is tentative or definite. */
  eventBookingId?: string
  stageHistory: { stage: LeadStage; at: string; by: string }[]
  createdAt: string
  createdBy: string
  updatedAt: string
}

export type SpaceKind = 'hall' | 'boardroom' | 'garden' | 'restaurant' | 'terrace'
export type SetupStyle = 'theatre' | 'classroom' | 'banquet' | 'boardroom' | 'u-shape' | 'cocktail'

/** function_spaces */
export interface FunctionSpace {
  id: string
  propertyId: string
  name: string
  kind: SpaceKind
  areaSqm: number
  hireRateHalfDay: number
  hireRateFullDay: number
  active: boolean
}

/** space_setups: how many people a space holds in each layout. */
export interface SpaceSetup {
  id: string
  propertyId: string
  spaceId: string
  setup: SetupStyle
  capacity: number
}

export type EventStatus = 'tentative' | 'definite' | 'completed' | 'cancelled'

/** event_bookings */
export interface EventBooking {
  id: string
  propertyId: string
  leadId?: string
  name: string
  eventType: EventType
  companyId?: string
  clientName: string
  contactName: string
  contactPhone: string
  status: EventStatus
  startDate: string
  endDate: string
  expectedGuests: number
  guaranteedGuests?: number
  /** The room block in Groups (gastora:hotel:groups) holding bedrooms for this event. */
  groupBlockId?: string
  ownerName: string
  notes?: string
  createdAt: string
  createdBy: string
}

/** event_sessions: one block in the function diary. */
export interface EventSession {
  id: string
  propertyId: string
  eventBookingId: string
  spaceId: string
  title: string
  date: string
  startTime: string
  endTime: string
  setup: SetupStyle
  pax: number
}

export type BeoStatus = 'draft' | 'issued' | 'signed'

/** beos: the banquet event order the kitchen, banqueting and AV work from. */
export interface Beo {
  id: string
  propertyId: string
  eventBookingId: string
  version: number
  status: BeoStatus
  agenda: { time: string; item: string }[]
  kitchenNotes?: string
  setupNotes?: string
  issuedAt?: string
  issuedBy?: string
  signedAt?: string
  signedBy?: string
}

export type BeoItemKind = 'package' | 'menu' | 'beverage' | 'other'

/** beo_items: food, drink and packages ordered for the event. Equipment and staff are resource_bookings. */
export interface BeoItem {
  id: string
  propertyId: string
  beoId: string
  kind: BeoItemKind
  packageId?: string
  description: string
  date: string
  time?: string
  quantity: number
  /** Price and cost per unit; for a per-head line, per person. */
  unitPrice: number
  unitCost: number
  perHead: boolean
}

export type PackageKind = 'day-delegate' | 'half-day' | 'wedding' | 'cocktail' | 'menu'

/** packages: priced per head. */
export interface EventPackage {
  id: string
  propertyId: string
  name: string
  kind: PackageKind
  pricePerHead: number
  costPerHead: number
  active: boolean
}

/** package_items: what a package includes. */
export interface PackageItem {
  id: string
  propertyId: string
  packageId: string
  category: 'food' | 'beverage' | 'room-hire' | 'equipment' | 'other'
  description: string
}

export type EquipmentCategory = 'av' | 'furniture' | 'decor' | 'staff'

/** equipment: things and people the hotel has a fixed number of. Staff are kept here as resources. */
export interface Equipment {
  id: string
  propertyId: string
  name: string
  category: EquipmentCategory
  quantityOwned: number
  dailyRate: number
  dailyCost: number
}

/** resource_bookings */
export interface ResourceBooking {
  id: string
  propertyId: string
  eventBookingId: string
  equipmentId: string
  date: string
  quantity: number
  /** What the client pays per unit per day. Copied from the equipment when booked. */
  unitPrice: number
  unitCost: number
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined'

/** quotes: one proposal, which can go through several versions. */
export interface Quote {
  id: string
  propertyId: string
  number: string
  leadId?: string
  eventBookingId?: string
  title: string
  status: QuoteStatus
  currentVersion: number
  validUntil: string
  sentAt?: string
  sentBy?: string
  acceptedAt?: string
  acceptedBy?: string
  createdAt: string
  createdBy: string
}

export type QuoteLineKind = 'package' | 'space' | 'room' | 'equipment' | 'other'

/** quote_lines: belong to one version. */
export interface QuoteLine {
  id: string
  propertyId: string
  quoteVersionId: string
  kind: QuoteLineKind
  refId?: string
  description: string
  quantity: number
  unitPrice: number
  unitCost: number
}

/** quote_versions: the first version and every amendment after it. */
export interface QuoteVersion {
  id: string
  propertyId: string
  quoteId: string
  version: number
  reason: string
  discountPct: number
  subtotal: number
  discount: number
  total: number
  createdAt: string
  createdBy: string
}

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled'

/** contracts */
export interface Contract {
  id: string
  propertyId: string
  number: string
  eventBookingId: string
  quoteId: string
  quoteVersion: number
  value: number
  status: ContractStatus
  cancellationTerms: string
  sentAt?: string
  signedAt?: string
  signedBy?: string
  createdAt: string
  createdBy: string
}

/** deposit_schedules */
export interface DepositSchedule {
  id: string
  propertyId: string
  contractId: string
  label: string
  dueDate: string
  amount: number
}

/** event_payments */
export interface EventPayment {
  id: string
  propertyId: string
  eventBookingId: string
  depositScheduleId?: string
  amount: number
  method: string
  reference: string
  receivedAt: string
  receivedBy: string
}

/** master_accounts: one bill for everything the organiser pays. */
export interface MasterAccount {
  id: string
  propertyId: string
  eventBookingId: string
  name: string
  companyId?: string
  groupBlockId?: string
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string
  closedAt?: string
  closedBy?: string
}

export type PostingCategory = 'Room hire' | 'Food' | 'Beverage' | 'Equipment' | 'Rooms' | 'Other'

/** event_postings: a charge on the master account. */
export interface EventPosting {
  id: string
  propertyId: string
  masterAccountId: string
  eventBookingId: string
  date: string
  category: PostingCategory
  description: string
  amount: number
  source: 'beo' | 'resource' | 'space' | 'manual'
  sourceId?: string
  /** Set when the same charge was also put on a guest folio (the group's lead room). */
  folioReservationId?: string
  postedAt: string
  postedBy: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}

export type CostCategory = 'food' | 'beverage' | 'staff' | 'equipment' | 'decor' | 'other'

/** event_costs: what the event actually cost the hotel. */
export interface EventCost {
  id: string
  propertyId: string
  eventBookingId: string
  category: CostCategory
  description: string
  amount: number
  recordedAt: string
  recordedBy: string
}

/** Everything for one hotel, as the screens read it. */
export interface EventsData {
  leads: Lead[]
  spaces: FunctionSpace[]
  setups: SpaceSetup[]
  bookings: EventBooking[]
  sessions: EventSession[]
  beos: Beo[]
  beoItems: BeoItem[]
  packages: EventPackage[]
  packageItems: PackageItem[]
  equipment: Equipment[]
  resourceBookings: ResourceBooking[]
  quotes: Quote[]
  quoteLines: QuoteLine[]
  quoteVersions: QuoteVersion[]
  contracts: Contract[]
  depositSchedules: DepositSchedule[]
  payments: EventPayment[]
  masterAccounts: MasterAccount[]
  postings: EventPosting[]
  costs: EventCost[]
}

// ---- Inputs ----

export type LeadInput = Pick<
  Lead,
  | 'title'
  | 'eventType'
  | 'companyId'
  | 'clientName'
  | 'contactName'
  | 'contactPhone'
  | 'contactEmail'
  | 'ownerId'
  | 'ownerName'
  | 'eventDate'
  | 'endDate'
  | 'expectedGuests'
  | 'estimatedValue'
  | 'probability'
  | 'source'
  | 'notes'
>

export type BookingInput = Pick<
  EventBooking,
  'name' | 'eventType' | 'companyId' | 'clientName' | 'contactName' | 'contactPhone' | 'startDate' | 'endDate' | 'expectedGuests' | 'ownerName' | 'notes'
> & { leadId?: string; status?: EventStatus }

export type SessionInput = Pick<EventSession, 'eventBookingId' | 'spaceId' | 'title' | 'date' | 'startTime' | 'endTime' | 'setup' | 'pax'>

export type BeoItemInput = Pick<BeoItem, 'kind' | 'packageId' | 'description' | 'date' | 'time' | 'quantity' | 'unitPrice' | 'unitCost' | 'perHead'>

export type QuoteLineInput = Pick<QuoteLine, 'kind' | 'refId' | 'description' | 'quantity' | 'unitPrice' | 'unitCost'>

export type SpaceInput = Pick<FunctionSpace, 'name' | 'kind' | 'areaSqm' | 'hireRateHalfDay' | 'hireRateFullDay'> & {
  setups: { setup: SetupStyle; capacity: number }[]
}

export type PackageInput = Pick<EventPackage, 'name' | 'kind' | 'pricePerHead' | 'costPerHead'> & { items: string[] }

export type EquipmentInput = Pick<Equipment, 'name' | 'category' | 'quantityOwned' | 'dailyRate' | 'dailyCost'>

export type PostingInput = Pick<EventPosting, 'category' | 'description' | 'amount' | 'date' | 'source' | 'sourceId' | 'folioReservationId'>

export type CostInput = Pick<EventCost, 'category' | 'description' | 'amount'>

export type PaymentInput = Pick<EventPayment, 'amount' | 'method' | 'reference' | 'depositScheduleId'>

export type { Actor }
