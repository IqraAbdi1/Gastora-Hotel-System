// Servicing a machine before it fails, instead of after.
//
// A repair is work that chose you. A service is work you chose. They are kept apart on purpose: if a
// planned service were filed as a fault, every machine on a service contract would look like a machine
// that keeps breaking, and "what keeps failing" - the question engineering actually asks - would be wrong.
// Pure rules only: no React, no state.

import { daysBetween, latestReading, usePerDay } from './assets'
import type { Asset } from './assets'

/** How often the work comes round: by the calendar, or by how hard the machine has worked. */
export type Every =
  | { kind: 'days'; n: number }
  | { kind: 'months'; n: number }
  | { kind: 'meter'; n: number }

export type ServicePlan = {
  id: string
  assetId: string
  /** What is to be done, in the words the technician will read. */
  name: string
  every: Every
  /** Put the job on the list this many days before it falls due, so somebody can plan it. */
  leadDays: number
  lastDoneOn?: string
  /** The dial reading when it was last serviced. Meter plans count from here. */
  lastDoneAt?: number
  note?: string
  active: boolean
}

export type JobStatus = 'Open' | 'In progress' | 'Done'

export type PlannedJob = {
  id: string
  planId: string
  assetId: string
  name: string
  /** The day it falls due. Raised earlier than this by the plan's lead days. */
  dueOn: string
  raisedOn: string
  status: JobStatus
  technician?: string
  doneOn?: string
  doneAtReading?: number
  note?: string
}

export const EVERY_KIND_LABEL = { days: 'days', months: 'months', meter: 'running' } as const

export const newPlanId = () => `P-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
export const newJobId = () => `J-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Months are added by name, not by 30 days: a boiler serviced on the 31st of January is next due at the
 * end of February, not on the 2nd of March. A day that does not exist in the next month falls back to
 * the last day of it.
 */
export function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastOfMonth))
  return d.toISOString().slice(0, 10)
}

export function everyWords(every: Every, unit: string | undefined): string {
  if (every.kind === 'days') return `Every ${every.n} day${every.n === 1 ? '' : 's'}`
  if (every.kind === 'months') return `Every ${every.n} month${every.n === 1 ? '' : 's'}`
  return `Every ${every.n.toLocaleString('en-US')} ${unit ?? 'hours'}`
}

export type DueState = 'not due' | 'due soon' | 'due' | 'overdue'

export const DUE_TONE = { 'not due': 'neutral', 'due soon': 'info', due: 'warn', overdue: 'bad' } as const

export type Due = {
  state: DueState
  /** The day it falls due. For a meter plan this is worked out from how hard the machine works. */
  on?: string
  /** Days from today. Negative means it should already have been done. */
  inDays?: number
  /** Meter plans: the reading it falls due at, and how far off that is. */
  atReading?: number
  readingsToGo?: number
  /** True when the date is worked out from use rather than read off a calendar. */
  estimated: boolean
  /** Why it cannot be judged, when it cannot. */
  unknown?: string
}

/**
 * When this work is next due.
 *
 * A calendar plan counts from the last service; with none on record it counts from the day the machine
 * was bought, and from today only when even that is unknown - never silently from today, because that
 * would make a machine nobody has ever serviced look like one serviced this morning.
 *
 * A meter plan counts from the dial. Its date is an estimate built from the readings on record, and is
 * marked as one; with fewer than two readings there is no rate to work from and it says so.
 */
export function dueOf(plan: ServicePlan, asset: Asset, today: string): Due {
  if (plan.every.kind === 'meter') {
    const last = latestReading(asset)
    if (!last) {
      return { state: 'not due', estimated: true, unknown: 'No reading has been taken yet.' }
    }
    const from = plan.lastDoneAt ?? 0
    const atReading = from + plan.every.n
    const readingsToGo = atReading - last.reading
    const rate = usePerDay(asset)
    if (readingsToGo <= 0) return { state: 'overdue', atReading, readingsToGo, estimated: true }
    if (rate === undefined || rate <= 0) {
      return {
        state: 'not due',
        atReading,
        readingsToGo,
        estimated: true,
        unknown: 'Two readings are needed before a date can be worked out.',
      }
    }
    const daysOff = Math.round(readingsToGo / rate)
    return {
      state: daysOff <= plan.leadDays ? 'due soon' : 'not due',
      on: addDays(last.takenOn, daysOff),
      inDays: daysOff,
      atReading,
      readingsToGo,
      estimated: true,
    }
  }

  const from = plan.lastDoneOn ?? asset.boughtOn
  if (!from) {
    return {
      state: 'due',
      estimated: false,
      unknown: 'Neither the last service nor the purchase date is on record, so it is treated as due.',
    }
  }
  const on = plan.every.kind === 'days' ? addDays(from, plan.every.n) : addMonths(from, plan.every.n)
  const inDays = daysBetween(today, on)
  const state: DueState = inDays < 0 ? 'overdue' : inDays === 0 ? 'due' : inDays <= plan.leadDays ? 'due soon' : 'not due'
  return { state, on, inDays, estimated: false }
}

export function dueWords(due: Due, unit?: string): string {
  if (due.unknown) return due.unknown
  // A meter plan that has gone past its number is late by that number, even with no date to show.
  if (due.readingsToGo !== undefined && due.readingsToGo <= 0) {
    return `${Math.abs(due.readingsToGo).toLocaleString('en-US')} ${unit ?? 'hours'} past the service`
  }
  if (due.inDays === undefined) return 'Cannot say yet'
  if (due.inDays < 0) return `${Math.abs(due.inDays)} day${Math.abs(due.inDays) === 1 ? '' : 's'} late`
  if (due.inDays === 0) return 'Due today'
  return `In ${due.inDays} day${due.inDays === 1 ? '' : 's'}`
}

/**
 * Whether the list should carry this job now.
 *
 * Retired equipment is not serviced. A plan that is switched off is not serviced. And a plan already
 * carrying an unfinished job is not raised again, so leaving the app open for a week cannot produce
 * seven identical jobs.
 */
export function shouldRaise(plan: ServicePlan, asset: Asset, jobs: PlannedJob[], today: string): PlannedJob | null {
  if (!plan.active || asset.state !== 'in service') return null
  const due = dueOf(plan, asset, today)
  if (due.state === 'not due') return null
  if (jobs.some((j) => j.planId === plan.id && j.status !== 'Done')) return null
  // A job already done for this round is not raised a second time: the plan moves on when it is done.
  const dueOn = due.on ?? today
  if (jobs.some((j) => j.planId === plan.id && j.dueOn === dueOn)) return null
  return {
    id: newJobId(),
    planId: plan.id,
    assetId: plan.assetId,
    name: plan.name,
    dueOn,
    raisedOn: today,
    status: 'Open',
  }
}

/** The plan after the work is signed off: it counts from what was actually done, not from what was due. */
export function planAfterDone(plan: ServicePlan, doneOn: string, reading?: number): ServicePlan {
  return { ...plan, lastDoneOn: doneOn, lastDoneAt: reading ?? plan.lastDoneAt }
}

export type PlanProblem = 'name' | 'every' | 'meter' | null

export const PLAN_PROBLEM_TEXT: Record<Exclude<PlanProblem, null>, string> = {
  name: 'Say what is to be done.',
  every: 'How often must be a number above zero.',
  meter: 'This machine has no running meter, so it cannot be serviced by one. Give it a meter first, or use the calendar.',
}

export function planProblem(plan: ServicePlan, asset: Asset): PlanProblem {
  if (!plan.name.trim()) return 'name'
  if (!Number.isFinite(plan.every.n) || plan.every.n <= 0) return 'every'
  if (plan.every.kind === 'meter' && !asset.meterUnit) return 'meter'
  return null
}

/**
 * What a hotel would already have written on the wall of the plant room.
 *
 * The last service is set relative to today on purpose. Counting a lift's six-monthly inspection from
 * the day it was bought would say it is five years late, which is true of the rule and useless as a
 * picture of a working hotel.
 */
export function samplePlans(today: string): ServicePlan[] {
  const ago = (days: number) => addDays(today, -days)
  return [
    {
      id: 'P-gen-service',
      assetId: 'A-gen-1',
      name: 'Generator service: oil, filters, belts',
      every: { kind: 'meter', n: 200 },
      leadDays: 7,
      lastDoneAt: 2100,
      lastDoneOn: ago(120),
      note: 'Mantrac service kit. Record the hours on the dial when it is done.',
      active: true,
    },
    {
      id: 'P-lift-inspection',
      assetId: 'A-lift-1',
      name: 'Lift inspection and certificate',
      every: { kind: 'months', n: 6 },
      leadDays: 21,
      lastDoneOn: ago(172),
      note: 'Required by law. The certificate goes in the file at reception.',
      active: true,
    },
    {
      id: 'P-ext-refill',
      assetId: 'A-ext-1',
      name: 'Refill and tag the fire extinguishers',
      every: { kind: 'months', n: 12 },
      leadDays: 30,
      lastDoneOn: ago(350),
      note: 'Required by law.',
      active: true,
    },
    {
      id: 'P-ac-204-clean',
      assetId: 'A-ac-204',
      name: 'Clean the filters and check the gas',
      every: { kind: 'months', n: 3 },
      leadDays: 7,
      lastDoneOn: ago(101),
      active: true,
    },
    {
      id: 'P-boiler-descale',
      assetId: 'A-boiler-1',
      name: 'Descale the boiler and test the pressure valve',
      every: { kind: 'months', n: 6 },
      leadDays: 14,
      lastDoneOn: ago(60),
      active: true,
    },
    {
      id: 'P-washer-service',
      assetId: 'A-washer-1',
      name: 'Washer service: bearings, hoses, drain',
      every: { kind: 'meter', n: 1000 },
      leadDays: 10,
      lastDoneAt: 3000,
      lastDoneOn: ago(200),
      active: true,
    },
  ]
}
