// Groups: a block of rooms held under one name.
//
// In this market a group is rarely one thing. A ministry workshop puts twenty-five people in a hotel
// and pays for the rooms and the buffet but not the bar. A wedding party holds ten rooms under the
// family's name and every guest pays for their own. A tour operator buys rooms at a net rate and sells
// them on at a price the hotel never sees. Each of those is the same block of rooms and a completely
// different conversation at the desk on checkout morning.
//
// So a block carries its own answer to one question - who pays for what - and every bill in it follows
// that answer. The rest is ordinary bookings: a block is rooms, and rooms are bookings, which is why
// the rack, availability and check-in need nothing new to understand a group.
//
// Pure rules only: no React.

import { chargeCategories } from './folio'
import type { Reservation, Room } from '../types'

export type GroupBilling = 'master-all' | 'master-room' | 'each-guest' | 'agent-net'

export const BILLING_LABEL: Record<GroupBilling, string> = {
  'master-all': 'The organiser pays everything',
  'master-room': 'The organiser pays the room and meals',
  'each-guest': 'Every guest pays their own',
  'agent-net': 'An agent pays a net rate',
}

export const BILLING_NOTE: Record<GroupBilling, string> = {
  'master-all':
    'One invoice to the organisation for the whole block, extras included. Used when a ministry or an NGO is covering the event outright.',
  'master-room':
    'The room and the agreed meals go to the organiser. The bar, laundry and room service stay with the guest and are settled at the desk when they leave.',
  'each-guest':
    'Rooms are held together so the party stays together, but there is no central payer. Each guest settles their own bill.',
  'agent-net':
    'The hotel is paid the net rate by the agent. What the guest paid the agent is the agent’s business, and the hotel’s printout never shows the net rate.',
}

/** Whether this block has somebody other than the guest paying for anything. */
export const hasMaster = (billing: GroupBilling): boolean => billing !== 'each-guest'

/**
 * What a master bill can be asked to carry. These are the hotel's own charge categories and nothing
 * else: a list of tidy words like "Conference" and "Breakfast" would read well and route nothing,
 * because the only categories a charge is ever posted under are these.
 */
export const COVERABLE = ['Room', ...chargeCategories]

/** What each kind of block covers before the hotel edits it. */
export function defaultCovers(billing: GroupBilling): string[] {
  if (billing === 'master-all') return [...COVERABLE]
  // The room and the meals the package includes. A restaurant bill is the workshop's buffet; the bar
  // and the laundry are the guest's own, which is the whole point of the arrangement.
  if (billing === 'master-room') return ['Room', 'Restaurant', 'Transport']
  if (billing === 'agent-net') return ['Room']
  return []
}

export interface GroupRooms {
  type: Room['type']
  count: number
}

export interface GroupBlock {
  id: string
  /** What the desk says out loud: "the Kato wedding". Short, and unique in the hotel. */
  code: string
  name: string
  billing: GroupBilling
  /** The organisation being invoiced, when there is one. */
  accountId?: string
  /** The travel agent, on a net-rate block. */
  agentId?: string
  organiser: { name: string; phone: string; email?: string }
  arrival: string
  departure: string
  rooms: GroupRooms[]
  /** What the hotel charges this group per room per night. Falls back to the hotel's own rate. */
  rates: Partial<Record<Room['type'], number>>
  /** Net rate only: what the hotel actually receives. Never printed for the guest. */
  net: Partial<Record<Room['type'], number>>
  /** Meal plan included in the block rate. */
  plan?: string
  /** The categories the master bill covers. */
  covers: string[]
  /** Rooms not taken by this date go back on sale. */
  cutOff?: string
  status: GroupStatus
  note?: string
  at: string
  by: string
}

export type GroupStatus = 'held' | 'confirmed' | 'in-house' | 'closed' | 'cancelled'

export const STATUS_LABEL: Record<GroupStatus, string> = {
  held: 'Held',
  confirmed: 'Confirmed',
  'in-house': 'In house',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const STATUS_TONE: Record<GroupStatus, 'warn' | 'good' | 'brand' | 'neutral' | 'bad'> = {
  held: 'warn',
  confirmed: 'good',
  'in-house': 'brand',
  closed: 'neutral',
  cancelled: 'bad',
}

/** What links a booking to its block. */
export interface GroupLink {
  blockId: string
  code: string
  /** Which room of the block this is, for the placeholder name before anybody is named. */
  index: number
  /** False until the hotel knows who is sleeping in it. */
  named: boolean
}

export const placeholderName = (block: { name: string }, index: number): string => `${block.name} — room ${index}`

export const roomsHeld = (block: GroupBlock): number => block.rooms.reduce((sum, r) => sum + r.count, 0)

export const inBlock = (reservations: Reservation[], blockId: string): Reservation[] =>
  reservations.filter((r) => r.group?.blockId === blockId).sort((a, b) => (a.group?.index ?? 0) - (b.group?.index ?? 0))

export function blockCounts(reservations: Reservation[], blockId: string) {
  const list = inBlock(reservations, blockId)
  return {
    held: list.length,
    named: list.filter((r) => r.group?.named).length,
    arrived: list.filter((r) => r.status === 'in-house').length,
    left: list.filter((r) => r.status === 'checked-out').length,
    released: list.filter((r) => r.status === 'cancelled' || r.status === 'no-show').length,
  }
}

/**
 * Where a charge goes. The block answers it, not the guest: a workshop's bar bill belongs to the person
 * who drank it even though their room is paid for, and that one rule is most of what a group is.
 */
export function routeOf(block: GroupBlock | undefined, category: string): 'master' | 'guest' {
  if (!block || !hasMaster(block.billing)) return 'guest'
  return block.covers.includes(category) ? 'master' : 'guest'
}

/** The rate this block pays for a room type, which is not the hotel's published price. */
export const rateFor = (block: GroupBlock, type: Room['type'], fallback: number): number => block.rates[type] ?? fallback

/** What the hotel actually receives on a net-rate block. Staff only: never on a guest's printout. */
export const netFor = (block: GroupBlock, type: Room['type']): number | undefined =>
  block.billing === 'agent-net' ? block.net[type] : undefined

/** The agent's margin on one room night, which is the agent's business and not the guest's. */
export function agentMargin(block: GroupBlock, type: Room['type'], fallback: number): number {
  const sold = rateFor(block, type, fallback)
  const net = block.net[type]
  return net === undefined ? 0 : Math.max(0, sold - net)
}

export function newBlockId(blocks: GroupBlock[]): string {
  let n = blocks.length + 1
  while (blocks.some((b) => b.id === `GRP-${n}`)) n += 1
  return `GRP-${n}`
}

/** A short code from the name, which the desk can say on the phone. */
export function codeFrom(name: string, blocks: GroupBlock[]): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.slice(0, 4))
      .join('-') || 'GROUP'
  let code = base
  let n = 2
  while (blocks.some((b) => b.code === code)) {
    code = `${base}-${n}`
    n += 1
  }
  return code
}

/** Rooms in a block that nobody has claimed by the cut-off date, which the hotel can sell again. */
export function pastCutOff(block: GroupBlock, reservations: Reservation[], today: string): Reservation[] {
  if (!block.cutOff || today < block.cutOff) return []
  if (block.status === 'cancelled' || block.status === 'closed') return []
  return inBlock(reservations, block.id).filter((r) => r.status === 'booked' && !r.group?.named)
}

// ---- The organiser's bill ----

export interface MasterLine {
  reservationId: string
  guest: string
  room: string | null
  /** What the organiser carries for this room. */
  master: number
  /** What this guest settles themselves. */
  guest_: number
  status: Reservation['status']
}

export interface MasterBill {
  lines: MasterLine[]
  masterTotal: number
  guestTotal: number
  /** Rooms in the block that nobody ever took. */
  unused: number
  /** Net-rate blocks: what the hotel actually receives, and what the agent keeps. */
  net?: number
  margin?: number
}

/**
 * The organiser's side of the whole block, room by room. A hotel cannot invoice a ministry twenty-five
 * times; it sends one bill, and this is the arithmetic behind it.
 */
export function masterBill(
  block: GroupBlock,
  reservations: Reservation[],
  split: (r: Reservation, block: GroupBlock) => { company: { total: number }; guest: { total: number } },
  rackOf: (type: Room['type']) => number,
): MasterBill {
  const rooms = inBlock(reservations, block.id)
  const lines: MasterLine[] = []
  let masterTotal = 0
  let guestTotal = 0
  let net = 0
  let margin = 0

  for (const r of rooms) {
    if (r.status === 'cancelled' || r.status === 'no-show') continue
    const s = split(r, block)
    lines.push({ reservationId: r.id, guest: r.guest, room: r.room, master: s.company.total, guest_: s.guest.total, status: r.status })
    masterTotal += s.company.total
    guestTotal += s.guest.total
    if (block.billing === 'agent-net') {
      const rack = rackOf(r.roomType)
      const n = block.net[r.roomType]
      if (n !== undefined) {
        const nights = Math.max(1, Math.round((Date.parse(`${r.departure}T00:00:00`) - Date.parse(`${r.arrival}T00:00:00`)) / 86400000))
        net += n * nights
        margin += agentMargin(block, r.roomType, rack) * nights
      }
    }
  }

  const counts = blockCounts(reservations, block.id)
  return {
    lines,
    masterTotal,
    guestTotal,
    unused: counts.held - counts.named,
    ...(block.billing === 'agent-net' ? { net, margin } : {}),
  }
}
