// What a group really costs: the business it keeps out.
//
// A block of ten rooms at 120,000 looks like money until you notice the hotel would have sold eight of
// those rooms anyway, at 165,000, to guests who are now turned away. The group is worth taking when it
// fills rooms that would otherwise have stood empty, and worth refusing when it fills rooms somebody
// else was going to pay more for. That is the whole of displacement analysis, and hotels lose real
// money every year for want of doing the arithmetic before saying yes.
//
// Two honest limits, both of which this states rather than hides:
//
//   - A group only displaces business on nights that would otherwise have come close to selling out.
//     Ten rooms on a Tuesday this hotel never fills displaces nothing, and any figure claiming
//     otherwise is a figure somebody made up.
//   - Knowing what a night would have reached means a forecast, and the forecast is this hotel's own
//     habit projected forward. Where there is not enough history to project, this says so and offers no
//     number at all. An invented cost is worse than no cost: it gets quoted in a meeting.
//
// Pure rules only: no React.

import { nightsOfStay } from './rateRules'
import type { NightPace } from './pace'
import type { Room } from '../types'

export interface GroupAsk {
  type: Room['type']
  count: number
  /** The nightly rate agreed with the group, per room. */
  rate: number
}

export interface DisplacedNight {
  date: string
  /** Rooms the group wants that night. */
  asked: number
  /** Rooms already sold for that night before the group. */
  onBooks: number
  sellable: number
  /** Where the night is expected to finish without the group. */
  forecast?: number
  /** Rooms of that forecast the group would push out. */
  displaced: number
  /** What those rooms were expected to fetch, each. */
  transientRate: number
  /** What the group pays for the night. */
  groupMoney: number
  /** What the displaced rooms would have fetched. */
  lostMoney: number
  known: boolean
}

export type Verdict = 'worth taking' | 'costs more than it brings' | 'close call' | 'cannot say yet'

export const VERDICT_TONE: Record<Verdict, 'good' | 'bad' | 'warn' | 'neutral'> = {
  'worth taking': 'good',
  'costs more than it brings': 'bad',
  'close call': 'warn',
  'cannot say yet': 'neutral',
}

export const VERDICT_NOTE: Record<Verdict, string> = {
  'worth taking': 'The group brings more than the business it keeps out.',
  'costs more than it brings':
    'These nights were filling without the group. Taking it at this rate turns paying guests away for less money.',
  'close call': 'The group and the business it displaces come to about the same. Decide on the other merits.',
  'cannot say yet':
    'There is not enough history to say what these nights would have reached, so no cost is claimed either way.',
}

export interface Displacement {
  nights: DisplacedNight[]
  /** What the group pays over the whole block. */
  groupMoney: number
  /** What the displaced rooms would have fetched. */
  lostMoney: number
  /** The difference. Positive means the group brings more than it keeps out. */
  net: number
  /** Nights where the group actually pushes somebody out. */
  tightNights: number
  verdict: Verdict
  /** True when at least one night could be forecast at all. */
  known: boolean
}

/**
 * The cost of a block, night by night.
 *
 * `rateFor` gives the rate a displaced room would have fetched that night - the hotel's own calendar
 * price, which already carries the season, the day and the occupancy step. Using today's published
 * rate instead would understate every busy night, which are precisely the nights that matter.
 */
export function displacementOf(
  ask: GroupAsk[],
  arrival: string,
  departure: string,
  pace: Record<string, NightPace>,
  rateFor: (type: Room['type'], date: string) => number,
): Displacement {
  const dates = nightsOfStay(arrival, departure)
  const roomsAsked = ask.reduce((n, a) => n + a.count, 0)
  const moneyPerNight = ask.reduce((n, a) => n + a.count * a.rate, 0)
  // One number for what a displaced room fetches: the average of the types asked for, weighted by how
  // many of each. A group turning away guests does not get to choose which rooms they wanted.
  const rateOn = (date: string) => {
    if (roomsAsked === 0) return 0
    const total = ask.reduce((n, a) => n + a.count * rateFor(a.type, date), 0)
    return Math.round(total / roomsAsked)
  }

  const nights: DisplacedNight[] = dates.map((date) => {
    const p = pace[date]
    const sellable = p?.sellable ?? 0
    const onBooks = p?.onBooks ?? 0
    const forecast = p?.forecast
    const transientRate = rateOn(date)
    const known = forecast !== undefined

    // Rooms left once the house has filled the way it usually fills. Anything the group asks for beyond
    // that is a room taken from somebody who would have paid for it.
    const spare = known ? Math.max(0, sellable - (forecast as number)) : sellable - onBooks
    const displaced = known ? Math.max(0, roomsAsked - spare) : 0

    return {
      date,
      asked: roomsAsked,
      onBooks,
      sellable,
      forecast,
      displaced,
      transientRate,
      groupMoney: moneyPerNight,
      lostMoney: displaced * transientRate,
      known,
    }
  })

  const groupMoney = nights.reduce((n, x) => n + x.groupMoney, 0)
  const lostMoney = nights.reduce((n, x) => n + x.lostMoney, 0)
  const net = groupMoney - lostMoney
  const known = nights.some((n) => n.known)
  const tightNights = nights.filter((n) => n.displaced > 0).length

  let verdict: Verdict = 'cannot say yet'
  if (known) {
    // Within a tenth of each other is not a difference anybody should decide on.
    const edge = Math.max(groupMoney, lostMoney) * 0.1
    verdict = net > edge ? 'worth taking' : net < -edge ? 'costs more than it brings' : 'close call'
  }

  return { nights, groupMoney, lostMoney, net, tightNights, verdict, known }
}
