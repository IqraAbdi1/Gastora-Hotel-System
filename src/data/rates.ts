import type { GuaranteeType, Room } from '../types'
import type { DemandEvent } from '../lib/demandEvents'
import { TODAY } from './sample'

// Sample prices. In the real system each hotel sets its own (FR-RMS-004).
export const roomRate: Record<Room['type'], number> = { Standard: 150000, Deluxe: 180000, Suite: 350000 }

export type RatePlan = { id: string; name: string; inclusions: string; extraPerNight: number }

export const ratePlans: RatePlan[] = [
  { id: 'room-only', name: 'Room only', inclusions: 'Room and Wi-Fi', extraPerNight: 0 },
  { id: 'bb', name: 'Bed and breakfast', inclusions: 'Room, Wi-Fi and breakfast for two', extraPerNight: 30000 },
  { id: 'hb', name: 'Half board', inclusions: 'Room, breakfast and dinner for two', extraPerNight: 70000 },
]

// Sample no-show and release rules (FR-RES-038). Each hotel will configure its own.
export const guarantees: { key: GuaranteeType; label: string; rule: string }[] = [
  { key: 'deposit', label: 'Deposit paid', rule: 'If the guest does not arrive, the deposit is kept as the no-show charge.' },
  { key: 'card', label: 'Card guarantee', rule: 'If the guest does not arrive, one night is charged to the card.' },
  { key: 'company', label: 'Company account', rule: 'If the guest does not arrive, the stay is billed to the company.' },
  { key: 'none', label: 'No guarantee', rule: 'The room is released at 18:00 on the arrival day if the guest has not arrived.' },
]

export const DEPOSIT_RATE = 0.3
// Sample demand events for the revenue page. Dates are worked out from today so the demo never goes
// stale: the summit always falls within the next few weeks, and each public holiday is its next one.

const shift = (date: string, by: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

/** The next time a month and day comes round, today included. */
const next = (mmdd: string) => {
  const year = Number(TODAY.slice(0, 4))
  return `${year}-${mmdd}` >= TODAY ? `${year}-${mmdd}` : `${year + 1}-${mmdd}`
}

const summitFrom = shift(TODAY, 9)
const christmas = next('12-24')
const independence = next('10-09')
const martyrs = next('06-03')

export const SAMPLE_EVENTS: DemandEvent[] = [
  {
    id: 'event-1',
    name: 'East Africa Business Summit',
    from: summitFrom,
    to: shift(summitFrom, 2),
    effect: 'high',
    note: 'Speke Resort Munyonyo is hosting. The organisers asked our sales office for rates for three delegations.',
  },
  {
    id: 'event-2',
    name: 'Christmas',
    from: christmas,
    to: shift(christmas, 2),
    effect: 'high',
    note: 'Families home from abroad. Last year the house was full on the 24th and 25th.',
  },
  {
    id: 'event-3',
    name: "Martyrs' Day",
    from: shift(martyrs, -1),
    to: martyrs,
    effect: 'some',
    note: 'Pilgrims for Namugongo. Mostly Standard rooms, booked late and paid in cash.',
    types: ['Standard'],
  },
  {
    id: 'event-4',
    name: 'Independence Day',
    from: shift(independence, -1),
    to: independence,
    effect: 'percent',
    percent: -5,
    note: 'Public holiday. Business travel stops for the long weekend; few leisure guests replace it.',
  },
]
