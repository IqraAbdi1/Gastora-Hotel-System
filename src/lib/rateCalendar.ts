// What a room costs on a given night, as opposed to what it costs in general.
//
// A hotel with one price per room type all year is a hotel leaving money on the table in December and
// empty in April. This is the calendar underneath that: the published rate is still the base, and the
// calendar moves it.
//
// Two layers, in this order, because that is the order a hotelier says them in:
//
//   1. A SEASON covers a stretch of dates and decides what the room costs then. The first season that
//      covers the night wins, so a hotel can set a December rate and then set a higher one for the three
//      nights of Christmas by putting those above it.
//   2. A DAY-OF-WEEK rule then moves whatever the season decided, up for a Friday, down for a Sunday.
//      The first matching rule wins. Day rules never stack with each other, for the same reason a
//      company may only have one discount: two of them applied together is a number nobody can explain
//      to a guest.
//   3. An OCCUPANCY step then moves it again, once the house is filling. This is the one layer that
//      depends on something other than the calendar - how much of the hotel is already sold that night -
//      so the caller hands it in. A hotel that does not price on occupancy passes nothing and nothing
//      changes.
//
// Above all three sits one more thing, and it is not a rule: an OVERRIDE, a price a person set for one
// date and one room type. It wins outright. A manager who has decided what Saturday costs is not
// arguing with a percentage, and the night records who decided and when.
//
// Occupancy is the whole house, not the room type. A hotelier raises the Deluxe rate because the hotel
// is filling, not because four Deluxes went: the guest who cannot find a Standard is the one who ends up
// paying for a Deluxe.
//
// Every price this file works out comes with the steps that made it, because a rate nobody can explain
// is a rate the front desk will not defend when a guest argues.
//
// Pure rules only: no React.

import type { Room } from '../types'

export type Move = 'set' | 'percent' | 'amount'

export const MOVE_LABEL: Record<Move, string> = {
  set: 'Set the rate to',
  percent: 'Change by percent',
  amount: 'Change by amount',
}

interface Moves {
  id: string
  name: string
  /** One room type, or every type when left out. */
  type?: Room['type']
  how: Move
  /** A price for 'set', a percentage for 'percent' (negative lowers), an amount for 'amount'. */
  value: number
  on: boolean
}

/** A stretch of dates with its own price. Inclusive of both ends, counted on the night. */
export interface RateSeason extends Moves {
  from: string
  to: string
}

/** Days of the week that cost more or less than the rest. 0 is Sunday. */
export interface DayRate extends Moves {
  days: number[]
}

/** One date's price, set by a person. Not a rule: it beats every rule, and it is signed. */
export interface RateOverride {
  id: string
  date: string
  type: Room['type']
  rate: number
  by: string
  at: string
  /** Why, in the words shown when it was approved. */
  note?: string
}

/** A step that applies once the house is at least this full for that night. */
export interface OccupancyRate extends Moves {
  /** Percent of the sellable rooms already sold, 0 to 100. */
  atLeast: number
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const dayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay()

export const nextDay = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

/** Prices are rounded to the hundred, so nothing in this system quotes a figure with loose shillings. */
const tidy = (n: number) => Math.max(0, Math.round(n / 100) * 100)

function applyMove(base: number, m: Moves): number {
  if (m.how === 'set') return tidy(m.value)
  if (m.how === 'percent') return tidy(base * (1 + m.value / 100))
  return tidy(base + m.value)
}

/** What a move did, in the words the front desk would use. */
export function describeMove(m: Moves): string {
  if (m.how === 'set') return `set to UGX ${m.value.toLocaleString('en-US')}`
  if (m.how === 'percent') return `${m.value > 0 ? '+' : ''}${m.value}%`
  return `${m.value > 0 ? '+' : '−'} UGX ${Math.abs(m.value).toLocaleString('en-US')}`
}

const covers = (m: Moves, type: Room['type']) => m.on && (!m.type || m.type === type)

export interface NightStep {
  label: string
  rate: number
}

export interface NightPrice {
  date: string
  rate: number
  /** The base, then whatever moved it. The last step's rate is the price charged. */
  steps: NightStep[]
  season?: RateSeason
  dayRate?: DayRate
  occupancyRate?: OccupancyRate
  /** How full the house was when this price was worked out, where that was known. */
  sold?: number
  override?: RateOverride
}

export interface RateCalendar {
  roomRates: Record<Room['type'], number>
  seasons: RateSeason[]
  dayRates: DayRate[]
  occupancyRates: OccupancyRate[]
  overrides: RateOverride[]
}

/** How full the house is on a given night, as a percentage. Nothing known means no occupancy step. */
export type SoldOn = (date: string) => number | undefined

/** The room price for one night, with the reasoning kept. The meal plan is added by the caller. */
export function priceNight(type: Room['type'], date: string, c: RateCalendar, soldOn?: SoldOn): NightPrice {
  const base = c.roomRates[type] ?? 0
  const steps: NightStep[] = [{ label: 'Published rate', rate: base }]
  let rate = base

  const season = (c.seasons ?? []).find((s) => covers(s, type) && date >= s.from && date <= s.to)
  if (season) {
    rate = applyMove(rate, season)
    steps.push({ label: `${season.name} (${describeMove(season)})`, rate })
  }

  const day = dayOf(date)
  const dayRate = (c.dayRates ?? []).find((d) => covers(d, type) && d.days.includes(day))
  if (dayRate) {
    rate = applyMove(rate, dayRate)
    steps.push({ label: `${dayRate.name} (${describeMove(dayRate)})`, rate })
  }

  // Last, and only when the caller knows how full the house is. The steps are ordered highest first,
  // so a hotel can set 90% above 70% and have the higher one win.
  const sold = soldOn?.(date)
  let occupancyRate: OccupancyRate | undefined
  if (sold !== undefined) {
    occupancyRate = [...(c.occupancyRates ?? [])]
      .filter((o) => covers(o, type))
      .sort((a, b) => b.atLeast - a.atLeast)
      .find((o) => sold >= o.atLeast)
    if (occupancyRate) {
      rate = applyMove(rate, occupancyRate)
      steps.push({ label: `${occupancyRate.name} (${Math.round(sold)}% sold, ${describeMove(occupancyRate)})`, rate })
    }
  }

  // A person's decision, last and absolute.
  const override = (c.overrides ?? []).find((o) => o.date === date && o.type === type)
  if (override) {
    rate = tidy(override.rate)
    steps.push({ label: `Set by ${override.by}`, rate })
  }

  return { date, rate, steps, season, dayRate, occupancyRate, sold, override }
}

/** Every night of a stay. Arrival counts, the departure day does not: nobody sleeps on it. */
export function priceNights(
  type: Room['type'],
  arrival: string,
  departure: string,
  c: RateCalendar,
  soldOn?: SoldOn,
): NightPrice[] {
  const out: NightPrice[] = []
  for (let d = arrival; d < departure; d = nextDay(d)) {
    out.push(priceNight(type, d, c, soldOn))
    if (out.length > 370) break
  }
  return out
}

/** What the room alone comes to over the stay, before any meal plan or discount. */
export const roomTotalFor = (
  type: Room['type'],
  arrival: string,
  departure: string,
  c: RateCalendar,
  soldOn?: SoldOn,
): number => priceNights(type, arrival, departure, c, soldOn).reduce((n, p) => n + p.rate, 0)

/**
 * The average night of a stay, which is what goes on screen when one number has to stand for the whole
 * stay. It is an average, not the price of any particular night, and anywhere it is shown the nights
 * themselves are one click away.
 */
export function averageNightly(
  type: Room['type'],
  arrival: string,
  departure: string,
  c: RateCalendar,
  soldOn?: SoldOn,
): number {
  const nights = priceNights(type, arrival, departure, c, soldOn)
  if (nights.length === 0) return c.roomRates[type] ?? 0
  return Math.round(nights.reduce((n, p) => n + p.rate, 0) / nights.length)
}

/** Whether the calendar changes anything at all, so screens can stay quiet in a hotel that has no seasons. */
export const calendarInUse = (c: RateCalendar): boolean =>
  (c.seasons ?? []).some((s) => s.on) ||
  (c.dayRates ?? []).some((d) => d.on) ||
  (c.occupancyRates ?? []).some((o) => o.on)

/** True when the nights of a stay are not all the same price, which is when a breakdown is worth showing. */
export function varies(nights: NightPrice[]): boolean {
  return nights.length > 1 && nights.some((n) => n.rate !== nights[0].rate)
}

export function newSeasonId(list: RateSeason[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `season-${n}`)) n += 1
  return `season-${n}`
}

export function newDayRateId(list: DayRate[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `day-${n}`)) n += 1
  return `day-${n}`
}

export function newOverrideId(list: RateOverride[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `set-${n}`)) n += 1
  return `set-${n}`
}

export function newOccupancyRateId(list: OccupancyRate[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `busy-${n}`)) n += 1
  return `busy-${n}`
}
