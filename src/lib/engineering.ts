// What engineering is actually asked at the end of a month: what keeps breaking, what each machine has
// cost to keep, and what has been done to it.
//
// Nothing here is new data. It is the register, the repairs, the parts and the downtime read together,
// which is the only place those four meet. Everything is worked out live rather than stored, so a figure
// can never be stale; and the money only counts parts the store actually issued.
// Pure rules only: no React, no state.

import type { Asset } from './assets'
import { bookValue, daysBetween } from './assets'
import type { RoomDefect } from '../features/housekeeping/hkModel'
import type { PlannedJob } from './preventive'
import { partsTotal } from './parts'
import type { Spell } from './downtime'
import { nightsOf } from './downtime'

export type Period = 30 | 90 | 365

export const PERIOD_LABEL: Record<Period, string> = {
  30: 'Last 30 days',
  90: 'Last 90 days',
  365: 'Last year',
}

/** The day a period starts, counted back from today. */
export function startOf(period: Period, today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - period)
  return d.toISOString().slice(0, 10)
}

/** The day a repair was reported, whatever shape it was recorded in. Undefined for the very oldest. */
export function dayOfDefect(defect: RoomDefect): string | undefined {
  return defect.reportedOn ?? defect.reportedIso?.slice(0, 10)
}

export type Repair = { room: string; defect: RoomDefect }

export function repairsIn(repairs: Repair[], from: string): Repair[] {
  return repairs.filter((r) => {
    const day = dayOfDefect(r.defect)
    return day !== undefined && day >= from
  })
}

export function jobsIn(jobs: PlannedJob[], from: string): PlannedJob[] {
  return jobs.filter((j) => (j.doneOn ?? j.raisedOn) >= from)
}

export type AssetCost = {
  asset: Asset
  repairs: number
  services: number
  /** Parts the store issued, on repairs and on services. */
  spent: number
  /** Nights its room could not be sold while it was broken. Only for a machine that lives in a room. */
  nightsLost: number
  worthNow?: number
  /**
   * Spending on a machine as a share of what it is still worth. Over 1 means the hotel has put more
   * into keeping it than it would cost to replace what is left of it.
   */
  share?: number
}

/**
 * What each machine has cost to keep.
 *
 * Only parts the store issued are counted. Labour is not: the hotel pays its technicians whether or not
 * they are at this machine today, so adding an hourly rate would be inventing a number. When payroll is
 * wired up, the hours belong here.
 */
export function costPerAsset(
  assets: Asset[],
  repairs: Repair[],
  jobs: PlannedJob[],
  spells: Spell[],
  checkInTime: string,
  today: string,
  now: number,
): AssetCost[] {
  return assets
    .map((asset) => {
      const mine = repairs.filter((r) => r.defect.assetId === asset.id)
      const myJobs = jobs.filter((j) => j.assetId === asset.id)
      const spent =
        mine.reduce((sum, r) => sum + partsTotal(r.defect.parts), 0) +
        myJobs.reduce((sum, j) => sum + partsTotal(j.parts), 0)
      const nightsLost = asset.room
        ? spells
            .filter((s) => s.room === asset.room)
            .reduce((n, s) => n + nightsOf(s, checkInTime, now).length, 0)
        : 0
      const worthNow = bookValue(asset, today)
      return {
        asset,
        repairs: mine.length,
        services: myJobs.filter((j) => j.status === 'Done').length,
        spent,
        nightsLost,
        worthNow,
        share: worthNow && worthNow > 0 ? spent / worthNow : undefined,
      }
    })
    .sort((a, b) => b.spent - a.spent || b.repairs - a.repairs)
}

/** Spending past this share of what a machine is still worth is worth a second look. */
export const HEAVY_SHARE = 0.25

export type Recurring = {
  where: string
  category: string
  times: number
  lastOn?: string
  /** Set when every one of them named the same machine. */
  assetId?: string
}

/** Three of the same fault in the same place is a pattern, not bad luck. */
export const REPEAT_AT = 3

/**
 * The same fault, in the same place, again.
 *
 * Grouped by place and kind rather than by machine, because the thing that keeps failing often has no
 * asset number: a window, a door, a drain. A room with three plumbing faults in a quarter has a problem
 * that fixing the tap a fourth time will not solve.
 */
export function recurring(repairs: Repair[]): Recurring[] {
  const groups = new Map<string, Repair[]>()
  for (const r of repairs) {
    const key = `${r.room}|${r.defect.category}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const out: Recurring[] = []
  for (const [key, list] of groups) {
    if (list.length < REPEAT_AT) continue
    const [where, category] = key.split('|')
    const ids = new Set(list.map((r) => r.defect.assetId).filter(Boolean))
    const days = list.map((r) => dayOfDefect(r.defect)).filter(Boolean) as string[]
    out.push({
      where,
      category,
      times: list.length,
      lastOn: days.sort().at(-1),
      assetId: ids.size === 1 ? [...ids][0] : undefined,
    })
  }
  return out.sort((a, b) => b.times - a.times || (b.lastOn ?? '').localeCompare(a.lastOn ?? ''))
}

export type WorkKind = 'repair' | 'service'

export type WorkRow = {
  id: string
  kind: WorkKind
  day?: string
  where: string
  what: string
  assetId?: string
  spent: number
  status: string
  /** Days from reported to closed, for a repair that is closed. */
  tookDays?: number
}

/** Repairs and services in one list, because a machine's history is both. */
export function workHistory(repairs: Repair[], jobs: PlannedJob[], assets: Asset[]): WorkRow[] {
  const whereOf = (id?: string) => assets.find((a) => a.id === id)?.where

  const rows: WorkRow[] = repairs.map(({ room, defect }) => {
    const day = dayOfDefect(defect)
    const closed = defect.closedIso?.slice(0, 10)
    return {
      id: `r-${room}-${defect.id}`,
      kind: 'repair',
      day,
      where: `Room ${room}`,
      what: `${defect.category}: ${defect.description}`,
      assetId: defect.assetId,
      spent: partsTotal(defect.parts),
      status: defect.status,
      tookDays: day && closed ? daysBetween(day, closed) : undefined,
    }
  })

  for (const job of jobs) {
    rows.push({
      id: `s-${job.id}`,
      kind: 'service',
      day: job.doneOn ?? job.raisedOn,
      where: whereOf(job.assetId) ?? '—',
      what: job.name,
      assetId: job.assetId,
      spent: partsTotal(job.parts),
      status: job.status,
    })
  }

  return rows.sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''))
}

/**
 * Parts spent on work that named no machine.
 *
 * A manager must be able to add up the per-machine table and reach the total. Without this line they
 * cannot: most faults are reported against a room, not against an asset number, and the money would
 * simply be missing from the list while still counting in the total.
 */
export function unattributed(rows: WorkRow[]): number {
  return rows.filter((r) => !r.assetId).reduce((n, r) => n + r.spent, 0)
}

export function engineeringTotals(rows: WorkRow[], costs: AssetCost[]) {
  const repairs = rows.filter((r) => r.kind === 'repair')
  const closed = repairs.filter((r) => r.tookDays !== undefined)
  return {
    repairs: repairs.length,
    services: rows.filter((r) => r.kind === 'service').length,
    spent: rows.reduce((n, r) => n + r.spent, 0),
    /** Average days from reported to closed. Undefined while nothing has been closed. */
    averageDays: closed.length ? closed.reduce((n, r) => n + (r.tookDays ?? 0), 0) / closed.length : undefined,
    heavy: costs.filter((c) => (c.share ?? 0) > HEAVY_SHARE).length,
  }
}
