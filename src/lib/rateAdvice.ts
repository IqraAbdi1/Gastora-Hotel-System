// Rate suggestions: what the system would do about a night, and why, for a person to accept or ignore.
//
// Honesty about what this is. It is not a model and it has not learned anything. It is a short list of
// rules reading the same two things a revenue manager reads - how a night is filling against the way
// this hotel usually fills, and how close it is - and saying so out loud. Every suggestion carries its
// drivers in plain words, and nothing it says changes a price. A person approves, and what is written
// is a price for one date signed with their name.
//
// That ordering is the point. A system that quietly moves prices is one nobody at the desk can defend
// when a guest asks why tonight costs more than last night, and the first time it is wrong in public
// the hotel stops trusting every number on the screen.
//
// Where a driver is a measurement it says Rule. Where it rests on the forecast - which is this hotel's
// own habit projected forward, and can be beaten by any conference nobody told the system about - it
// says Estimate. A hotelier is entitled to know which is which.
//
// Pure rules only: no React.

import type { NightPace } from './pace'
import type { NightPrice } from './rateCalendar'
import type { Room } from '../types'

export type Basis = 'Rule' | 'Estimate'

export interface Driver {
  basis: Basis
  text: string
}

export type Direction = 'raise' | 'lower' | 'hold'

export interface RateAdvice {
  date: string
  type: Room['type']
  direction: Direction
  /** What the night costs now, through the calendar. */
  current: number
  /** What is suggested instead. Equal to current when the advice is to hold. */
  suggested: number
  drivers: Driver[]
  /** How far out the night is, because advice about tonight is a different kind of advice. */
  daysOut: number
  /** Already decided by a person: no suggestion is made over the top of one. */
  settled: boolean
}

const tidy = (n: number) => Math.max(0, Math.round(n / 100) * 100)

export interface AdviceSettings {
  /** The most a suggestion may move a price in one go, as a percentage. */
  mostPercent: number
  /** Nights this far out or nearer are treated as last-minute. */
  lastMinuteDays: number
}

export const DEFAULT_ADVICE: AdviceSettings = { mostPercent: 20, lastMinuteDays: 3 }

/**
 * One night's advice. The rules, in the order a revenue manager would apply them:
 *
 *   - A night a person has already priced is left alone.
 *   - A night running ahead of this hotel's own build-up can take more.
 *   - A night running behind, and close enough that there is little time left to fix it, should come down.
 *   - A night running behind but still far off is left alone: there is time, and cutting early teaches
 *     the market to wait.
 *   - A night nearly full is worth more whatever the pace said.
 */
export function adviseNight(
  pace: NightPace,
  price: NightPrice,
  type: Room['type'],
  settings: AdviceSettings = DEFAULT_ADVICE,
): RateAdvice {
  const drivers: Driver[] = []
  const current = price.rate
  const most = Math.max(1, settings.mostPercent) / 100

  const base: RateAdvice = {
    date: pace.date,
    type,
    direction: 'hold',
    current,
    suggested: current,
    drivers,
    daysOut: pace.daysOut,
    settled: !!price.override,
  }

  if (price.override) {
    drivers.push({ basis: 'Rule', text: `${price.override.by} has already set this night's price.` })
    return base
  }

  const free = pace.sellable - pace.onBooks
  drivers.push({
    basis: 'Rule',
    text: `${pace.onBooks} of ${pace.sellable} rooms sold, ${free} still free, ${pace.daysOut} day${pace.daysOut === 1 ? '' : 's'} out.`,
  })
  if (pace.pickup > 0) {
    drivers.push({ basis: 'Rule', text: `${pace.pickup} room${pace.pickup === 1 ? '' : 's'} picked up in the last week.` })
  }

  // Nearly full beats everything else. The last rooms of a night are the ones worth most.
  if (pace.sellable > 0 && free <= Math.max(1, Math.round(pace.sellable * 0.1))) {
    drivers.push({ basis: 'Rule', text: 'Nearly full. The rooms left are the ones worth most.' })
    return { ...base, direction: 'raise', suggested: tidy(current * (1 + most)) }
  }

  if (pace.verdict === 'too early to say') {
    drivers.push({ basis: 'Rule', text: 'Not enough history yet to say how this night usually fills.' })
    return base
  }

  const normally = Math.round(pace.normalShare * 100)
  if (pace.verdict === 'ahead') {
    drivers.push({
      basis: 'Estimate',
      text: `Ahead of this hotel's usual build-up: ${pace.occupancy}% sold against ${normally}% by this point.`,
    })
    if (pace.forecast !== undefined && pace.forecast >= pace.sellable) {
      drivers.push({ basis: 'Estimate', text: 'On this pace the night fills without help.' })
    }
    return { ...base, direction: 'raise', suggested: tidy(current * (1 + most / 2)) }
  }

  if (pace.verdict === 'behind') {
    drivers.push({
      basis: 'Estimate',
      text: `Behind this hotel's usual build-up: ${pace.occupancy}% sold against ${normally}% by this point.`,
    })
    if (pace.daysOut <= settings.lastMinuteDays) {
      drivers.push({ basis: 'Rule', text: 'Close in. An empty room tonight earns nothing at any price.' })
      return { ...base, direction: 'lower', suggested: tidy(current * (1 - most / 2)) }
    }
    drivers.push({
      basis: 'Rule',
      text: 'Still far off, so there is time. Cutting this early teaches guests to wait for a cut.',
    })
    return base
  }

  drivers.push({ basis: 'Estimate', text: `Filling about as this hotel usually fills by ${pace.daysOut} days out.` })
  return base
}

/** Only the nights worth putting in front of someone: the ones where something is actually suggested. */
export const worthSaying = (list: RateAdvice[]): RateAdvice[] => list.filter((a) => a.direction !== 'hold')

export const DIRECTION_LABEL: Record<Direction, string> = {
  raise: 'Ask more',
  lower: 'Ask less',
  hold: 'Leave it',
}

export const DIRECTION_TONE: Record<Direction, 'good' | 'warn' | 'neutral'> = {
  raise: 'good',
  lower: 'warn',
  hold: 'neutral',
}
