// Pure rules for events, shared by the mock service and the screens. The backend applies the same.
import type {
  BeoItem,
  DepositSchedule,
  EventBooking,
  EventCost,
  EventPayment,
  EventPosting,
  EventSession,
  EventsData,
  Equipment,
  LeadStage,
  QuoteLine,
  QuoteLineInput,
  ResourceBooking,
  SetupStyle,
  SpaceSetup,
} from './eventsTypes'

export const STAGES: LeadStage[] = ['enquiry', 'proposal', 'tentative', 'definite', 'lost']

export const STAGE_LABEL: Record<LeadStage, string> = {
  enquiry: 'Enquiry',
  proposal: 'Proposal',
  tentative: 'Tentative',
  definite: 'Definite',
  lost: 'Lost',
}

/** The usual chance of a lead at each stage, used when the stage changes. */
export const STAGE_PROBABILITY: Record<LeadStage, number> = { enquiry: 20, proposal: 40, tentative: 70, definite: 100, lost: 0 }

export const SETUP_LABEL: Record<SetupStyle, string> = {
  theatre: 'Theatre',
  classroom: 'Classroom',
  banquet: 'Banquet',
  boardroom: 'Boardroom',
  'u-shape': 'U-shape',
  cocktail: 'Cocktail',
}

export const LOST_REASONS = ['Price', 'Dates not available', 'Chose another venue', 'Event cancelled', 'No response', 'Capacity']

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const overlaps = (a: Pick<EventSession, 'date' | 'startTime' | 'endTime' | 'spaceId'>, b: Pick<EventSession, 'date' | 'startTime' | 'endTime' | 'spaceId'>) =>
  a.spaceId === b.spaceId && a.date === b.date && mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime)

export const sessionHours = (s: Pick<EventSession, 'startTime' | 'endTime'>) => (mins(s.endTime) - mins(s.startTime)) / 60

/** Sessions of live bookings that share a space and time with this one. */
export function clashesFor(
  session: Pick<EventSession, 'date' | 'startTime' | 'endTime' | 'spaceId'> & { id?: string },
  sessions: EventSession[],
  bookings: EventBooking[],
): EventSession[] {
  const live = new Set(bookings.filter((b) => b.status !== 'cancelled').map((b) => b.id))
  return sessions.filter((s) => s.id !== session.id && live.has(s.eventBookingId) && overlaps(s, session))
}

export const capacityOf = (setups: SpaceSetup[], spaceId: string, setup: SetupStyle) =>
  setups.find((x) => x.spaceId === spaceId && x.setup === setup)?.capacity

/** How many of an item are free on a date, leaving out one booking line when it is being changed. */
export function availableOn(item: Equipment, date: string, bookings: ResourceBooking[], live: Set<string>, exceptId?: string) {
  const used = bookings
    .filter((r) => r.equipmentId === item.id && r.date === date && r.id !== exceptId && live.has(r.eventBookingId))
    .reduce((s, r) => s + r.quantity, 0)
  return item.quantityOwned - used
}

export const beoLineTotal = (i: Pick<BeoItem, 'quantity' | 'unitPrice'>) => i.quantity * i.unitPrice
export const beoLineCost = (i: Pick<BeoItem, 'quantity' | 'unitCost'>) => i.quantity * i.unitCost

export function quoteTotals(lines: (QuoteLine | QuoteLineInput)[], discountPct: number) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const discount = Math.round((subtotal * discountPct) / 100)
  const cost = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)
  return { subtotal, discount, total: subtotal - discount, cost }
}

export function depositStatus(row: DepositSchedule, payments: EventPayment[], today: string) {
  const paid = payments.filter((p) => p.depositScheduleId === row.id).reduce((s, p) => s + p.amount, 0)
  const status: 'paid' | 'part' | 'overdue' | 'due' = paid >= row.amount ? 'paid' : row.dueDate < today ? 'overdue' : paid > 0 ? 'part' : 'due'
  return { paid, outstanding: Math.max(0, row.amount - paid), status }
}

export const livePostings = (postings: EventPosting[]) => postings.filter((p) => !p.voidedAt)

export interface EventMoney {
  /** From the BEO, resources and space hire: what the event should bring in. */
  forecastRevenue: number
  forecastCost: number
  /** What has been posted to the master account. */
  postedRevenue: number
  /** Recorded costs, or the forecast cost while nothing is recorded. */
  actualCost: number
  paid: number
}

/** The space hire for one session: half-day rate up to five hours, full day beyond. */
export function hireFor(session: EventSession, data: Pick<EventsData, 'spaces'>) {
  const space = data.spaces.find((s) => s.id === session.spaceId)
  if (!space) return 0
  return sessionHours(session) > 5 ? space.hireRateFullDay : space.hireRateHalfDay
}

export function eventMoney(bookingId: string, data: EventsData): EventMoney {
  const beoIds = new Set(data.beos.filter((b) => b.eventBookingId === bookingId).map((b) => b.id))
  const items = data.beoItems.filter((i) => beoIds.has(i.beoId))
  const resources = data.resourceBookings.filter((r) => r.eventBookingId === bookingId)
  const sessions = data.sessions.filter((s) => s.eventBookingId === bookingId)
  const hire = sessions.reduce((s, x) => s + hireFor(x, data), 0)
  const forecastRevenue =
    items.reduce((s, i) => s + beoLineTotal(i), 0) + resources.reduce((s, r) => s + r.quantity * r.unitPrice, 0) + hire
  const forecastCost = items.reduce((s, i) => s + beoLineCost(i), 0) + resources.reduce((s, r) => s + r.quantity * r.unitCost, 0)
  const postedRevenue = livePostings(data.postings.filter((p) => p.eventBookingId === bookingId)).reduce((s, p) => s + p.amount, 0)
  const recorded: EventCost[] = data.costs.filter((c) => c.eventBookingId === bookingId)
  const actualCost = recorded.length ? recorded.reduce((s, c) => s + c.amount, 0) : forecastCost
  const paid = data.payments.filter((p) => p.eventBookingId === bookingId).reduce((s, p) => s + p.amount, 0)
  return { forecastRevenue, forecastCost, postedRevenue, actualCost, paid }
}

export const marginPct = (revenue: number, cost: number) => (revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0)
