// Demand events: the things the hotel knows about that its own booking history does not.
//
// Pace reads how a night is filling against the way this hotel usually fills. It cannot know that a
// regional summit has taken every conference room in Kampala for three nights, that Independence Day
// falls on a Friday this year, or that the schools have broken up. The hotel can. This is the list where
// it says so: a name, the nights, which way it expects demand to go, and where it heard.
//
// Honesty about what this is. An event is the hotel's own input, not a measurement and not a forecast:
// nothing here checks whether the summit is real or how many delegates are coming. Rate suggestions
// that use an event say so in those words, so a manager reading the suggestion knows the number moved
// because somebody at the hotel told it to, and can ask who. Nothing here changes a price either. An
// event only makes the suggestion for that night ask for more or less; a person still approves it.
//
// Pure rules only: no React.

import type { Room } from '../types'

/** Which way the hotel expects the night to go. 'percent' is the hotel naming its own figure. */
export type EventEffect = 'high' | 'some' | 'low' | 'percent'

export const EFFECT_LABEL: Record<EventEffect, string> = {
  high: 'High demand',
  some: 'Some demand',
  low: 'Low demand',
  percent: 'A figure of my own',
}

/**
 * What each word means as a move on the suggested price. Deliberately modest: a suggestion that leapt
 * 40% because someone ticked "high" would be the system inventing a number the hotel never gave it.
 */
export const EFFECT_PERCENT: Record<Exclude<EventEffect, 'percent'>, number> = {
  high: 15,
  some: 7,
  low: -10,
}

export interface DemandEvent {
  id: string
  name: string
  /** First and last night affected, both included. */
  from: string
  to: string
  effect: EventEffect
  /** Only for 'percent': how far the hotel expects the night's price to move. Negative lowers. */
  percent?: number
  /** Only these room types. Empty or left out means every type. */
  types?: Room['type'][]
  /** Where the hotel heard, or anything the next manager should know. */
  note?: string
}

/** The move an event asks for, as a percentage. */
export const effectPercent = (e: DemandEvent): number =>
  e.effect === 'percent' ? (e.percent ?? 0) : EFFECT_PERCENT[e.effect]

export const covers = (e: DemandEvent, date: string, type?: Room['type']): boolean =>
  date >= e.from && date <= e.to && (!type || !e.types || e.types.length === 0 || e.types.includes(type))

/** Every event on a night, for one room type or for the house. */
export const eventsOn = (list: DemandEvent[] | undefined, date: string, type?: Room['type']): DemandEvent[] =>
  (list ?? []).filter((e) => covers(e, date, type))

/** Nights an event covers, counting both ends. */
export const nightsCovered = (e: DemandEvent): number =>
  Math.max(1, Math.round((Date.parse(`${e.to}T00:00:00Z`) - Date.parse(`${e.from}T00:00:00Z`)) / 86400000) + 1)

/** "high demand, +15%" - the effect in the words a manager would say. */
export function describeEffect(e: DemandEvent): string {
  const p = effectPercent(e)
  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  const word = e.effect === 'percent' ? 'the hotel’s own figure' : EFFECT_LABEL[e.effect].toLowerCase()
  return `${word}, ${sign}${Math.abs(p)}%`
}

export const effectTone = (e: DemandEvent): 'good' | 'warn' | 'neutral' => {
  const p = effectPercent(e)
  return p > 0 ? 'good' : p < 0 ? 'warn' : 'neutral'
}

/** Events still to come or running, soonest first. Past events are kept but sorted to the end. */
export function sortEvents(list: DemandEvent[], today: string): DemandEvent[] {
  return [...list].sort((a, b) => {
    const pa = a.to < today ? 1 : 0
    const pb = b.to < today ? 1 : 0
    return pa - pb || a.from.localeCompare(b.from)
  })
}

export function newEventId(list: DemandEvent[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `event-${n}`)) n += 1
  return `event-${n}`
}
