import type { Unsubscribe } from '../types'
import type {
  Actor,
  Beo,
  BeoItem,
  BeoItemInput,
  BookingInput,
  Contract,
  CostInput,
  DepositSchedule,
  EquipmentInput,
  EventBooking,
  EventCost,
  EventPayment,
  EventPosting,
  EventSession,
  EventStatus,
  EventsData,
  Equipment,
  EventPackage,
  FunctionSpace,
  Lead,
  LeadInput,
  LeadStage,
  MasterAccount,
  PackageInput,
  PaymentInput,
  PostingInput,
  Quote,
  QuoteLineInput,
  ResourceBooking,
  SessionInput,
  SpaceInput,
} from './eventsTypes'

// What the screens need from events, banqueting and sales. Every change takes the actor so the
// backend can check permissions and keep the trail. Each method rejects with an Error to show.
export interface EventsService {
  /** Every record for one hotel. */
  load(propertyId: string): Promise<EventsData>

  // Pipeline
  createLead(propertyId: string, input: LeadInput, actor: Actor): Promise<Lead>
  updateLead(id: string, input: LeadInput, actor: Actor): Promise<Lead>
  /** Tentative or definite makes (or updates) the event booking; lost needs a reason. */
  moveLead(id: string, stage: LeadStage, actor: Actor, lostReason?: string): Promise<Lead>

  // Bookings and the diary
  createBooking(propertyId: string, input: BookingInput, actor: Actor): Promise<EventBooking>
  updateBooking(id: string, patch: Partial<BookingInput> & { guaranteedGuests?: number }, actor: Actor): Promise<EventBooking>
  /** Definite fails while any of its sessions clashes with another live booking. */
  setBookingStatus(id: string, status: EventStatus, actor: Actor): Promise<EventBooking>
  linkGroupBlock(id: string, groupBlockId: string | null, actor: Actor): Promise<EventBooking>
  /** Checks the setup fits the space and that the slot is free. */
  saveSession(propertyId: string, input: SessionInput & { id?: string }, actor: Actor): Promise<EventSession>
  deleteSession(id: string, actor: Actor): Promise<void>

  // BEO and resources
  saveBeo(id: string, patch: Pick<Beo, 'agenda' | 'kitchenNotes' | 'setupNotes'>, actor: Actor): Promise<Beo>
  issueBeo(id: string, actor: Actor): Promise<Beo>
  signBeo(id: string, signedBy: string, actor: Actor): Promise<Beo>
  addBeoItem(beoId: string, input: BeoItemInput, actor: Actor): Promise<BeoItem>
  removeBeoItem(id: string, actor: Actor): Promise<void>
  /** Fails when the hotel does not have that many free on the day. */
  bookResource(eventBookingId: string, equipmentId: string, date: string, quantity: number, actor: Actor): Promise<ResourceBooking>
  removeResource(id: string, actor: Actor): Promise<void>

  // Quotes, contracts, deposits
  createQuote(
    propertyId: string,
    input: { title: string; leadId?: string; eventBookingId?: string; validUntil: string; discountPct: number; lines: QuoteLineInput[] },
    actor: Actor,
  ): Promise<Quote>
  /** A new version. The old ones stay, so the totals can be compared. */
  amendQuote(id: string, input: { reason: string; discountPct: number; lines: QuoteLineInput[] }, actor: Actor): Promise<Quote>
  sendQuote(id: string, actor: Actor): Promise<Quote>
  /** Accepting makes the booking if there is none, and a draft contract with a deposit schedule. */
  acceptQuote(id: string, actor: Actor): Promise<Quote>
  declineQuote(id: string, actor: Actor): Promise<Quote>
  sendContract(id: string, actor: Actor): Promise<Contract>
  /** Signing makes the booking definite. */
  signContract(id: string, signedBy: string, actor: Actor): Promise<Contract>
  cancelContract(id: string, actor: Actor): Promise<Contract>
  saveDepositSchedule(contractId: string, rows: (Pick<DepositSchedule, 'label' | 'dueDate' | 'amount'> & { id?: string })[], actor: Actor): Promise<DepositSchedule[]>
  recordPayment(eventBookingId: string, input: PaymentInput, actor: Actor): Promise<EventPayment>

  // Master billing and profitability
  openMasterAccount(eventBookingId: string, actor: Actor): Promise<MasterAccount>
  postCharge(masterAccountId: string, input: PostingInput, actor: Actor): Promise<EventPosting>
  voidPosting(id: string, reason: string, actor: Actor): Promise<EventPosting>
  closeMasterAccount(id: string, actor: Actor): Promise<MasterAccount>
  addCost(eventBookingId: string, input: CostInput, actor: Actor): Promise<EventCost>
  removeCost(id: string, actor: Actor): Promise<void>

  // Set-up
  saveSpace(propertyId: string, input: SpaceInput & { id?: string }, actor: Actor): Promise<FunctionSpace>
  setSpaceActive(id: string, active: boolean, actor: Actor): Promise<FunctionSpace>
  savePackage(propertyId: string, input: PackageInput & { id?: string }, actor: Actor): Promise<EventPackage>
  saveEquipment(propertyId: string, input: EquipmentInput & { id?: string }, actor: Actor): Promise<Equipment>

  subscribe(listener: () => void): Unsubscribe
}
