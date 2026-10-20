// Dining, spa and activities a guest can book from their own page.
//
// A table at the restaurant, a massage, a boat trip: each is something the hotel runs at set times for
// a set number of people. The hotel lists them once (name, how long, what it costs, when it runs and how
// many it takes at a time), and the guest picks a day of their stay, a time with room left and how many
// are coming.
//
// A booking is a request until somebody says yes, the same as everything else on the guest's page.
// Space is held from the moment the guest asks, though: two guests asking for the last two places on
// the same boat must not both be told it is free. A declined or cancelled booking gives its places back.
//
// Honest limits: capacity is counted per starting time, so a 60-minute massage at 10:00 does not block
// the 10:30 start if the hotel runs half-hourly starts. A hotel with one therapist sets hourly starts.
// There is no table plan, no therapist roster and no weather: those are decided by a person on
// confirming.
//
// Pure rules only: no React.

import { addDays } from './availability'
import type { FolioCharge } from '../types'

export type ServiceCategory = 'dining' | 'spa' | 'activity'

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  dining: 'Dining',
  spa: 'Spa',
  activity: 'Activity',
}

/** Which folio category a confirmed booking is charged under. */
export const CATEGORY_CHARGE: Record<ServiceCategory, string> = {
  dining: 'Restaurant',
  spa: 'Spa',
  activity: 'Other',
}

export interface BookableService {
  id: string
  name: string
  category: ServiceCategory
  /** One line the guest reads before choosing. */
  blurb: string
  durationMin: number
  /** 0 means free: a table is booked free and the meal is paid at the restaurant. */
  price: number
  per: 'person' | 'booking'
  /** First and last starting time, 24-hour "HH:MM". */
  firstStart: string
  lastStart: string
  /** Minutes between starting times. */
  everyMin: number
  /** People per starting time. */
  capacity: number
  /** The largest party one booking may bring. */
  maxParty: number
  on: boolean
}

export interface ServiceBooking {
  id: string
  at: string
  serviceId: string
  /** Kept as it was when booked, so a renamed or removed service still reads sensibly. */
  serviceName: string
  category: ServiceCategory
  reservationId: string
  guestName: string
  room?: string
  date: string
  time: string
  party: number
  notes?: string
  /** What it comes to for this party. 0 when free. */
  price: number
  state: 'requested' | 'confirmed' | 'declined' | 'cancelled'
  by?: string
  decidedAt?: string
  /** Why the hotel said no, in words the guest could be told. */
  reason?: string
  /** True once the money is on the room bill. */
  posted?: boolean
}

export const STATE_LABEL: Record<ServiceBooking['state'], string> = {
  requested: 'Waiting for the hotel',
  confirmed: 'Confirmed',
  declined: 'Not possible',
  cancelled: 'Cancelled',
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const toHhmm = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Every starting time the service runs on a day. */
export function startsOf(s: BookableService): string[] {
  const out: string[] = []
  const first = toMin(s.firstStart)
  const last = toMin(s.lastStart)
  const step = Math.max(15, s.everyMin || 60)
  for (let t = first; t <= last && out.length < 96; t += step) out.push(toHhmm(t))
  return out
}

/** A booking that is still holding its places. */
export const holdsSpace = (b: ServiceBooking): boolean => b.state === 'requested' || b.state === 'confirmed'

/** People already booked on this service at this time. */
export function takenAt(bookings: ServiceBooking[], serviceId: string, date: string, time: string): number {
  return bookings
    .filter((b) => b.serviceId === serviceId && b.date === date && b.time === time && holdsSpace(b))
    .reduce((n, b) => n + b.party, 0)
}

export interface Slot {
  time: string
  left: number
  /** Too late to book today, or not enough room for this party. */
  open: boolean
}

/**
 * The day's starting times with how many places are left. `nowHhmm` closes the times already gone when
 * the day is today; a booking is also closed an hour before it starts, so somebody can prepare.
 */
export function slotsFor(
  s: BookableService,
  date: string,
  bookings: ServiceBooking[],
  party: number,
  today: string,
  nowHhmm: string,
): Slot[] {
  return startsOf(s).map((time) => {
    const left = Math.max(0, s.capacity - takenAt(bookings, s.id, date, time))
    const gone = date < today || (date === today && toMin(time) < toMin(nowHhmm) + 60)
    return { time, left, open: !gone && left >= party }
  })
}

/** The days a guest can book on: from arrival to the morning they leave, and never in the past. */
export function daysOfStay(arrival: string, departure: string, today: string): string[] {
  const out: string[] = []
  for (let d = arrival; d <= departure && out.length < 60; d = addDays(d, 1)) if (d >= today) out.push(d)
  return out
}

export const priceFor = (s: BookableService, party: number): number => (s.per === 'person' ? s.price * party : s.price)

/** Why this booking cannot be asked for, or nothing when it can. Checked again against the latest bookings. */
export function bookingProblem(
  s: BookableService,
  date: string,
  time: string,
  party: number,
  bookings: ServiceBooking[],
  days: string[],
): string | undefined {
  if (!s.on) return 'This is not offered at the moment.'
  if (!days.includes(date)) return 'Choose a day during your stay.'
  if (!startsOf(s).includes(time)) return 'Choose a time.'
  if (party < 1) return 'How many are coming?'
  if (party > s.maxParty) return `At most ${s.maxParty} on one booking. For a larger group, please ask the desk.`
  const left = s.capacity - takenAt(bookings, s.id, date, time)
  if (left < party) return left <= 0 ? 'That time has just been taken. Choose another.' : `Only ${left} place${left === 1 ? '' : 's'} left at that time.`
  return undefined
}

/** The line that goes on the room bill when a confirmed booking is charged. */
export function chargeOf(b: ServiceBooking): Omit<FolioCharge, 'id' | 'at'> | null {
  if (b.price <= 0) return null
  return {
    category: CATEGORY_CHARGE[b.category],
    description: `${b.serviceName}, ${b.time}${b.party > 1 ? ` for ${b.party}` : ''}`,
    amount: b.price,
  }
}

export function newServiceId(list: BookableService[]): string {
  let n = list.length + 1
  while (list.some((s) => s.id === `svc-${n}`)) n += 1
  return `svc-${n}`
}

export function newServiceBookingId(list: ServiceBooking[]): string {
  let n = list.length + 1
  while (list.some((b) => b.id === `SB-${String(n).padStart(3, '0')}`)) n += 1
  return `SB-${String(n).padStart(3, '0')}`
}

/** Lakeview Grand's own list, for the demonstration. A new hotel starts with none. */
export const LAKEVIEW_SERVICES: BookableService[] = [
  {
    id: 'svc-1',
    name: 'Lakeside restaurant, dinner table',
    category: 'dining',
    blurb: 'A table on the terrace over the lake. Booking is free; the meal is paid at the restaurant or put on the room.',
    durationMin: 120,
    price: 0,
    per: 'booking',
    firstStart: '18:30',
    lastStart: '21:30',
    everyMin: 30,
    capacity: 20,
    maxParty: 8,
    on: true,
  },
  {
    id: 'svc-2',
    name: 'Swedish massage, 60 minutes',
    category: 'spa',
    blurb: 'Full-body massage with warm shea oil in the garden spa.',
    durationMin: 60,
    price: 150000,
    per: 'person',
    firstStart: '09:00',
    lastStart: '18:00',
    everyMin: 60,
    capacity: 2,
    maxParty: 2,
    on: true,
  },
  {
    id: 'svc-3',
    name: 'Sunset boat trip',
    category: 'activity',
    blurb: 'Two hours on Lake Victoria at sunset, with soft drinks. Leaves from the hotel jetty.',
    durationMin: 120,
    price: 85000,
    per: 'person',
    firstStart: '17:00',
    lastStart: '17:00',
    everyMin: 60,
    capacity: 12,
    maxParty: 12,
    on: true,
  },
  {
    id: 'svc-4',
    name: 'Kampala city tour',
    category: 'activity',
    blurb: 'Kasubi Tombs, the Gaddafi Mosque and Owino market with a local guide. Pickup from the lobby.',
    durationMin: 240,
    price: 120000,
    per: 'person',
    firstStart: '09:00',
    lastStart: '14:00',
    everyMin: 300,
    capacity: 8,
    maxParty: 8,
    on: true,
  },
]

/** Some bookings already taken by other guests, so the demonstration shows places running out. */
export function sampleServiceBookings(today: string): ServiceBooking[] {
  const tomorrow = addDays(today, 1)
  return [
    {
      id: 'SB-001',
      at: `${addDays(today, -1)} 19:12`,
      serviceId: 'svc-3',
      serviceName: 'Sunset boat trip',
      category: 'activity',
      reservationId: 'R-1043',
      guestName: 'David Okello',
      room: '102',
      date: today,
      time: '17:00',
      party: 10,
      notes: 'Team outing from the workshop.',
      price: 850000,
      state: 'confirmed',
      by: 'Rita Auma',
      decidedAt: `${addDays(today, -1)} 19:30`,
    },
    {
      id: 'SB-002',
      at: `${today} 07:40`,
      serviceId: 'svc-2',
      serviceName: 'Swedish massage, 60 minutes',
      category: 'spa',
      reservationId: 'R-1043',
      guestName: 'David Okello',
      room: '102',
      date: tomorrow,
      time: '10:00',
      party: 2,
      notes: 'Couple, side by side if possible.',
      price: 300000,
      state: 'requested',
    },
  ]
}
