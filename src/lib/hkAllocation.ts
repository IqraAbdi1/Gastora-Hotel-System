// Sharing the day's cleaning out by zone and by workload. Each attendant on today's roster has a zone (a
// floor, or a part of the hotel such as "Ground floor" or "Outside") and a shift. The rule keeps each person
// in as few zones as possible, so nobody pushes a trolley up and down the building, and evens out the
// minutes rather than the number of rooms: a departure clean of a suite is not the same job as a stayover.
// Each person's list then starts with the rooms a guest is arriving into and anything urgent.
//
// Honest limits: the minutes are typical figures (see TASK_MINUTES in cleaning.ts), not this hotel's own
// timings; walking time between zones is not measured, only avoided; and the split is a sensible proposal
// worked out by rules, not the best possible one. The supervisor sees it before anything changes.
// Pure rules only: no React.
import { taskMinutes } from './cleaning'

export type Shift = 'morning' | 'afternoon' | 'off'

export const SHIFT_LABEL: Record<Shift, string> = {
  morning: 'Morning, 07:00 to 15:00',
  afternoon: 'Afternoon, 14:00 to 22:00',
  off: 'Not on today',
}

/** Eight hours on the floor, less an hour for breaks and loading the trolley. */
export const SHIFT_MINUTES = 420

/** One attendant on today's roster. */
export interface RosterEntry {
  name: string
  zone: string
  shift: Shift
}

/** A piece of work as the rule sees it. Kept apart from the screen's own task type on purpose. */
export interface WorkItem {
  id: number
  /** A room number, or the name of a public area. */
  place: string
  type: string
  /** Standard, Deluxe, Suite. Empty for a public area. */
  roomType?: string
  zone: string
  priority: 'Urgent' | 'High' | 'Normal'
  status: string
  attendant: string
  dueTime: string
  /** A guest is due into this room today. */
  arrivingToday: boolean
  /** Stayover with the sheets due. A few minutes more. */
  linen?: boolean
}

export interface PlannedItem {
  item: WorkItem
  minutes: number
  /** Already started. It stays with whoever started it, whatever the plan says. */
  locked: boolean
  /** Set when the plan gives this work to someone new: who had it before ('Unassigned' if nobody). */
  from?: string
}

export interface PersonPlan {
  name: string
  zone: string
  shift: Shift
  /** In the order she should do them. */
  items: PlannedItem[]
  minutes: number
  capacity: number
  /** Every zone her list takes her to, her own first. */
  zones: string[]
}

export interface AllocationPlan {
  people: PersonPlan[]
  /** Work nobody on the roster could take, because nobody is on. */
  unplaced: WorkItem[]
  /** How many pieces of work change hands if the plan is applied. */
  changes: number
}

export interface AllocateOptions {
  /** Also share out again work already given to someone but not started yet. */
  reshare?: boolean
  /** Only place these tasks; everything else is left where it is. Used for "assign new tasks automatically". */
  only?: Set<number>
}

const isOpen = (status: string) => status !== 'Completed' && status !== 'Cancelled'

const ACTIVE_RANK: Record<WorkItem['priority'], number> = { Urgent: 0, High: 1, Normal: 2 }

/** A spread smaller than this is even enough: moving a room to save ten minutes is not worth the confusion. */
const EVEN_ENOUGH = 20
/** Sending someone into a zone she was not working in is only worth it for a real imbalance. */
const NEW_ZONE_WORTH = 60

/** Whether work due at this time falls inside the shift. Work with no time fits anyone. */
export function fitsShift(dueTime: string, shift: Shift): boolean {
  if (shift === 'off') return false
  if (!dueTime) return true
  return shift === 'morning' ? dueTime <= '15:00' : dueTime >= '14:00'
}

/** The minutes a piece of work is counted at. Work already under way is counted at half. */
export function itemMinutes(item: WorkItem): number {
  const full = taskMinutes(item.type, item.roomType, item.linen)
  return item.status === 'In Progress' ? Math.ceil(full / 2) : full
}

/** How urgent, for ordering a list: a guest arriving or an urgent task first, then high, then the rest. */
export function urgencyRank(item: Pick<WorkItem, 'priority' | 'arrivingToday'>): number {
  if (item.arrivingToday || item.priority === 'Urgent') return 0
  return item.priority === 'High' ? 1 : 2
}

/** Room numbers in number order (102 before 1001), names after them in alphabetical order. */
function placeCompare(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
  if (Number.isNaN(na) !== Number.isNaN(nb)) return Number.isNaN(na) ? 1 : -1
  return a.localeCompare(b)
}

/**
 * The order one person should work in: what she has started, then rooms with a guest arriving and urgent
 * work, then high priority, then the rest. Inside each of those she finishes her own zone before moving,
 * by due time and then by room number, so she walks the corridor once.
 */
export function orderList(items: PlannedItem[], homeZone: string): PlannedItem[] {
  return items.slice().sort((a, b) => {
    const started = Number(b.item.status === 'In Progress') - Number(a.item.status === 'In Progress')
    if (started) return started
    const rank = urgencyRank(a.item) - urgencyRank(b.item)
    if (rank) return rank
    const home = Number(b.item.zone === homeZone) - Number(a.item.zone === homeZone)
    if (home) return home
    return (
      a.item.zone.localeCompare(b.item.zone) ||
      a.item.dueTime.localeCompare(b.item.dueTime) ||
      placeCompare(a.item.place, b.item.place)
    )
  })
}

type Person = { entry: RosterEntry; items: PlannedItem[]; load: number }

const zonesOf = (p: Person) => new Set(p.items.map((x) => x.item.zone))

/** The least loaded of these people, preferring those whose shift covers the work. */
function lightest(people: Person[], item: WorkItem): Person | undefined {
  const fit = people.filter((p) => fitsShift(item.dueTime, p.entry.shift))
  const pool = fit.length ? fit : people
  return pool.slice().sort((a, b) => a.load - b.load || a.entry.name.localeCompare(b.entry.name))[0]
}

export function allocate(work: WorkItem[], roster: RosterEntry[], options: AllocateOptions = {}): AllocationPlan {
  const seen = new Set<string>()
  const on = roster.filter((r) => {
    if (r.shift === 'off' || seen.has(r.name)) return false
    seen.add(r.name)
    return true
  })
  const people: Person[] = on.map((entry) => ({ entry, items: [], load: 0 }))
  const byName = new Map(people.map((p) => [p.entry.name, p]))
  const give = (p: Person, item: WorkItem, locked: boolean) => {
    const minutes = itemMinutes(item)
    p.items.push({ item, minutes, locked, from: item.attendant === p.entry.name ? undefined : item.attendant || 'Unassigned' })
    p.load += minutes
  }

  // What stays where it is, and what is free to be placed.
  const movable: WorkItem[] = []
  for (const item of work) {
    if (!isOpen(item.status)) continue
    const holder = byName.get(item.attendant)
    if (item.status === 'In Progress') {
      // Never taken off the person who started it. Work started by someone not on the roster is left alone.
      if (holder) give(holder, item, true)
      continue
    }
    const inScope = !options.only || options.only.has(item.id)
    const free =
      inScope &&
      (item.status === 'Unassigned' ||
        !item.attendant ||
        item.attendant === 'Unassigned' ||
        // Given to someone who is not on today: it would never be done.
        !holder ||
        !!options.reshare)
    if (free) movable.push(item)
    else if (holder) give(holder, item, false)
  }

  if (people.length === 0) {
    return { people: [], unplaced: movable, changes: 0 }
  }

  // Biggest jobs first, so the small ones can even things out at the end.
  movable.sort((a, b) => itemMinutes(b) - itemMinutes(a) || placeCompare(a.place, b.place))

  const total = people.reduce((s, p) => s + p.load, 0) + movable.reduce((s, i) => s + itemMinutes(i), 0)
  const target = total / people.length

  // First: work in a zone that has someone of its own goes to them, if they are on when it is due.
  // A pool due at ten is not left for the afternoon shift.
  const orphans: WorkItem[] = []
  for (const item of movable) {
    const home = people.filter((p) => p.entry.zone === item.zone && fitsShift(item.dueTime, p.entry.shift))
    const p = home.length ? lightest(home, item) : undefined
    if (p) give(p, item, false)
    else orphans.push(item)
  }

  // Then: zones nobody is assigned to, kept together. The first person to take one keeps taking from it
  // until she is at her fair share, and only then does someone else join her there.
  const byZone = new Map<string, WorkItem[]>()
  for (const item of orphans) byZone.set(item.zone, [...(byZone.get(item.zone) ?? []), item])
  const zoneOrder = [...byZone.entries()].sort(
    (a, b) => b[1].reduce((s, i) => s + itemMinutes(i), 0) - a[1].reduce((s, i) => s + itemMinutes(i), 0),
  )
  for (const [zone, items] of zoneOrder) {
    for (const item of items) {
      const m = itemMinutes(item)
      const holders = people.filter((p) => zonesOf(p).has(zone) && fitsShift(item.dueTime, p.entry.shift))
      const holder = lightest(holders, item)
      if (holder && holder.load + m <= target + EVEN_ENOUGH) give(holder, item, false)
      else give(lightest(people, item) as Person, item, false)
    }
  }

  // Last: even out. Move one piece of work at a time from the busiest person to the least busy, preferring
  // work in a zone the other person is already in. Started work and work outside the scope never move.
  for (let round = 0; round < 200; round++) {
    const sorted = people.slice().sort((a, b) => b.load - a.load)
    const most = sorted[0]
    const least = sorted[sorted.length - 1]
    const gap = most.load - least.load
    if (most === least || gap <= EVEN_ENOUGH) break
    const leastZones = zonesOf(least)
    const candidates = most.items
      .filter((x) => !x.locked && movable.includes(x.item) && x.minutes < gap)
      .filter((x) => fitsShift(x.item.dueTime, least.entry.shift))
      .filter((x) => leastZones.has(x.item.zone) || x.item.zone === least.entry.zone || gap > NEW_ZONE_WORTH)
      .map((x) => {
        const shared = leastZones.has(x.item.zone) || x.item.zone === least.entry.zone ? 0 : 1
        // Taking her out of a zone that is not her own is a bonus.
        const leavesZone =
          x.item.zone !== most.entry.zone && most.items.filter((y) => y.item.zone === x.item.zone).length === 1 ? 0 : 1
        return { x, score: shared * 1000 + leavesZone * 100 + Math.abs(gap / 2 - x.minutes) }
      })
      .sort((a, b) => a.score - b.score)
    const pick = candidates[0]?.x
    if (!pick) break
    most.items = most.items.filter((x) => x !== pick)
    most.load -= pick.minutes
    give(least, pick.item, false)
  }

  let changes = 0
  const plans: PersonPlan[] = people.map((p) => {
    const items = orderList(p.items, p.entry.zone)
    for (const x of items) if (x.from !== undefined) changes++
    const zones = [...new Set(items.map((x) => x.item.zone))].sort(
      (a, b) => Number(b === p.entry.zone) - Number(a === p.entry.zone) || a.localeCompare(b),
    )
    return { name: p.entry.name, zone: p.entry.zone, shift: p.entry.shift, items, minutes: p.load, capacity: SHIFT_MINUTES, zones }
  })
  return { people: plans, unplaced: [], changes }
}

/**
 * The order an attendant's own list is shown in. Urgent work always rises to the top, even work raised
 * after the plan was made (a front desk rush); otherwise the order the plan gave, then the old rule.
 */
export function byWorkOrder(
  a: { priority: WorkItem['priority']; order?: number; dueTime: string },
  b: { priority: WorkItem['priority']; order?: number; dueTime: string },
): number {
  const urgent = Number(b.priority === 'Urgent') - Number(a.priority === 'Urgent')
  if (urgent) return urgent
  const ao = a.order ?? Number.MAX_SAFE_INTEGER
  const bo = b.order ?? Number.MAX_SAFE_INTEGER
  if (ao !== bo) return ao - bo
  return ACTIVE_RANK[a.priority] - ACTIVE_RANK[b.priority] || a.dueTime.localeCompare(b.dueTime)
}

/** "1 h 25 min", "40 min". */
export function hoursAndMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return `${rest} min`
  return rest ? `${h} h ${rest} min` : `${h} h`
}
