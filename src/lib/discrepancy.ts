// The floor and the system disagreeing about a room, found on purpose rather than by accident.
//
// Every hotel runs this walk: somebody goes down the corridor and writes what is actually in each room,
// and it is compared with what the front desk believes. The two faults it finds cost real money. A
// sleeper is somebody in a room nobody sold. A skip is a room the system still believes is occupied
// after the guest has gone, which holds a sellable room off the market and delays the cleaning.
//
// The walk never changes a booking by itself. A room found occupied that the system says is empty might
// be a guest the desk moved and nobody wrote down; only a person can tell. So a difference is raised as
// a disagreement for the desk and housekeeping to settle, which is exactly what the room's Discrepancy
// status already means.
// Pure rules only: no React, no state.

/** What the person on the floor saw. */
export type Found = 'occupied' | 'vacant' | 'not checked'

export type SweepRoom = {
  room: string
  found: Found
  /** Vacant rooms only: it still needs cleaning. */
  dirty?: boolean
  note?: string
  /**
   * What the system believed at the moment this room was written down.
   *
   * Kept rather than looked up later, because a finished walk is a record of a disagreement on a day.
   * Read against today's bookings instead, last week's walk would quietly change its mind every time
   * somebody opened it: the guest has checked out since, so the skip it found would disappear.
   */
  expected?: Expected
}

export type Sweep = {
  id: string
  /** The day the walk belongs to. */
  day: string
  startedIso: string
  finishedIso?: string
  by: string
  rooms: SweepRoom[]
}

export const newSweepId = () => `S-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

export type Kind = 'agreed' | 'sleeper' | 'skip' | 'status' | 'not checked'

export const KIND_LABEL: Record<Kind, string> = {
  agreed: 'Agrees',
  sleeper: 'Sleeper',
  skip: 'Skip',
  status: 'Wrong status',
  'not checked': 'Not checked',
}

export const KIND_TONE = {
  agreed: 'good',
  sleeper: 'bad',
  skip: 'warn',
  status: 'info',
  'not checked': 'neutral',
} as const

export const KIND_NOTE: Record<Kind, string> = {
  agreed: 'The floor and the system say the same thing.',
  sleeper: 'Somebody is in a room the system says is empty. Nobody is being charged for it.',
  skip: 'The system still has a guest in a room the floor found empty. The room cannot be sold and will not be cleaned.',
  status: 'The room is empty as expected, but it is dirty and the system calls it ready to sell.',
  'not checked': 'Nobody got into this room.',
}

export type Finding = {
  room: string
  kind: Kind
  /** What the system believes. */
  expected: 'occupied' | 'vacant'
  expectedReady?: boolean
  found: Found
  foundDirty?: boolean
  note?: string
  /** The booking the system has in this room, when there is one. */
  stayId?: string
  guest?: string
}

export type Expected = {
  occupied: boolean
  /** Vacant and believed clean or inspected: sellable this minute. */
  ready: boolean
  stayId?: string
  guest?: string
}

/**
 * What one room says.
 *
 * A room nobody could get into is not a disagreement: a locked door with the chain on tells you
 * nothing, and counting it as a fault would bury the real ones.
 */
export function findingOf(entry: SweepRoom, expected: Expected): Finding {
  const base = {
    room: entry.room,
    expected: (expected.occupied ? 'occupied' : 'vacant') as 'occupied' | 'vacant',
    expectedReady: expected.ready,
    found: entry.found,
    foundDirty: entry.dirty,
    note: entry.note,
    stayId: expected.stayId,
    guest: expected.guest,
  }
  if (entry.found === 'not checked') return { ...base, kind: 'not checked' }
  if (entry.found === 'occupied' && !expected.occupied) return { ...base, kind: 'sleeper' }
  if (entry.found === 'vacant' && expected.occupied) return { ...base, kind: 'skip' }
  if (entry.found === 'vacant' && entry.dirty && expected.ready) return { ...base, kind: 'status' }
  return { ...base, kind: 'agreed' }
}

/**
 * A walk still running is compared with what the system says now; a finished one with what it said at
 * the time, which is the only honest way to read it afterwards.
 */
export function findingsOf(sweep: Sweep, expectedFor: (room: string) => Expected): Finding[] {
  return sweep.rooms.map((entry) => findingOf(entry, entry.expected ?? expectedFor(entry.room)))
}

/** Only what somebody has to do something about. */
export const problems = (findings: Finding[]) => findings.filter((f) => f.kind === 'sleeper' || f.kind === 'skip' || f.kind === 'status')

export function sweepSummary(findings: Finding[]) {
  const count = (kind: Kind) => findings.filter((f) => f.kind === kind).length
  return {
    checked: findings.filter((f) => f.found !== 'not checked').length,
    rooms: findings.length,
    sleepers: count('sleeper'),
    skips: count('skip'),
    status: count('status'),
    agreed: count('agreed'),
    missed: count('not checked'),
  }
}

/** How far through the walk somebody is. */
export const sweepProgress = (sweep: Sweep) => ({
  done: sweep.rooms.filter((r) => r.found !== 'not checked').length,
  total: sweep.rooms.length,
})

export function sweepWords(summary: ReturnType<typeof sweepSummary>): string {
  const bits: string[] = []
  if (summary.sleepers > 0) bits.push(`${summary.sleepers} sleeper${summary.sleepers === 1 ? '' : 's'}`)
  if (summary.skips > 0) bits.push(`${summary.skips} skip${summary.skips === 1 ? '' : 's'}`)
  if (summary.status > 0) bits.push(`${summary.status} with the wrong status`)
  if (bits.length === 0) return 'Everything agreed'
  return bits.join(', ')
}
