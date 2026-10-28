import { daySeries, debtors } from '../../lib/dashboard'
import { nightsOf } from '../../lib/booking'
import { addDays, chargesOf, daysOf, folioLink, paymentsOf, segmentOf } from './analytics'
import type { Range } from './analytics'
import type { ReportFacts } from './facts'
import { DATASET_COLUMNS, DATASET_DATE } from './reportCatalog'
import type { DatasetColumn } from './reportCatalog'
import type { DatasetKey, ReportDefinition, ReportFilter, ReportPeriod } from './reportsTypes'

// Runs a report definition over the hotel's records: pick the list, apply the period and filters,
// keep the chosen columns, and total by a column when asked. Every row keeps a link to its record.

export type Cell = string | number
export type DataRow = { _id: string; _to?: string; [key: string]: Cell | undefined }

const bandOf = (age: number) => (age === 0 ? 'In the house' : age <= 7 ? '1 to 7 days' : age <= 30 ? '8 to 30 days' : 'Over 30 days')

export function datasetRows(dataset: DatasetKey, facts: ReportFacts): DataRow[] {
  switch (dataset) {
    case 'reservations':
      return facts.reservations.map((r) => ({
        _id: r.id,
        _to: folioLink(r.id),
        id: r.id,
        guest: r.guest,
        status: r.status,
        source: segmentOf(r),
        roomType: r.roomType,
        room: r.room ?? '',
        arrival: r.arrival,
        departure: r.departure,
        nights: Math.max(0, nightsOf(r.arrival, r.departure)),
        total: r.total,
        paid: r.paid,
        balance: r.total - r.paid,
        bookedAt: r.bookedAt ?? '',
        company: r.corporate?.accountName ?? '',
      }))
    case 'charges':
      return chargesOf(facts).map((c) => ({ _id: c.id, _to: c.to, date: c.date, reservation: c.reservation, guest: c.guest, category: c.category, description: c.description, amount: c.amount }))
    case 'payments':
      return paymentsOf(facts).map((p) => ({ _id: p.id, _to: p.to, date: p.date, reference: p.reference, guest: p.guest, kind: p.kind, method: p.method, amount: p.amount }))
    case 'posSales':
      return facts.sales.map((s) => ({
        _id: s.id,
        _to: s.sample ? undefined : '/pos/payments',
        date: s.createdAt.slice(0, 10),
        id: s.id,
        outlet: s.outlet,
        payment: s.payment,
        items: s.items,
        total: s.total,
      }))
    case 'stock':
      return facts.stock.map((s) => ({
        _id: s.id,
        _to: '/inventory',
        name: s.name,
        category: s.category || 'Other',
        unit: s.unit,
        onHand: s.onHand,
        reorderAt: s.reorderAt,
        unitCost: s.unitCost,
        value: s.onHand * s.unitCost,
        low: s.onHand <= s.reorderAt ? 'Yes' : 'No',
      }))
    case 'workOrders':
      return facts.workOrders.map((w) => ({
        _id: w.id,
        _to: '/maintenance',
        room: w.room,
        category: w.category,
        description: w.description,
        priority: w.priority,
        status: w.status,
        technician: w.technician,
        reportedOn: w.reportedOn,
        overdue: w.overdue ? 'Yes' : 'No',
      }))
    case 'debtors':
      return debtors(facts.reservations, facts.today).map((d) => ({
        _id: d.reservation.id,
        _to: folioLink(d.reservation.id),
        reservation: d.reservation.id,
        guest: d.reservation.guest,
        status: d.reservation.status,
        company: d.reservation.corporate?.accountName ?? '',
        owed: d.owed,
        age: d.age,
        band: bandOf(d.age),
      }))
    case 'dailyKpis': {
      const first = facts.reservations.reduce((m, r) => (r.arrival < m ? r.arrival : m), facts.today)
      const from = first < addDays(facts.today, -365) ? addDays(facts.today, -365) : first
      return daySeries(daysOf({ from, to: addDays(facts.today, 30) }), facts.reservations, facts.rooms, facts.sales, facts.today).map((p) => ({
        _id: p.day,
        date: p.day,
        roomsAvailable: p.sellable,
        roomsSold: p.occupied,
        occupancy: p.sellable ? Math.round((p.occupied / p.sellable) * 1000) / 10 : 0,
        adr: p.occupied ? Math.round(p.rooms / p.occupied) : 0,
        revpar: p.sellable ? Math.round(p.rooms / p.sellable) : 0,
        roomRevenue: p.rooms,
        fnbRevenue: p.pos,
        extrasRevenue: p.extras,
        totalRevenue: p.rooms + p.pos + p.extras,
      }))
    }
  }
}

export function periodRange(period: ReportPeriod, today: string): Range | null {
  switch (period) {
    case 'all':
      return null
    case 'today':
      return { from: today, to: today }
    case '7':
      return { from: addDays(today, -6), to: today }
    case '30':
      return { from: addDays(today, -29), to: today }
    case 'mtd':
      return { from: `${today.slice(0, 8)}01`, to: today }
    case 'next7':
      return { from: addDays(today, 1), to: addDays(today, 7) }
  }
}

function matches(row: DataRow, f: ReportFilter, col: DatasetColumn | undefined): boolean {
  const v = row[f.column]
  const s = String(v ?? '').toLowerCase()
  const want = f.value.trim().toLowerCase()
  const numeric = col && (col.type === 'number' || col.type === 'money' || col.type === 'percent')
  switch (f.op) {
    case 'eq':
      return numeric ? Number(v) === Number(f.value) : s === want
    case 'neq':
      return numeric ? Number(v) !== Number(f.value) : s !== want
    case 'contains':
      return s.includes(want)
    case 'in':
      return want.split(',').map((x) => x.trim()).filter(Boolean).includes(s)
    case 'gte':
      return numeric ? Number(v) >= Number(f.value) : s >= want
    case 'lte':
      return numeric ? Number(v) <= Number(f.value) : s <= want
  }
}

export interface ReportResult {
  columns: DatasetColumn[]
  rows: DataRow[]
  /** Totals of the money and number columns, for the footer. */
  totals: Record<string, number>
  grouped: boolean
}

type RunnableDefinition = Pick<ReportDefinition, 'dataset' | 'columns' | 'filters' | 'groupBy' | 'period'>

export function runReport(def: RunnableDefinition, facts: ReportFacts): ReportResult {
  const all = DATASET_COLUMNS[def.dataset]
  const byKey = new Map(all.map((c) => [c.key, c]))
  let rows = datasetRows(def.dataset, facts)
  const range = periodRange(def.period, facts.today)
  const dateCol = DATASET_DATE[def.dataset]
  if (range && dateCol) rows = rows.filter((r) => String(r[dateCol] ?? '') >= range.from && String(r[dateCol] ?? '') <= range.to)
  for (const f of def.filters) rows = rows.filter((r) => matches(r, f, byKey.get(f.column)))

  const columns = def.columns.map((k) => byKey.get(k)).filter((c): c is DatasetColumn => !!c)
  const summable = columns.filter((c) => c.type === 'money' || c.type === 'number')

  if (def.groupBy) {
    const groupCol = byKey.get(def.groupBy)
    const groups = new Map<string, DataRow>()
    for (const r of rows) {
      const key = String(r[def.groupBy] ?? '') || '(blank)'
      const g = groups.get(key) ?? { _id: key, [def.groupBy]: key, count: 0 }
      g.count = Number(g.count) + 1
      for (const c of summable) if (c.key !== def.groupBy) g[c.key] = Number(g[c.key] ?? 0) + Number(r[c.key] ?? 0)
      groups.set(key, g)
    }
    const groupedCols: DatasetColumn[] = [
      groupCol ?? { key: def.groupBy, label: def.groupBy, type: 'text' },
      { key: 'count', label: 'Rows', type: 'number' },
      ...summable.filter((c) => c.key !== def.groupBy),
    ]
    const out = [...groups.values()].sort((a, b) => String(a._id).localeCompare(String(b._id)))
    const totals: Record<string, number> = {}
    for (const c of groupedCols) if (c.type === 'money' || c.type === 'number') totals[c.key] = out.reduce((n, r) => n + Number(r[c.key] ?? 0), 0)
    return { columns: groupedCols, rows: out, totals, grouped: true }
  }

  const totals: Record<string, number> = {}
  for (const c of summable) totals[c.key] = rows.reduce((n, r) => n + Number(r[c.key] ?? 0), 0)
  return { columns, rows, totals, grouped: false }
}

export function formatCell(value: Cell | undefined, col: DatasetColumn): string {
  if (value === undefined || value === '') return '—'
  if (col.type === 'money') return `UGX ${Number(value).toLocaleString('en-US')}`
  if (col.type === 'percent') return `${value}%`
  if (col.type === 'number') return Number(value).toLocaleString('en-US')
  return String(value)
}

/** The report as a CSV file Excel opens: one header row, then raw values (money without "UGX"). */
export function toCsv(result: ReportResult): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = result.columns.map((c) => esc(c.type === 'money' ? `${c.label} (UGX)` : c.label)).join(',')
  const body = result.rows.map((r) => result.columns.map((c) => esc(r[c.key])).join(','))
  return [head, ...body].join('\r\n')
}
