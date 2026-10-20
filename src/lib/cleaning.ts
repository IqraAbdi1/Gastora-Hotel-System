// Housekeeping is not one job. A room a guest has left, a room a guest is still in, a corridor and a
// yearly deep clean are different work with different checks, and the hotel sets its own rules for each.
// Pure rules only: no React, no state.

/** How often a public area is cleaned. */
export type AreaFrequency = 'twice' | 'daily' | 'weekly'

export interface CleaningArea {
  id: string
  name: string
  /** Where it is, in the hotel's own words. Shown to the attendant so she can find it. */
  where: string
  frequency: AreaFrequency
  /** Weekly areas only: 0 is Sunday. */
  weekday?: number
}

export const AREA_FREQUENCY_LABEL: Record<AreaFrequency, string> = {
  twice: 'Twice a day',
  daily: 'Every day',
  weekly: 'Once a week',
}

/** A hotel starts with these and edits them. Most hotels clean more than their rooms. */
export const DEFAULT_AREAS: CleaningArea[] = [
  { id: 'a-lobby', name: 'Lobby and reception', where: 'Ground floor', frequency: 'twice' },
  { id: 'a-corridor-1', name: 'Corridor, first floor', where: 'Floor 1', frequency: 'daily' },
  { id: 'a-corridor-2', name: 'Corridor, second floor', where: 'Floor 2', frequency: 'daily' },
  { id: 'a-toilets', name: 'Public toilets', where: 'Ground floor', frequency: 'twice' },
  { id: 'a-restaurant', name: 'Restaurant', where: 'Ground floor', frequency: 'daily' },
  { id: 'a-pool', name: 'Pool and deck', where: 'Outside', frequency: 'daily' },
  { id: 'a-carpark', name: 'Car park', where: 'Outside', frequency: 'weekly', weekday: 1 },
]

/** The times of day an area is due. Twice-daily areas are done in the morning and again in the afternoon. */
export const AREA_TIMES: Record<AreaFrequency, string[]> = {
  twice: ['09:00', '15:00'],
  daily: ['10:00'],
  weekly: ['10:00'],
}

export interface ServiceRules {
  /** On a stayover, sheets are changed every this many nights. Towels are changed when the guest asks. */
  linenDays: number
  /** After this many days running with no service, a supervisor must enter the room. */
  dndEscalateDays: number
}

export const DEFAULT_SERVICE: ServiceRules = { linenDays: 3, dndEscalateDays: 2 }

/** What the attendant is expected to do, by kind of work. She taps these; anything else she types. */
export const CHECKLIST: Record<string, string[]> = {
  'Departure Clean': [
    'Bed stripped and remade',
    'Bathroom cleaned',
    'Floor cleaned',
    'Bin emptied',
    'Towels replaced',
    'Amenities restocked',
    'Minibar checked',
    'Surfaces wiped',
  ],
  'Stay Over': ['Bed made', 'Towels replaced', 'Bin emptied', 'Bathroom wiped', 'Amenities topped up', 'Floor swept'],
  'Deep Clean': ['Mattress turned', 'Curtains cleaned', 'Behind the furniture', 'Air vents', 'Upholstery', 'Windows'],
  'Arrival Preparation': ['Final check', 'Amenities set', 'Water placed', 'Air conditioning set'],
  Turndown: ['Bed turned down', 'Curtains closed', 'Fresh water', 'Bin emptied'],
  'Public Area': ['Floor mopped', 'Bins emptied', 'Surfaces wiped', 'Glass and mirrors', 'Litter removed', 'Toilets cleaned'],
  Inspection: [],
}

/** Everything the type-ahead can offer: the standard items for this work, plus whatever the hotel has added. */
export function checklistChoices(type: string, extras: string[] = []): string[] {
  const standard = CHECKLIST[type] ?? []
  const seen = new Set(standard.map((s) => s.toLowerCase()))
  return [...standard, ...extras.filter((e) => !seen.has(e.toLowerCase()))]
}

/** What a type-ahead shows after the first couple of letters. */
export function matchChoices(choices: string[], query: string, chosen: string[] = []): string[] {
  const q = query.trim().toLowerCase()
  const taken = new Set(chosen.map((c) => c.toLowerCase()))
  const left = choices.filter((c) => !taken.has(c.toLowerCase()))
  if (!q) return left
  const starts = left.filter((c) => c.toLowerCase().startsWith(q))
  const within = left.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q))
  return [...starts, ...within]
}

/**
 * The least time this work can honestly take. Faster than this is not proof of anything, but it is
 * worth a supervisor's eye: a departure clean in three minutes did not happen.
 */
export const MIN_MINUTES: Record<string, number> = {
  'Departure Clean': 12,
  'Stay Over': 5,
  'Deep Clean': 25,
  'Arrival Preparation': 2,
  Turndown: 2,
  'Public Area': 5,
  Inspection: 1,
}

export function tooQuick(type: string, minutes: number): boolean {
  const least = MIN_MINUTES[type] ?? 5
  return minutes >= 0 && minutes < least
}

/** Minutes between two times written as HH:MM. Negative when the clock has passed midnight. */
export function minutesBetween(start: string, end: string): number {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  return parse(end) - parse(start)
}

/** Nights the guest has been in the room by this date. */
export function nightsSoFar(arrival: string, day: string): number {
  const from = Date.parse(`${arrival}T00:00:00`)
  const to = Date.parse(`${day}T00:00:00`)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.max(0, Math.round((to - from) / 86400000))
}

/** Sheets are not changed every day. They are due on the first night and then every linenDays after it. */
export function linenDue(arrival: string, day: string, rules: ServiceRules): boolean {
  const nights = nightsSoFar(arrival, day)
  if (nights <= 0) return true
  const every = Math.max(1, rules.linenDays)
  return nights % every === 0
}

/** Days running, up to and including today, that service was refused. */
export function declinedRun(days: string[], today: string): number {
  const set = new Set(days)
  let run = 0
  let cursor = Date.parse(`${today}T00:00:00`)
  if (Number.isNaN(cursor)) return 0
  const key = (ms: number) => {
    const d = new Date(ms)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  while (set.has(key(cursor))) {
    run += 1
    cursor -= 86400000
  }
  return run
}

/**
 * A room nobody has entered for days is not a cleaning problem, it is a welfare one: no member of staff
 * has seen that guest. Hotels send a supervisor in.
 */
export function needsWelfareCheck(days: string[], today: string, rules: ServiceRules): boolean {
  return declinedRun(days, today) >= Math.max(1, rules.dndEscalateDays)
}

export function newAreaId(areas: CleaningArea[]): string {
  let n = areas.length + 1
  while (areas.some((a) => a.id === `a-${n}`)) n += 1
  return `a-${n}`
}

/** Whether an area is due on this date. */
export function areaDueOn(area: CleaningArea, day: string): boolean {
  if (area.frequency !== 'weekly') return true
  const date = new Date(`${day}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false
  return date.getDay() === (area.weekday ?? 1)
}

/**
 * How long each kind of work usually takes, in minutes, for a standard room. Used to share the day's work
 * out evenly, so a departure clean counts for two stayovers rather than one. Sample figures, set once for
 * every hotel; a hotel's own timings from its cleaning record would be better and can replace them later.
 */
export const TASK_MINUTES: Record<string, number> = {
  'Departure Clean': 30,
  'Stay Over': 15,
  'Deep Clean': 90,
  'Arrival Preparation': 10,
  Turndown: 8,
  'Public Area': 25,
  Inspection: 10,
}

/** A bigger room takes longer. Matches the average clean times the front desk estimate uses (30, 40, 60). */
export const ROOM_SIZE_FACTOR: Record<string, number> = { Standard: 1, Deluxe: 4 / 3, Suite: 2 }

/** Minutes this piece of work should take. Sheets on a stayover add a few minutes. Never less than the honest minimum. */
export function taskMinutes(type: string, roomType?: string, linen = false): number {
  const base = TASK_MINUTES[type] ?? 20
  // Size only matters for work inside the room. A corridor has no room type, and an inspection is a look.
  const sized = type === 'Public Area' || type === 'Inspection' ? base : base * (ROOM_SIZE_FACTOR[roomType ?? ''] ?? 1)
  const minutes = Math.round(sized + (linen ? 5 : 0))
  return Math.max(minutes, MIN_MINUTES[type] ?? 1)
}
