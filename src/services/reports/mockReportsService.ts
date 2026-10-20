import type { Actor } from '../types'
import type { ReportsService } from './reportsService'
import type {
  AssistantQuestion,
  CostProfile,
  DailyKpi,
  DepartmentKpi,
  NewReportDefinition,
  ReportDefinition,
  ReportExport,
  ReportSchedule,
  SampleSale,
} from './reportsTypes'
import { BUILT_IN_REPORTS, DATASET_COLUMNS } from './reportCatalog'

// In-memory reports store for the prototype. Saved reports, schedules, exports and questions last until
// the page is reloaded. The daily figures of sister hotels, budgets, costs and the sample till history
// are worked out from a fixed seed, so every reload shows the same numbers.

type Profile = { rooms: number; occupancy: number; adr: number; fnbPerGuest: number; otherPerGuest: number }

const PROFILES: Record<string, Profile> = {
  t1: { rooms: 120, occupancy: 0.68, adr: 245000, fnbPerGuest: 82000, otherPerGuest: 28000 },
  t3: { rooms: 45, occupancy: 0.57, adr: 168000, fnbPerGuest: 46000, otherPerGuest: 14000 },
  t2: { rooms: 18, occupancy: 0.52, adr: 98000, fnbPerGuest: 21000, otherPerGuest: 6000 },
}
const DEFAULT_PROFILE: Profile = { rooms: 30, occupancy: 0.55, adr: 140000, fnbPerGuest: 35000, otherPerGuest: 10000 }

const COSTS: Record<string, Omit<CostProfile, 'propertyId'>> = {
  t1: { payrollPerRoomDay: 24000, utilitiesPerRoomDay: 8000, costPerOccupiedRoom: 26000, fnbCostPercent: 34, otherCostPercent: 8 },
  t3: { payrollPerRoomDay: 19000, utilitiesPerRoomDay: 6500, costPerOccupiedRoom: 21000, fnbCostPercent: 36, otherCostPercent: 9 },
  t2: { payrollPerRoomDay: 14000, utilitiesPerRoomDay: 5000, costPerOccupiedRoom: 15000, fnbCostPercent: 38, otherCostPercent: 9 },
}
const DEFAULT_COSTS = COSTS.t3

/** A number between 0 and 1 that is always the same for the same text. */
function seeded(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

const addDays = (date: string, by: number) => new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d)
  return out
}

function kpiFor(propertyId: string, day: string, scenario: DailyKpi['scenario']): DailyKpi {
  const p = PROFILES[propertyId] ?? DEFAULT_PROFILE
  const c = COSTS[propertyId] ?? DEFAULT_COSTS
  const date = new Date(`${day}T00:00:00Z`)
  const weekday = date.getUTCDay()
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000)
  const season = 1 + 0.08 * Math.sin((dayOfYear / 365) * 2 * Math.PI)
  const weekend = weekday === 5 || weekday === 6 ? 1.12 : weekday === 0 ? 0.92 : 1
  const noise = scenario === 'budget' ? 1.04 : 0.9 + seeded(`${propertyId}:${day}`) * 0.2
  const occ = Math.min(0.98, p.occupancy * season * weekend * noise)
  const roomsSold = Math.round(p.rooms * occ)
  const rate = p.adr * (scenario === 'budget' ? 1.02 : 0.95 + seeded(`${day}:${propertyId}:r`) * 0.1)
  const roomRevenue = Math.round(roomsSold * rate)
  const fnbRevenue = Math.round(roomsSold * p.fnbPerGuest * (scenario === 'budget' ? 1.05 : 0.85 + seeded(`f${day}${propertyId}`) * 0.3))
  const otherRevenue = Math.round(roomsSold * p.otherPerGuest)
  const totalRevenue = roomRevenue + fnbRevenue + otherRevenue
  const operatingCosts = Math.round(
    p.rooms * (c.payrollPerRoomDay + c.utilitiesPerRoomDay) +
      roomsSold * c.costPerOccupiedRoom +
      (fnbRevenue * c.fnbCostPercent) / 100 +
      (totalRevenue * c.otherCostPercent) / 100,
  )
  return {
    id: `${scenario === 'budget' ? 'B' : 'K'}-${propertyId}-${day}`,
    propertyId,
    businessDate: day,
    scenario,
    roomsAvailable: p.rooms,
    roomsSold,
    roomRevenue,
    fnbRevenue,
    otherRevenue,
    totalRevenue,
    operatingCosts,
    gop: totalRevenue - operatingCosts,
    cancellations: scenario === 'budget' ? 0 : Math.round(seeded(`c${day}${propertyId}`) * p.rooms * 0.04),
    cashCollected: scenario === 'budget' ? totalRevenue : Math.round(totalRevenue * (0.82 + seeded(`m${day}${propertyId}`) * 0.2)),
  }
}

function targetsFor(propertyId: string): DepartmentKpi[] {
  const p = PROFILES[propertyId] ?? DEFAULT_PROFILE
  const row = (department: DepartmentKpi['department'], kpiKey: string, label: string, target: number, unit: DepartmentKpi['unit'], higherIsBetter = true): DepartmentKpi => ({
    id: `DK-${propertyId}-${department}-${kpiKey}`,
    propertyId,
    department,
    kpiKey,
    label,
    target,
    unit,
    higherIsBetter,
  })
  return [
    row('frontOffice', 'occupancy', 'Occupancy', 70, 'percent'),
    row('frontOffice', 'adr', 'Average room rate', Math.round(p.adr / 1000) * 1000, 'ugx'),
    row('fnb', 'avgCheck', 'Average bill', Math.round((p.fnbPerGuest * 0.6) / 1000) * 1000, 'ugx'),
    row('housekeeping', 'readyShare', 'Rooms ready', 85, 'percent'),
    row('maintenance', 'overdue', 'Overdue work orders', 0, 'count', false),
    row('maintenance', 'onTime', 'Closed on time', 90, 'percent'),
    row('sales', 'companyShare', 'Company share of rooms', 25, 'percent'),
    row('procurement', 'openOrders', 'Open purchase orders', 5, 'count', false),
    row('finance', 'debtOver30', 'Debt over 30 days', 0, 'ugx', false),
  ]
}

const MENU: { name: string; price: number; outlet: SampleSale['outlet'] }[] = [
  { name: 'Rolex and tea', price: 12000, outlet: 'Restaurant' },
  { name: 'Grilled tilapia', price: 38000, outlet: 'Restaurant' },
  { name: 'Chicken luwombo', price: 32000, outlet: 'Restaurant' },
  { name: 'Matooke and beef', price: 26000, outlet: 'Restaurant' },
  { name: 'Full breakfast', price: 25000, outlet: 'Restaurant' },
  { name: 'Nile Special', price: 7000, outlet: 'Bar' },
  { name: 'Club Pilsener', price: 7000, outlet: 'Bar' },
  { name: 'Waragi and tonic', price: 9000, outlet: 'Bar' },
  { name: 'Passion juice', price: 6000, outlet: 'Bar' },
  { name: 'House wine (glass)', price: 15000, outlet: 'Bar' },
]
const PAYMENTS: SampleSale['payment'][] = ['Cash', 'Mobile money', 'Mobile money', 'Card', 'Room charge']

function sampleSales(propertyId: string, today: string): SampleSale[] {
  const out: SampleSale[] = []
  for (let back = 59; back >= 0; back--) {
    const day = addDays(today, -back)
    const count = 2 + Math.floor(seeded(`${propertyId}${day}n`) * 3)
    for (let i = 0; i < count; i++) {
      const s = seeded(`${propertyId}${day}${i}`)
      const outlet: SampleSale['outlet'] = s < 0.55 ? 'Restaurant' : 'Bar'
      const choices = MENU.filter((m) => m.outlet === outlet)
      const lines = 1 + Math.floor(seeded(`${day}${i}l`) * 3)
      const items = Array.from({ length: lines }, (_, j) => {
        const m = choices[Math.floor(seeded(`${day}${i}${j}m`) * choices.length)]
        return { name: m.name, qty: 1 + Math.floor(seeded(`${day}${i}${j}q`) * 2), price: m.price }
      })
      const hour = String(8 + Math.floor(seeded(`${day}${i}h`) * 14)).padStart(2, '0')
      out.push({
        id: `SS-${day.replace(/-/g, '')}-${i + 1}`,
        createdAt: `${day}T${hour}:${String(Math.floor(s * 59)).padStart(2, '0')}:00`,
        outlet,
        payment: PAYMENTS[Math.floor(seeded(`${day}${i}p`) * PAYMENTS.length)],
        total: items.reduce((n, x) => n + x.qty * x.price, 0),
        items,
      })
    }
  }
  return out
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** When a schedule next goes out, on the hotel's own clock, after `from`. */
export function nextRun(s: Pick<ReportSchedule, 'frequency' | 'weekday' | 'monthDay' | 'sendAt'>, from: Date): string {
  const [h, m] = s.sendAt.split(':').map((x) => parseInt(x, 10))
  const d = new Date(from)
  d.setSeconds(0, 0)
  d.setHours(h || 0, m || 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`
  for (let i = 0; i < 400; i++) {
    const ok =
      d > from &&
      (s.frequency === 'daily' || (s.frequency === 'weekly' && d.getDay() === s.weekday) || (s.frequency === 'monthly' && d.getDate() === s.monthDay))
    if (ok) return fmt(d)
    d.setDate(d.getDate() + 1)
  }
  return fmt(d)
}

function stampNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function createMockReportsService(): ReportsService {
  let definitions: ReportDefinition[] = []
  let schedules: ReportSchedule[] = []
  let exports: ReportExport[] = []
  let questions: AssistantQuestion[] = []
  const seededFor = new Set<string>()
  const salesCache = new Map<string, SampleSale[]>()
  let counter = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const nextId = (prefix: string) => `${prefix}-${String(++counter).padStart(4, '0')}`

  function builtInsFor(propertyId: string): ReportDefinition[] {
    return BUILT_IN_REPORTS.map((b) => ({
      ...b,
      id: `BI-${b.key}`,
      propertyId,
      builtIn: true,
      createdBy: 'Gastora',
      createdAt: '2026-01-01 00:00',
      updatedAt: '2026-01-01 00:00',
    }))
  }

  // The sample hotels start with a schedule or two, so the list is not empty on first look.
  function seed(propertyId: string) {
    if (seededFor.has(propertyId)) return
    seededFor.add(propertyId)
    if (propertyId !== 't1' && propertyId !== 't3') return
    const now = new Date()
    const base = [
      { reportId: 'BI-manager', reportName: 'Daily manager report', frequency: 'daily' as const, weekday: 1, monthDay: 1, sendAt: '07:00', recipients: propertyId === 't1' ? ['gm@lakeview.demo', 'owner@lakeview.demo'] : ['manager@savannahlodge.demo'], format: 'pdf' as const },
      { reportId: 'BI-ageing', reportName: 'Guest ledger ageing', frequency: 'weekly' as const, weekday: 1, monthDay: 1, sendAt: '08:30', recipients: ['finance@lakeview.demo'], format: 'csv' as const },
    ]
    for (const b of base) {
      const yesterday = new Date(now.getTime() - 86400000)
      const s: ReportSchedule = {
        ...b,
        id: nextId('SCH'),
        propertyId,
        active: true,
        nextRunAt: nextRun(b, now),
        lastRunAt: b.frequency === 'daily' ? `${yesterday.toISOString().slice(0, 10)} ${b.sendAt}` : undefined,
        createdBy: 'Esther Nambi',
        createdAt: '2026-09-01 10:00',
      }
      schedules.push(s)
      if (s.lastRunAt)
        exports.push({
          id: nextId('EXP'),
          propertyId,
          reportId: s.reportId,
          reportName: s.reportName,
          format: s.format,
          rowCount: 7,
          trigger: 'schedule',
          recipients: s.recipients,
          createdBy: 'Schedule',
          createdAt: s.lastRunAt,
        })
    }
  }

  function validateDefinition(input: NewReportDefinition) {
    const name = input.name.trim()
    if (!name) throw new Error('Give the report a name')
    if (name.length > 80) throw new Error('Keep the name under 80 characters')
    const known = DATASET_COLUMNS[input.dataset]
    if (!known) throw new Error('Pick what the report lists')
    if (input.columns.length === 0) throw new Error('Pick at least one column')
    const keys = new Set(known.map((c) => c.key))
    for (const c of input.columns) if (!keys.has(c)) throw new Error(`Unknown column: ${c}`)
    if (input.groupBy && !keys.has(input.groupBy)) throw new Error('Group by a column of this list')
    for (const f of input.filters) {
      if (!keys.has(f.column)) throw new Error('A filter uses a column this list does not have')
      if (!f.value.trim()) throw new Error('Every filter needs a value')
      const col = known.find((c) => c.key === f.column)
      if (col?.type === 'number' && f.op !== 'in' && f.op !== 'contains' && Number.isNaN(Number(f.value))) throw new Error(`${col.label} needs a number`)
    }
    return name
  }

  function findSchedule(id: string) {
    const s = schedules.find((x) => x.id === id)
    if (!s) throw new Error('That schedule no longer exists')
    return s
  }

  const wrap = <T,>(fn: () => T): Promise<T> => {
    try {
      return Promise.resolve(fn())
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)))
    }
  }

  return {
    listDailyKpis: ({ propertyIds, from, to, scenario }) =>
      wrap(() => {
        if (from > to) throw new Error('The start date is after the end date')
        const days = daysBetween(from, to)
        return propertyIds.flatMap((p) => days.map((d) => kpiFor(p, d, scenario)))
      }),

    listDepartmentKpis: (propertyId) => Promise.resolve(targetsFor(propertyId)),

    getCostProfile: (propertyId) => Promise.resolve({ propertyId, ...(COSTS[propertyId] ?? DEFAULT_COSTS) }),

    listSampleSales: (propertyId, today) => {
      const key = `${propertyId}:${today}`
      if (!salesCache.has(key)) salesCache.set(key, sampleSales(propertyId, today))
      return Promise.resolve(salesCache.get(key) ?? [])
    },

    listDefinitions: (propertyId) =>
      wrap(() => [...builtInsFor(propertyId), ...definitions.filter((d) => d.propertyId === propertyId)]),

    saveDefinition: (propertyId, input, actor: Actor, id) =>
      wrap(() => {
        const name = validateDefinition(input)
        const at = stampNow()
        if (id) {
          const found = definitions.find((d) => d.id === id)
          if (!found) throw new Error(id.startsWith('BI-') ? 'Built-in reports cannot be changed. Save a copy instead.' : 'That report no longer exists')
          const next: ReportDefinition = { ...found, ...input, name, description: input.description.trim(), updatedAt: at }
          definitions = definitions.map((d) => (d.id === id ? next : d))
          emit()
          return next
        }
        if (definitions.some((d) => d.propertyId === propertyId && d.name.toLowerCase() === name.toLowerCase()))
          throw new Error('A report with that name already exists')
        const created: ReportDefinition = {
          ...input,
          name,
          description: input.description.trim(),
          id: nextId('RPT'),
          propertyId,
          builtIn: false,
          createdBy: actor.name,
          createdAt: at,
          updatedAt: at,
        }
        definitions = [...definitions, created]
        emit()
        return created
      }),

    deleteDefinition: (id) =>
      wrap(() => {
        if (id.startsWith('BI-')) throw new Error('Built-in reports cannot be deleted')
        if (!definitions.some((d) => d.id === id)) throw new Error('That report no longer exists')
        if (schedules.some((s) => s.reportId === id)) throw new Error('Delete its schedules first')
        definitions = definitions.filter((d) => d.id !== id)
        emit()
      }),

    listSchedules: (propertyId) =>
      wrap(() => {
        seed(propertyId)
        return schedules.filter((s) => s.propertyId === propertyId)
      }),

    saveSchedule: (propertyId, input, actor) =>
      wrap(() => {
        const report = [...builtInsFor(propertyId), ...definitions].find((d) => d.id === input.reportId)
        if (!report) throw new Error('Pick a report to send')
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.sendAt)) throw new Error('Give a time like 07:00')
        const recipients = input.recipients.map((r) => r.trim()).filter(Boolean)
        if (recipients.length === 0) throw new Error('Add at least one recipient')
        const bad = recipients.find((r) => !EMAIL.test(r))
        if (bad) throw new Error(`Not an email address: ${bad}`)
        if (input.frequency === 'monthly' && (input.monthDay < 1 || input.monthDay > 28)) throw new Error('Pick a day from 1 to 28')
        const created: ReportSchedule = {
          ...input,
          recipients,
          id: nextId('SCH'),
          propertyId,
          reportName: report.name,
          active: true,
          nextRunAt: nextRun(input, new Date()),
          createdBy: actor.name,
          createdAt: stampNow(),
        }
        schedules = [...schedules, created]
        emit()
        return created
      }),

    setScheduleActive: (id, active) =>
      wrap(() => {
        const s = findSchedule(id)
        const next = { ...s, active, nextRunAt: active ? nextRun(s, new Date()) : s.nextRunAt }
        schedules = schedules.map((x) => (x.id === id ? next : x))
        emit()
        return next
      }),

    runScheduleNow: (id, rowCount, actor) =>
      wrap(() => {
        const s = findSchedule(id)
        const at = stampNow()
        exports = [
          {
            id: nextId('EXP'),
            propertyId: s.propertyId,
            reportId: s.reportId,
            reportName: s.reportName,
            format: s.format,
            rowCount,
            trigger: 'schedule',
            recipients: s.recipients,
            createdBy: actor.name,
            createdAt: at,
          },
          ...exports,
        ]
        const next = { ...s, lastRunAt: at }
        schedules = schedules.map((x) => (x.id === id ? next : x))
        emit()
        return next
      }),

    deleteSchedule: (id) =>
      wrap(() => {
        findSchedule(id)
        schedules = schedules.filter((s) => s.id !== id)
        emit()
      }),

    listExports: (propertyId) =>
      wrap(() => {
        seed(propertyId)
        return exports.filter((e) => e.propertyId === propertyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }),

    recordExport: (propertyId, input, actor) =>
      wrap(() => {
        if (!input.reportName.trim()) throw new Error('An export needs a report name')
        const created: ReportExport = { ...input, id: nextId('EXP'), propertyId, createdBy: actor.name, createdAt: stampNow() }
        exports = [created, ...exports]
        emit()
        return created
      }),

    listQuestions: (propertyId) => wrap(() => questions.filter((q) => q.propertyId === propertyId)),

    recordQuestion: (propertyId, input, actor) =>
      wrap(() => {
        const question = input.question.trim()
        if (!question) throw new Error('Type a question')
        const created: AssistantQuestion = { ...input, question, id: nextId('Q'), propertyId, askedBy: actor.name, askedAt: stampNow() }
        questions = [created, ...questions].slice(0, 200)
        emit()
        return created
      }),

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
