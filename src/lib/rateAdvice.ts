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
// There is a third kind, and it is labelled as its own thing: a demand event the hotel entered itself -
// a conference, a holiday, a match (see demandEvents.ts). That is neither counted nor projected. It is
// what somebody at the hotel said, so it says Your input, and the suggestion moves because of it only
// as far as the same ceiling allows every other suggestion to move.
//
// Pure rules only: no React.

import { effectPercent, eventsOn, nightsCovered } from './demandEvents'
import type { DemandEvent } from './demandEvents'
import type { NightPace } from './pace'
import type { NightPrice } from './rateCalendar'
import type { Room } from '../types'

export type Basis = 'Rule' | 'Estimate' | 'Your input'

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
  /** The hotel's own events on this night, which moved the suggestion. */
  events?: DemandEvent[]
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
 *   - Then, last, a night the hotel has marked with an event moves up or down by what the hotel said
 *     to expect, within the same ceiling. Pace alone can only see a conference once guests have booked
 *     for it; the hotel usually knows sooner.
 */
export function adviseNight(
  pace: NightPace,
  price: NightPrice,
  type: Room['type'],
  settings: AdviceSettings = DEFAULT_ADVICE,
  /** The hotel's demand events. Left out, the advice reads pace alone, as it always has. */
  events: DemandEvent[] = [],
): RateAdvice {
  const fromPace = paceAdvice(pace, price, type, settings)
  const on = eventsOn(events, pace.date, type)
  if (on.length === 0) return fromPace

  const drivers = [...fromPace.drivers]
  for (const e of on) {
    const p = effectPercent(e)
    const n = nightsCovered(e)
    drivers.push({
      basis: 'Your input',
      text: `Event: ${e.name}, ${n} night${n === 1 ? '' : 's'}. Entered by the hotel, not measured: ${
        p > 0 ? `expect more demand, +${p}%` : p < 0 ? `expect less demand, −${Math.abs(p)}%` : 'no change expected'
      }.${e.note ? ` (${e.note})` : ''}`,
    })
  }
  if (fromPace.settled) return { ...fromPace, drivers, events: on }

  // Two events on one night do not stack: the strongest one speaks, for the same reason two day rules
  // never stack in the calendar. Then the usual ceiling applies to the whole suggestion.
  const strongest = on.reduce((a, b) => (Math.abs(effectPercent(b)) > Math.abs(effectPercent(a)) ? b : a))
  const most = Math.max(1, settings.mostPercent) / 100
  const current = fromPace.current
  const wanted = fromPace.suggested * (1 + effectPercent(strongest) / 100)
  const suggested = tidy(Math.min(current * (1 + most), Math.max(current * (1 - most), wanted)))
  if (on.length > 1) drivers.push({ basis: 'Rule', text: `Only the strongest event counts: ${strongest.name}.` })
  if (Math.abs(wanted - suggested) >= 100) {
    drivers.push({ basis: 'Rule', text: `Held to ${settings.mostPercent}%, the most a suggestion may move a price in one go.` })
  }
  const direction: Direction = suggested > current ? 'raise' : suggested < current ? 'lower' : 'hold'
  return { ...fromPace, drivers, suggested, direction, events: on }
}

function paceAdvice(
  pace: NightPace,
  price: NightPrice,
  type: Room['type'],
  settings: AdviceSettings,
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
