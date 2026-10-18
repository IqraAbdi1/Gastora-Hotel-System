// When a room may be sold, as opposed to what it costs.
//
// A hotel's price list is only half of selling. The other half is refusing: no one-night bookings over
// a festival weekend, no arrivals on the day the conference takes the whole house, nothing at all while
// the wing is being painted. Without these a hotel either sells what it cannot deliver, or takes a
// single night in the middle of a week it could have sold whole.
//
// Each rule covers a stretch of dates and a room type, or every type. They are read in order and the
// first one that refuses wins, so a hotel can close a week and then reopen one day inside it.
//
// Pure rules only: no React.

import type { Room } from '../types'

export type RuleKind = 'min-stay' | 'max-stay' | 'no-arrival' | 'no-departure' | 'stop-sell'

export const RULE_LABEL: Record<RuleKind, string> = {
  'min-stay': 'Minimum stay',
  'max-stay': 'Maximum stay',
  'no-arrival': 'No arrivals',
  'no-departure': 'No departures',
  'stop-sell': 'Not for sale',
}

export const RULE_NOTE: Record<RuleKind, string> = {
  'min-stay': 'A booking that starts in these dates must be at least this many nights.',
  'max-stay':
    'A booking that starts in these dates may be no longer than this. Used to keep a long stay from eating a week the hotel can sell by the night.',
  'no-arrival': 'Nobody may arrive on these dates. A stay already running passes through them.',
  'no-departure':
    'Nobody may leave on these dates, so the room is not emptied into a day the hotel cannot resell. A stay already running passes through them.',
  'stop-sell': 'These dates are not for sale at all, for any length of stay.',
}

/** Rules that count nights, and so need a number beside them. */
export const COUNTS_NIGHTS: RuleKind[] = ['min-stay', 'max-stay']

export interface RateRule {
  id: string
  kind: RuleKind
  /** Empty means every room type. */
  type?: Room['type']
  from: string
  to: string
  /** Empty means every rate plan. A rule may close one plan and leave the others on sale. */
  plan?: string
  /** Minimum- and maximum-stay rules only. */
  nights?: number
  /** Why, in the hotel's own words. The desk sees this when a booking is refused. */
  reason: string
  on: boolean
}

const within = (day: string, from: string, to: string) => day >= from && day <= to

const applies = (rule: RateRule, type: Room['type'], planId?: string) =>
  rule.on && (!rule.type || rule.type === type) && (!rule.plan || !planId || rule.plan === planId)

/** Every night of a stay, the last one excluded: a guest leaving on the 5th did not sleep on the 5th. */
export function nightsOfStay(arrival: string, departure: string): string[] {
  const out: string[] = []
  // Parsed and formatted in UTC throughout. Parsing local midnight and formatting with toISOString
  // reads back the day before anywhere east of Greenwich, and Kampala is three hours east: every
  // closed date and every night of a stay would land one day early.
  let cursor = Date.parse(`${arrival}T00:00:00Z`)
  const end = Date.parse(`${departure}T00:00:00Z`)
  if (Number.isNaN(cursor) || Number.isNaN(end)) return out
  while (cursor < end && out.length < 400) {
    out.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 86400000
  }
  return out
}

export interface Refusal {
  rule: RateRule
  /** What the desk is told, in words a receptionist can repeat to a guest. */
  why: string
}

/**
 * Whether this stay may be sold. Returns nothing when it may: a hotel that explains every acceptance
 * is noise, and one that cannot explain a refusal is worse than useless at the desk.
 */
export function refusedBy(
  rules: RateRule[],
  type: Room['type'],
  arrival: string,
  departure: string,
  /** The rate plan being sold, when a rule may close one plan and leave the others open. */
  planId?: string,
  /** What the hotel calls that plan, for the refusal the desk reads. */
  planName?: string,
): Refusal | undefined {
  const nights = nightsOfStay(arrival, departure)
  if (nights.length === 0) return undefined
  const on = planName ? ` on ${planName}` : ''

  for (const rule of rules) {
    if (!applies(rule, type, planId)) continue

    if (rule.kind === 'stop-sell' && nights.some((n) => within(n, rule.from, rule.to))) {
      return {
        rule,
        why: `${type} rooms${rule.plan ? on : ''} are not for sale from ${rule.from} to ${rule.to}. ${rule.reason}`.trim(),
      }
    }
    if (rule.kind === 'no-arrival' && within(arrival, rule.from, rule.to)) {
      return { rule, why: `Nobody may arrive on ${arrival}${rule.plan ? on : ''}. ${rule.reason}`.trim() }
    }
    // The departure day itself, not a night: a guest leaving on the 5th is a departure on the 5th.
    if (rule.kind === 'no-departure' && within(departure, rule.from, rule.to)) {
      return { rule, why: `Nobody may leave on ${departure}${rule.plan ? on : ''}. ${rule.reason}`.trim() }
    }
    if (rule.kind === 'min-stay' && within(arrival, rule.from, rule.to)) {
      const least = Math.max(1, rule.nights ?? 1)
      if (nights.length < least) {
        return {
          rule,
          why: `Arriving between ${rule.from} and ${rule.to}${rule.plan ? on : ''} needs at least ${least} night${least === 1 ? '' : 's'}; this is ${nights.length}. ${rule.reason}`.trim(),
        }
      }
    }
    if (rule.kind === 'max-stay' && within(arrival, rule.from, rule.to)) {
      const most = Math.max(1, rule.nights ?? 1)
      if (nights.length > most) {
        return {
          rule,
          why: `Arriving between ${rule.from} and ${rule.to}${rule.plan ? on : ''} may be no more than ${most} night${most === 1 ? '' : 's'}; this is ${nights.length}. ${rule.reason}`.trim(),
        }
      }
    }
  }
  return undefined
}

/** Rules touching a stretch of days, for showing the hotel what it has closed. */
export const rulesOver = (rules: RateRule[], from: string, to: string): RateRule[] =>
  rules.filter((r) => r.on && !(r.to < from || r.from > to))

export function newRuleId(rules: RateRule[]): string {
  let n = rules.length + 1
  while (rules.some((r) => r.id === `RR-${n}`)) n += 1
  return `RR-${n}`
}
