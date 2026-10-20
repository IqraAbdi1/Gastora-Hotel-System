// Channels: the places a hotel's rooms are sold other than its own front desk and its own website.
//
// What a channel manager actually does is unglamorous and exact. It keeps, for every date, the number
// of rooms a channel may sell and the price it may sell them at, and it pushes that out whenever
// either changes - availability, rates, inventory, which the trade calls ARI. Bookings come back the
// other way and must land in the hotel's own system before the room is sold twice.
//
// What is real here and what is not:
//
//   - Real: the channels and their commission, the mapping between this hotel's room types and the
//     names a channel uses, what would be pushed for any date, the queue, the failures and the log,
//     and a booking arriving from a channel and becoming an ordinary reservation.
//   - Not real: the wire. No OTA is contacted. Booking.com and the rest do not take a push from any
//     system that has not been certified, and most hotels reach them through an intermediary -
//     SiteMinder, Cloudbeds, STAAH, RateGain - which is a commercial agreement, not a feature. Every
//     push here is marked as a simulation and the page says so.
//
// Pure rules only: no React.

import { freeByType, nightsOf } from './booking'
import { averageNightly } from './rateCalendar'
import type { SoldOn } from './rateCalendar'
import type { RatesPolicy } from './rates'
import type { Reservation, Room } from '../types'

export type ChannelKind = 'ota' | 'gds' | 'wholesaler'

export const KIND_LABEL: Record<ChannelKind, string> = {
  ota: 'Online travel agent',
  gds: 'Global distribution system',
  wholesaler: 'Wholesaler',
}

export const KIND_NOTE: Record<ChannelKind, string> = {
  ota: 'Sells to the public at the hotel’s own price and takes a commission on what it sells.',
  gds: 'Reaches travel agents and corporate booking tools. Usually a fee for each booking rather than a share.',
  wholesaler: 'Buys at a net rate and sells on at whatever it likes. The hotel sees only the net.',
}

/** What this hotel calls a room type, and what the channel calls it. Without this nothing can be sent. */
export interface RoomMapping {
  type: Room['type']
  /** The channel's own name for it. */
  theirName: string
  /** The channel's own rate plan name, where it has one. */
  theirRate?: string
  on: boolean
}

export interface Channel {
  id: string
  name: string
  kind: ChannelKind
  /** What the channel takes, as a percentage of the room money. */
  commissionPercent: number
  /** How many rooms of the house this channel may sell at once. 0 means no limit of its own. */
  allotment: number
  mappings: RoomMapping[]
  on: boolean
  /** When the hotel last sent this channel its rooms and prices. */
  lastPush?: string
}

export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'ch-1',
    name: 'Booking.com',
    kind: 'ota',
    commissionPercent: 15,
    allotment: 0,
    on: false,
    mappings: [
      { type: 'Standard', theirName: 'Standard Double Room', on: true },
      { type: 'Deluxe', theirName: 'Deluxe Twin Room', on: true },
      { type: 'Suite', theirName: '', on: false },
    ],
  },
  {
    id: 'ch-2',
    name: 'Expedia',
    kind: 'ota',
    commissionPercent: 18,
    allotment: 0,
    on: false,
    mappings: [
      { type: 'Standard', theirName: 'Standard Room', on: true },
      { type: 'Deluxe', theirName: '', on: false },
      { type: 'Suite', theirName: '', on: false },
    ],
  },
  {
    id: 'ch-3',
    name: 'Jumia Travel',
    kind: 'ota',
    commissionPercent: 12,
    allotment: 0,
    on: false,
    mappings: [
      { type: 'Standard', theirName: 'Standard', on: true },
      { type: 'Deluxe', theirName: 'Deluxe', on: true },
      { type: 'Suite', theirName: 'Suite', on: true },
    ],
  },
]

/** Room types a channel is meant to sell but cannot, because nobody has said what the channel calls them. */
export const unmapped = (c: Channel): Room['type'][] =>
  c.mappings.filter((m) => m.on && !m.theirName.trim()).map((m) => m.type)

export const sellableBy = (c: Channel): Room['type'][] =>
  c.mappings.filter((m) => m.on && m.theirName.trim()).map((m) => m.type)

/** One date, one room type: what the channel would be told it may sell, and at what price. */
export interface AriLine {
  date: string
  type: Room['type']
  theirName: string
  /** Rooms the channel may sell that night, after the hotel's own allotment. */
  rooms: number
  rate: number
}

/**
 * What would go out for these dates.
 *
 * The count is the hotel's real free rooms, never more, and an allotment can hold some back. The price
 * is the hotel's own calendar price, so a channel is never quoted something the hotel would not honour
 * at its own desk.
 */
export function ariFor(
  c: Channel,
  rooms: Room[],
  reservations: Reservation[],
  rates: RatesPolicy,
  from: string,
  days: number,
  soldOn?: SoldOn,
): AriLine[] {
  const out: AriLine[] = []
  const types = sellableBy(c)
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const next = addDays(date, 1)
    const free = freeByType(rooms, reservations, date, next)
    for (const type of types) {
      const mapping = c.mappings.find((m) => m.type === type)
      const open = Math.max(0, free[type] ?? 0)
      out.push({
        date,
        type,
        theirName: mapping?.theirName ?? '',
        rooms: c.allotment > 0 ? Math.min(open, c.allotment) : open,
        rate: averageNightly(type, date, next, rates, soldOn),
      })
    }
  }
  return out
}

export const addDays = (date: string, by: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

// ---- The queue ----

export type PushState = 'queued' | 'sent' | 'failed'

export const PUSH_TONE: Record<PushState, 'warn' | 'good' | 'bad'> = {
  queued: 'warn',
  sent: 'good',
  failed: 'bad',
}

export interface Push {
  id: string
  channelId: string
  channelName: string
  at: string
  /** The dates covered. */
  from: string
  to: string
  /** How many date-and-room-type lines went. */
  lines: number
  state: PushState
  /** Why it failed, in words a person can act on. */
  reason?: string
  by: string
}

/** Why a channel cannot be sent anything at all, or nothing when it can. */
export function pushProblem(c: Channel): string | undefined {
  if (!c.on) return 'This channel is switched off.'
  const missing = unmapped(c)
  if (missing.length > 0) {
    return `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} meant to be sold here but nobody has said what ${c.name} calls ${missing.length === 1 ? 'it' : 'them'}.`
  }
  if (sellableBy(c).length === 0) return 'No room type is switched on for this channel.'
  return undefined
}

/** What a channel takes from a booking it brought. */
export const commissionOn = (roomMoney: number, c: { commissionPercent: number }): number =>
  Math.round((roomMoney * c.commissionPercent) / 100)

export function newChannelId(list: Channel[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `ch-${n}`)) n += 1
  return `ch-${n}`
}

export function newPushId(list: Push[]): string {
  return `push-${list.length + 1}-${Date.now().toString().slice(-5)}`
}

/** Nights a booking covers, for working out what a channel earned on it. */
export const nightsOfBooking = (r: Reservation): number => Math.max(1, nightsOf(r.arrival, r.departure))

// ---- What each channel actually brought ----
//
// The question a hotelier should ask of a channel is not how many bookings it sent but what the hotel
// kept. A channel at 18% that fills Tuesdays nobody else fills is worth more than one at 12% selling
// rooms the hotel's own site would have sold for nothing. So every line here carries the commission
// and the net, and the hotel's own site and desk sit in the same table at zero.

export interface Production {
  key: string
  name: string
  /** True for business the hotel brought itself, which costs no commission. */
  direct: boolean
  bookings: number
  roomNights: number
  /** What the guests were charged, room and extras together. */
  money: number
  commission: number
  /** What the hotel keeps. */
  net: number
  /** The average a room night fetched through this source. */
  perNight: number
  /** Bookings that were cancelled or never arrived. A channel that books and cancels costs real money. */
  lost: number
}

const SOURCE_NAME: Record<string, string> = {
  online: 'The hotel’s own site',
  'front desk': 'The front desk',
  phone: 'Telephone',
  email: 'Email',
  'walk-in': 'Walked in',
  ota: 'A travel agent, unnamed',
  agent: 'Travel agents',
}

/** The room part of a booking: an agent is paid on the room, not on the extras. */
const roomOnly = (r: Reservation): number => Math.max(0, r.total - (r.charges ?? []).reduce((n, c) => n + c.amount, 0))

const DIRECT_SOURCES = ['online', 'front desk', 'phone', 'email', 'walk-in']

/**
 * Production by where the business came from, for stays arriving in a window.
 *
 * Cancelled and no-show bookings are counted in `lost` but bring no money, because they brought none.
 */
export function productionBy(reservations: Reservation[], from: string, to: string): Production[] {
  const rows = new Map<string, Production>()
  const row = (key: string, name: string, direct: boolean) => {
    if (!rows.has(key)) {
      rows.set(key, { key, name, direct, bookings: 0, roomNights: 0, money: 0, commission: 0, net: 0, perNight: 0, lost: 0 })
    }
    return rows.get(key)!
  }

  for (const r of reservations) {
    if (r.arrival < from || r.arrival > to) continue
    if (r.share && !r.share.primary) continue
    // A named travel agent gets its own line, like a channel, because it costs a commission too.
    const key = r.channel ? `ch:${r.channel.id}` : r.agent ? `ag:${r.agent.id}` : `src:${r.source ?? 'front desk'}`
    const name = r.channel ? r.channel.name : r.agent ? `${r.agent.name} (travel agent)` : SOURCE_NAME[r.source ?? 'front desk'] ?? 'Unknown'
    const line = row(key, name, !r.channel && DIRECT_SOURCES.includes(r.source ?? 'front desk'))

    if (r.status === 'cancelled' || r.status === 'no-show') {
      line.lost += 1
      continue
    }
    const nights = nightsOfBooking(r)
    line.bookings += 1
    line.roomNights += nights
    line.money += r.total
    line.commission += r.channel ? commissionOn(r.total, r.channel) : r.agent ? commissionOn(roomOnly(r), r.agent) : 0
  }

  const out = [...rows.values()]
  for (const line of out) {
    line.net = line.money - line.commission
    line.perNight = line.roomNights ? Math.round(line.money / line.roomNights) : 0
  }
  return out.sort((a, b) => b.net - a.net)
}

/** The totals under a production table. */
export function productionTotals(rows: Production[]) {
  const money = rows.reduce((n, r) => n + r.money, 0)
  const commission = rows.reduce((n, r) => n + r.commission, 0)
  return {
    bookings: rows.reduce((n, r) => n + r.bookings, 0),
    roomNights: rows.reduce((n, r) => n + r.roomNights, 0),
    money,
    commission,
    net: money - commission,
    lost: rows.reduce((n, r) => n + r.lost, 0),
    /** What every commission together took out of the hotel, as a share of what guests paid. */
    costPercent: money ? Math.round((commission / money) * 1000) / 10 : 0,
  }
}
