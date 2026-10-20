// Rules for the working side of the hotel: when a shift starts and ends, what makes a roster unsafe,
// how a day's clock-in and clock-out become hours, and when an overdue task goes up a level.
// Pure functions only: no React, no state. The mock service and the pages both use them.

import type {
  AttendanceEvent,
  RosterShift,
  ShiftTemplate,
  Timesheet,
  WorkTask,
  EscalationRule,
} from '../services/workforce/workforceTypes'

const HOUR = 3600000
const DAY = 24 * HOUR

/** Minutes after the start before a clock-in counts as late. */
export const LATE_GRACE_MIN = 10
/** Fewer hours than this between two shifts is too little rest. */
export const MIN_REST_HOURS = 11
/** More rostered hours than this in one week is overtime. */
export const WEEK_HOURS_LIMIT = 48
/** Minutes past the shift's paid hours before the extra counts as overtime. */
export const OVERTIME_FROM_MIN = 15
/** Hours after the start with no clock-in before the person is counted absent. */
export const ABSENT_AFTER_HOURS = 2

export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDaysYmd(s: string, n: number): string {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** The Monday of the week a day falls in. */
export function weekStart(s: string): string {
  const d = parseYmd(s)
  const back = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - back)
  return ymd(d)
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i))
}

/** The calendar month a day falls in, as the pay period. */
export function monthPeriod(s: string): { start: string; end: string } {
  const d = parseYmd(s)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: ymd(start), end: ymd(end) }
}

export function previousPeriod(p: { start: string }): { start: string; end: string } {
  return monthPeriod(addDaysYmd(p.start, -1))
}

function at(dateYmd: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseYmd(dateYmd)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** Start and end of a shift in milliseconds. A shift that ends before it starts ends the next day. */
export function shiftWindow(template: Pick<ShiftTemplate, 'startTime' | 'endTime'>, workDate: string): { start: number; end: number } {
  const start = at(workDate, template.startTime)
  let end = at(workDate, template.endTime)
  if (end <= start) end += DAY
  return { start, end }
}

export function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const round2 = (n: number) => Math.round(n * 100) / 100
const quarter = (n: number) => Math.round(n * 4) / 4

export type RosterWarning = { kind: 'clash' | 'rest' | 'overtime' | 'run'; text: string }

/**
 * What is wrong with one person's week. Keyed by shift id: a clash (two shifts at once), too little
 * rest after the previous shift, more than the weekly hours, or a seventh day in a row.
 * `shifts` is everything for this person around the week, so rest across the week boundary counts.
 */
export function rosterWarnings(
  shifts: RosterShift[],
  templates: ShiftTemplate[],
  week: string[],
): Map<string, RosterWarning[]> {
  const tpl = new Map(templates.map((t) => [t.id, t]))
  const out = new Map<string, RosterWarning[]>()
  const add = (id: string, w: RosterWarning) => out.set(id, [...(out.get(id) ?? []), w])
  const timed = shifts
    .map((s) => ({ s, t: tpl.get(s.shiftTemplateId) }))
    .filter((x): x is { s: RosterShift; t: ShiftTemplate } => !!x.t)
    .map((x) => ({ ...x, w: shiftWindow(x.t, x.s.workDate) }))
    .sort((a, b) => a.w.start - b.w.start)

  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1]
    const cur = timed[i]
    const gap = (cur.w.start - prev.w.end) / HOUR
    if (gap < 0) {
      add(cur.s.id, { kind: 'clash', text: `Overlaps the ${prev.t.name.toLowerCase()} shift` })
      add(prev.s.id, { kind: 'clash', text: `Overlaps the ${cur.t.name.toLowerCase()} shift` })
    } else if (gap < MIN_REST_HOURS) {
      add(cur.s.id, { kind: 'rest', text: `Only ${Math.round(gap)} h rest after the last shift` })
    }
  }

  const inWeek = timed.filter((x) => week.includes(x.s.workDate))
  const hours = inWeek.reduce((n, x) => n + x.t.paidHours, 0)
  if (hours > WEEK_HOURS_LIMIT) {
    const last = inWeek[inWeek.length - 1]
    if (last) add(last.s.id, { kind: 'overtime', text: `${hours} h this week, over ${WEEK_HOURS_LIMIT} h` })
  }

  const days = new Set(timed.map((x) => x.s.workDate))
  for (const x of inWeek) {
    let run = 1
    while (days.has(addDaysYmd(x.s.workDate, -run))) run += 1
    if (run >= 7) add(x.s.id, { kind: 'run', text: `${run}th day in a row` })
  }
  return out
}

export type DayState = 'off' | 'not-started' | 'due' | 'late-missing' | 'on-duty' | 'late' | 'done' | 'absent' | 'leave' | 'sick'

export type DayAttendance = {
  state: DayState
  inAt?: number
  outAt?: number
  lateMin: number
  workedHours: number
  overtimeHours: number
  scheduledHours: number
  corrected: boolean
}

/**
 * One person's day. Corrections win over clock events of the same kind; a recorded absence wins over
 * everything. With no clock-in two hours after the start, the person counts as absent.
 */
export function dayAttendance(
  shift: RosterShift | undefined,
  template: ShiftTemplate | undefined,
  events: AttendanceEvent[],
  now: number,
): DayAttendance {
  const base = { lateMin: 0, workedHours: 0, overtimeHours: 0, scheduledHours: template?.paidHours ?? 0, corrected: false }
  const absence = [...events].reverse().find((e) => e.absence)
  if (absence?.absence === 'leave') return { ...base, state: 'leave', corrected: true }
  if (absence?.absence === 'sick') return { ...base, state: 'sick', corrected: true }
  if (absence?.absence === 'unexplained') return { ...base, state: 'absent', corrected: true }

  const pick = (kind: 'in' | 'out') => {
    const list = events.filter((e) => e.kind === kind && !e.absence)
    const fixed = list.filter((e) => e.source === 'correction')
    const use = fixed.length ? fixed : list
    if (!use.length) return undefined
    const times = use.map((e) => Date.parse(e.at))
    return { at: kind === 'in' ? Math.min(...times) : Math.max(...times), corrected: fixed.length > 0 }
  }
  const inE = pick('in')
  const outE = pick('out')
  const corrected = !!(inE?.corrected || outE?.corrected)

  if (!shift || !template) {
    if (!inE) return { ...base, state: 'off' }
  }
  const win = template && shift ? shiftWindow(template, shift.workDate) : undefined
  const lateMin = win && inE ? Math.max(0, Math.round((inE.at - win.start) / 60000)) : 0
  const isLate = lateMin > LATE_GRACE_MIN

  if (!inE) {
    if (!win) return { ...base, state: 'off' }
    if (now < win.start - 30 * 60000) return { ...base, state: 'not-started' }
    if (now < win.start + LATE_GRACE_MIN * 60000) return { ...base, state: 'due' }
    if (now < win.start + ABSENT_AFTER_HOURS * HOUR) return { ...base, state: 'late-missing' }
    return { ...base, state: 'absent' }
  }

  const end = outE?.at
  const worked = end !== undefined ? Math.max(0, (end - inE.at) / HOUR) : Math.max(0, (now - inE.at) / HOUR)
  // A shift's paid hours leave out the unpaid break on a long day.
  const unpaid = template && win ? Math.max(0, (win.end - win.start) / HOUR - template.paidHours) : 0
  const paidWorked = end !== undefined ? Math.max(0, worked - unpaid) : worked
  const extra = paidWorked - (template?.paidHours ?? 0)
  const overtime = end !== undefined && extra * 60 > OVERTIME_FROM_MIN ? quarter(extra) : 0
  return {
    ...base,
    state: end === undefined ? (isLate ? 'late' : 'on-duty') : 'done',
    inAt: inE.at,
    outAt: end,
    lateMin,
    workedHours: end !== undefined ? quarter(Math.min(paidWorked, (template?.paidHours ?? paidWorked) + overtime)) : round2(paidWorked),
    overtimeHours: overtime,
    corrected,
  }
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  off: 'Off',
  'not-started': 'Later',
  due: 'Due now',
  'late-missing': 'Not in yet',
  'on-duty': 'On duty',
  late: 'Late, on duty',
  done: 'Finished',
  absent: 'Absent',
  leave: 'On leave',
  sick: 'Sick',
}

export const DAY_STATE_TONE: Record<DayState, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  off: 'neutral',
  'not-started': 'neutral',
  due: 'info',
  'late-missing': 'warn',
  'on-duty': 'good',
  late: 'warn',
  done: 'neutral',
  absent: 'bad',
  leave: 'info',
  sick: 'info',
}

/** One person's totals for a pay period, from their roster and clock events up to now. */
export function buildTimesheet(
  propertyId: string,
  userId: string,
  period: { start: string; end: string },
  shifts: RosterShift[],
  templates: ShiftTemplate[],
  events: AttendanceEvent[],
  now: number,
): Omit<Timesheet, 'id' | 'status' | 'approvedAt' | 'approvedBy'> {
  const tpl = new Map(templates.map((t) => [t.id, t]))
  const mine = shifts.filter((s) => s.userId === userId && s.status === 'published' && s.workDate >= period.start && s.workDate <= period.end)
  let scheduledHours = 0
  let workedHours = 0
  let overtimeHours = 0
  let nightHours = 0
  let lateCount = 0
  let absentDays = 0
  for (const s of mine) {
    const t = tpl.get(s.shiftTemplateId)
    if (!t) continue
    scheduledHours += t.paidHours
    const day = dayAttendance(s, t, events.filter((e) => e.userId === userId && e.workDate === s.workDate), now)
    if (day.state === 'absent') absentDays += 1
    if (day.lateMin > LATE_GRACE_MIN) lateCount += 1
    if (day.state === 'done') {
      workedHours += day.workedHours - day.overtimeHours
      overtimeHours += day.overtimeHours
      if (t.code === 'night') nightHours += day.workedHours
    }
  }
  return {
    propertyId,
    userId,
    periodStart: period.start,
    periodEnd: period.end,
    scheduledShifts: mine.length,
    scheduledHours,
    workedHours: round2(workedHours),
    overtimeHours: round2(overtimeHours),
    nightHours: round2(nightHours),
    lateCount,
    absentDays,
  }
}

/**
 * The level an unfinished task should be at. Past its due time it goes to the department head; past
 * the due time by the hotel's multiple (from the SLA settings) it goes to the general manager too.
 */
export function escalationStep(task: Pick<WorkTask, 'status' | 'createdAt' | 'dueAt'>, rule: EscalationRule, now: number): 0 | 1 | 2 {
  if (!rule.on || task.status === 'done') return 0
  const created = Date.parse(task.createdAt)
  const due = Date.parse(task.dueAt)
  if (now <= due) return 0
  const second = created + (due - created) * rule.secondStepAt
  return now > second ? 2 : 1
}

/** When the task crossed a level, for the escalation record. */
export function escalationTime(task: Pick<WorkTask, 'createdAt' | 'dueAt'>, level: 1 | 2, rule: EscalationRule): number {
  const created = Date.parse(task.createdAt)
  const due = Date.parse(task.dueAt)
  return level === 1 ? due : created + (due - created) * rule.secondStepAt
}

export const ESCALATION_LABEL: Record<0 | 1 | 2, string> = {
  0: 'On time',
  1: 'Department head',
  2: 'General manager',
}
