// How long a repair may take before somebody more senior is told.
//
// The hotel already showed response targets as words on a screen ("within 2 hours"), which nothing ever
// checked. A target nobody measures is a decoration. This measures two separate clocks, because they
// fail for different reasons and different people fix them:
//
//   - the answer: how long before anybody picked the job up at all. Late means nobody is looking.
//   - the fix:    how long before it was closed. Late means it is harder than it looked, or stuck.
//
// The fix clock stops while a part is waiting for the store. A technician who cannot get the part is
// not a technician who is ignoring the job, and an escalation that cannot tell the difference teaches
// people to ignore escalations.
// Pure rules only: no React, no state.

import type { Priority } from '../features/housekeeping/hkModel'

export type SlaTarget = {
  /** Hours to pick the job up. */
  answerHours: number
  /** Hours to close it. */
  fixHours: number
}

export type SlaSettings = {
  targets: Record<Priority, SlaTarget>
  /** Past the fix target by this many times over, it goes up again, to the manager. */
  secondStepAt: number
  on: boolean
}

export const DEFAULT_SLA: SlaSettings = {
  targets: {
    Urgent: { answerHours: 1, fixHours: 4 },
    High: { answerHours: 4, fixHours: 24 },
    Normal: { answerHours: 24, fixHours: 72 },
  },
  secondStepAt: 2,
  on: true,
}

export type ClockState = 'in time' | 'close' | 'late' | 'met' | 'on hold' | 'unknown'

export const CLOCK_TONE = {
  'in time': 'neutral',
  close: 'warn',
  late: 'bad',
  met: 'good',
  'on hold': 'info',
  unknown: 'neutral',
} as const

export type Clock = {
  state: ClockState
  /** Hours left before the target. Negative means it is past. */
  hoursLeft?: number
  /** Hours the work took, once it is finished. */
  tookHours?: number
}

/** Close enough to the target to be worth a glance: the last fifth of the time allowed. */
const CLOSE_FRACTION = 0.2

const HOUR = 3600000

export function hoursBetween(fromIso: string, toMs: number): number | undefined {
  const from = Date.parse(fromIso)
  if (Number.isNaN(from)) return undefined
  return (toMs - from) / HOUR
}

/**
 * One clock.
 *
 * `doneIso` set means the work happened: the clock is judged on what it took, not on what is left.
 * `onHold` stops an unfinished clock where it is, and says so, rather than letting it run red while
 * everyone waits on a supplier.
 */
export function clockOf(
  startIso: string | undefined,
  doneIso: string | undefined,
  targetHours: number,
  now: number,
  onHold = false,
): Clock {
  if (!startIso) return { state: 'unknown' }
  if (doneIso) {
    const took = hoursBetween(startIso, Date.parse(doneIso))
    if (took === undefined) return { state: 'unknown' }
    return { state: took <= targetHours ? 'met' : 'late', tookHours: took, hoursLeft: targetHours - took }
  }
  const gone = hoursBetween(startIso, now)
  if (gone === undefined) return { state: 'unknown' }
  const left = targetHours - gone
  if (onHold) return { state: 'on hold', hoursLeft: left }
  if (left < 0) return { state: 'late', hoursLeft: left }
  return { state: left <= targetHours * CLOSE_FRACTION ? 'close' : 'in time', hoursLeft: left }
}

export function hoursWords(hours: number | undefined): string {
  if (hours === undefined) return '—'
  const h = Math.abs(hours)
  if (h < 1) return `${Math.round(h * 60)} min`
  // A whole number of hours is written as one: "4 h", not "4.0 h".
  if (h < 48) return `${Number.isInteger(h) || h >= 10 ? Math.round(h) : h.toFixed(1)} h`
  return `${Math.round(h / 24)} days`
}

export function clockWords(clock: Clock): string {
  if (clock.state === 'unknown') return 'No time on record'
  if (clock.state === 'met') return `Done in ${hoursWords(clock.tookHours)}`
  if (clock.state === 'late' && clock.tookHours !== undefined) {
    return `Took ${hoursWords(clock.tookHours)}, ${hoursWords(clock.hoursLeft)} over`
  }
  if (clock.state === 'late') return `${hoursWords(clock.hoursLeft)} over`
  if (clock.state === 'on hold') return 'Waiting for a part'
  return `${hoursWords(clock.hoursLeft)} left`
}

/** Who the job goes up to. Nobody is told twice about the same step. */
export type Step = 0 | 1 | 2

export const STEP_TO: Record<Step, string> = {
  0: '',
  1: 'Maintenance supervisor',
  2: 'General manager',
}

export type Sla = {
  answer: Clock
  fix: Clock
  /** 0 nobody, 1 the supervisor, 2 the manager as well. */
  step: Step
  /** Why it went up, in one line a manager can read without opening anything. */
  why?: string
  onHold: boolean
}

/**
 * Where a repair stands against its targets.
 *
 * It goes up one step when either clock is past its target, and a second step when the fix target has
 * been passed by the multiple the hotel set. A job on hold never goes up: the clock it would be judged
 * on is not running.
 */
export function slaOf(
  input: {
    priority: Priority
    reportedIso?: string
    startedIso?: string
    closedIso?: string
    waitingOnPart?: boolean
  },
  settings: SlaSettings,
  now: number,
): Sla {
  const target = settings.targets[input.priority]
  const onHold = !!input.waitingOnPart && !input.closedIso
  const answer = clockOf(input.reportedIso, input.startedIso ?? input.closedIso, target.answerHours, now)
  const fix = clockOf(input.reportedIso, input.closedIso, target.fixHours, now, onHold)

  if (input.closedIso || onHold) {
    return { answer, fix, step: 0, onHold }
  }

  const gone = input.reportedIso ? hoursBetween(input.reportedIso, now) : undefined
  if (gone === undefined) return { answer, fix, step: 0, onHold }

  if (gone > target.fixHours * settings.secondStepAt) {
    return {
      answer,
      fix,
      step: 2,
      why: `Still open ${hoursWords(gone)} after it was reported, against a ${hoursWords(target.fixHours)} target.`,
      onHold,
    }
  }
  if (gone > target.fixHours) {
    return { answer, fix, step: 1, why: `Past the ${hoursWords(target.fixHours)} target to fix it.`, onHold }
  }
  if (answer.state === 'late') {
    return { answer, fix, step: 1, why: `Nobody has picked it up, ${hoursWords(answer.hoursLeft)} past the answer target.`, onHold }
  }
  return { answer, fix, step: 0, onHold }
}
