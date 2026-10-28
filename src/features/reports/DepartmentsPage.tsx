import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AreaChart, Card, Donut, PageHeader, Segmented, StatCard, Tabs } from '../../components/ui'
import type { UiIconName } from '../../components/ui'
import { daySeries, roomMix } from '../../lib/dashboard'
import { dayMonth, ugx } from '../../lib/format'
import { soldNight } from '../../lib/pace'
import { addDays, cashPosition, channelMix, daysOf, execKpis, inRange, nightsInRange, rangeFor } from '../../services/reports/analytics'
import type { RangePreset } from '../../services/reports/analytics'
import type { Department, DepartmentKpi } from '../../services/reports/reportsTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { Bars, ColumnChart, SampleBadge } from './ReportsUi'
import { useDepartmentTargets } from './useReports'
import { useReportFacts } from './useReportFacts'

const LABEL: Record<Department, string> = {
  frontOffice: 'Front office',
  fnb: 'F&B',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  sales: 'Sales',
  procurement: 'Procurement',
  finance: 'Finance',
}

const short = (iso: string) => dayMonth(iso).replace(/ \d{4}$/, '')
const TARGET_DAYS = { Urgent: 1, High: 1, Normal: 3 } as const

type Tile = { label: string; value: string; hint?: string; icon: UiIconName; to?: string; tone?: 'default' | 'good' | 'warn' | 'bad'; target?: string }

function fmtTarget(t: DepartmentKpi | undefined) {
  if (!t) return undefined
  const v = t.unit === 'percent' ? `${t.target}%` : t.unit === 'ugx' ? ugx(t.target) : `${t.target}`
  return `Target ${t.higherIsBetter ? '' : 'at most '}${v}`
}

/** Good when the figure meets the target, a warning when it does not. */
function judge(value: number, t: DepartmentKpi | undefined): 'good' | 'warn' | 'default' {
  if (!t) return 'default'
  return (t.higherIsBetter ? value >= t.target : value <= t.target) ? 'good' : 'warn'
}

export default function DepartmentsPage() {
  const facts = useReportFacts()
  const targets = useDepartmentTargets()
  const { features } = useFeatures()
  const { canOpen } = useAuth()
  const [preset, setPreset] = useState<RangePreset>('7')
  const range = useMemo(() => rangeFor(preset, facts.today), [preset, facts.today])

  const departments: Department[] = [
    'frontOffice',
    'fnb',
    'housekeeping',
    'maintenance',
    ...(features.channels || features.groups ? (['sales'] as Department[]) : []),
    ...(features.supplyChain ? (['procurement'] as Department[]) : []),
    'finance',
  ]
  const [tab, setTab] = useState<Department>('frontOffice')
  const current = departments.includes(tab) ? tab : 'frontOffice'
  const target = (d: Department, key: string) => targets.find((t) => t.department === d && t.kpiKey === key)
  const link = (to: string) => (canOpen(to.split('?')[0]) ? to : undefined)

  const k = useMemo(() => execKpis(facts, range, null), [facts, range])

  let tiles: Tile[] = []
  let chart: ReactNode = null
  let chartTitle = ''

  if (current === 'frontOffice') {
    const sellable = facts.rooms.filter((r) => r.status !== 'blocked').length
    const tonight = sellable ? Math.round((soldNight(facts.reservations, facts.today) / sellable) * 100) : 0
    const arrivals = facts.reservations.filter((r) => r.arrival === facts.today && (r.status === 'booked' || r.status === 'in-house')).length
    const departures = facts.reservations.filter((r) => r.departure === facts.today && (r.status === 'in-house' || r.status === 'checked-out')).length
    const t1 = target('frontOffice', 'occupancy')
    const t2 = target('frontOffice', 'adr')
    tiles = [
      { label: 'Occupancy tonight', value: `${tonight}%`, icon: 'occupancy', target: fmtTarget(t1), tone: judge(tonight, t1), to: link('/desk/rooms') },
      { label: 'Arrivals today', value: `${arrivals}`, icon: 'arrival', to: link('/desk/reservations?view=arrivals') },
      { label: 'Departures today', value: `${departures}`, icon: 'departure', to: link('/desk/folios') },
      { label: 'ADR', value: ugx(k.adr), icon: 'bed', target: fmtTarget(t2), tone: k.sold ? judge(k.adr, t2) : 'default' },
    ]
    const ahead = daySeries(daysOf({ from: facts.today, to: addDays(facts.today, 13) }), facts.reservations, facts.rooms, [], facts.today)
    chartTitle = 'Occupancy, next 14 nights'
    chart = <AreaChart points={ahead.map((p) => ({ label: short(p.day), value: p.sellable ? Math.round((p.occupied / p.sellable) * 100) : 0 }))} suffix="%" />
  }

  if (current === 'fnb') {
    const sales = facts.sales.filter((s) => inRange(s.createdAt.slice(0, 10), range))
    const total = sales.reduce((n, s) => n + s.total, 0)
    const avg = sales.length ? Math.round(total / sales.length) : 0
    const toRoom = sales.filter((s) => s.payment === 'Room charge').reduce((n, s) => n + s.total, 0)
    const t = target('fnb', 'avgCheck')
    tiles = [
      { label: 'F&B sales', value: ugx(total), icon: 'money', to: facts.salesAreSample ? undefined : link('/pos/payments') },
      { label: 'Bills', value: `${sales.length}`, icon: 'list' },
      { label: 'Average bill', value: ugx(avg), icon: 'money', target: fmtTarget(t), tone: sales.length ? judge(avg, t) : 'default' },
      { label: 'Charged to rooms', value: total ? `${Math.round((toRoom / total) * 100)}%` : '0%', icon: 'bed', hint: ugx(toRoom) },
    ]
    const byOutlet = new Map<string, number>()
    for (const s of sales) byOutlet.set(s.outlet, (byOutlet.get(s.outlet) ?? 0) + s.total)
    const byDay = daysOf(range).map((d) => ({ label: short(d), value: sales.filter((s) => s.createdAt.startsWith(d)).reduce((n, s) => n + s.total, 0) }))
    chartTitle = 'Sales by outlet'
    chart = (
      <div className="space-y-4">
        <Bars rows={[...byOutlet.entries()].map(([label, value]) => ({ label, value, tone: label === 'Bar' ? 'accent' : 'brand' }))} format={ugx} />
        {byDay.length > 1 && <ColumnChart points={byDay} format={ugx} />}
      </div>
    )
  }

  if (current === 'housekeeping') {
    const mix = roomMix(facts.rooms)
    const sellable = facts.rooms.length - mix.blocked
    const vacant = sellable - mix.occupied
    const ready = vacant > 0 ? Math.round((mix.ready / vacant) * 100) : 100
    const t = target('housekeeping', 'readyShare')
    tiles = [
      { label: 'Rooms to clean', value: `${facts.housekeeping.toClean}`, icon: 'clean', to: link('/housekeeping'), tone: facts.housekeeping.toClean > 0 ? 'warn' : 'default' },
      { label: 'Empty rooms ready', value: `${ready}%`, icon: 'check', target: fmtTarget(t), tone: judge(ready, t) },
      { label: 'Open tasks', value: `${facts.housekeeping.openTasks}`, icon: 'tasks', hint: `${facts.housekeeping.tasksDoneToday} done today`, to: link('/housekeeping/tasks') },
      features.inspections
        ? { label: 'To inspect', value: `${facts.housekeeping.toInspect}`, icon: 'list', to: link('/housekeeping/inspections') }
        : { label: 'Issues', value: `${facts.housekeeping.issues}`, icon: 'alert', to: link('/housekeeping/issues') },
    ]
    chartTitle = 'Rooms right now'
    chart = (
      <Donut
        centre={`${facts.rooms.length}`}
        caption="Room status"
        slices={[
          { label: 'Occupied', value: mix.occupied, colour: 'var(--color-brand)' },
          { label: 'Ready', value: mix.ready, colour: 'var(--color-good)' },
          { label: 'To clean', value: mix.dirty, colour: 'var(--color-warn)' },
          { label: 'Out of service', value: mix.blocked, colour: 'var(--color-bad)' },
        ]}
      />
    )
  }

  if (current === 'maintenance') {
    const open = facts.workOrders.filter((w) => w.status !== 'Resolved' && w.status !== 'Done')
    const overdue = open.filter((w) => w.overdue).length
    const closed = facts.workOrders.filter((w) => (w.status === 'Resolved' || w.status === 'Done') && inRange(w.closedOn ?? w.reportedOn, range))
    const onTime = closed.filter((w) => (w.closedOn ?? w.reportedOn) <= addDays(w.reportedOn, TARGET_DAYS[w.priority])).length
    const onTimePct = closed.length ? Math.round((onTime / closed.length) * 100) : 0
    const tOver = target('maintenance', 'overdue')
    const tOn = target('maintenance', 'onTime')
    tiles = [
      { label: 'Open work orders', value: `${open.length}`, icon: 'tasks', to: link('/maintenance') },
      { label: 'Overdue', value: `${overdue}`, icon: 'alert', target: fmtTarget(tOver), tone: overdue > 0 ? 'bad' : 'good', to: link('/maintenance') },
      { label: 'Closed in period', value: `${closed.length}`, icon: 'check' },
      { label: 'Closed on time', value: closed.length ? `${onTimePct}%` : '—', icon: 'check', target: fmtTarget(tOn), tone: closed.length ? judge(onTimePct, tOn) : 'default' },
    ]
    const byCat = new Map<string, number>()
    for (const w of open) byCat.set(w.category, (byCat.get(w.category) ?? 0) + 1)
    chartTitle = 'Open work orders by kind'
    chart = <Bars rows={[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, tone: 'warn' }))} />
  }

  if (current === 'sales') {
    const mix = channelMix(facts, range)
    const totalNights = mix.reduce((n, m) => n + m.nights, 0)
    const company = mix.find((m) => m.label === 'Company')
    const share = totalNights ? Math.round(((company?.nights ?? 0) / totalNights) * 100) : 0
    const owed = facts.accounts.reduce((n, a) => n + a.outstandingBalance, 0)
    const over = facts.accounts.filter((a) => a.creditLimit > 0 && a.outstandingBalance > a.creditLimit).length
    const t = target('sales', 'companyShare')
    const groupNights = facts.reservations.filter((r) => r.group).reduce((n, r) => n + nightsInRange(r, range, facts.today).length, 0)
    tiles = [
      { label: 'Company share', value: `${share}%`, icon: 'guests', target: fmtTarget(t), tone: judge(share, t), hint: `${company?.nights ?? 0} room nights` },
      { label: 'Group room nights', value: `${groupNights}`, icon: 'bed', to: features.groups ? link('/desk/groups') : undefined },
      { label: 'Owed by companies', value: ugx(owed), icon: 'money', to: link('/desk/companies') },
      { label: 'Over credit limit', value: `${over}`, icon: 'alert', tone: over > 0 ? 'bad' : 'good', to: link('/desk/companies') },
    ]
    chartTitle = 'Room nights by segment'
    chart = <Bars rows={mix.map((m) => ({ label: m.label, value: m.nights, hint: `${m.share}%` }))} format={(n) => `${n} nights`} />
  }

  if (current === 'procurement') {
    const openOrders = facts.orders.filter((o) => o.status !== 'Received')
    const ordered = facts.orders.filter((o) => inRange(o.createdAt.slice(0, 10), range))
    const waiting = facts.requests.filter((r) => r.status === 'Waiting').length
    const t = target('procurement', 'openOrders')
    tiles = [
      { label: 'Open purchase orders', value: `${openOrders.length}`, icon: 'list', target: fmtTarget(t), tone: judge(openOrders.length, t), to: link('/procurement') },
      { label: 'Ordered in period', value: ugx(ordered.reduce((n, o) => n + o.total, 0)), icon: 'money', hint: `${ordered.length} orders` },
      { label: 'Requests waiting', value: `${waiting}`, icon: 'tasks', to: link('/procurement/requests') },
      { label: 'Active suppliers', value: `${facts.activeSuppliers}`, icon: 'guests', to: link('/procurement/suppliers') },
    ]
    const bySupplier = new Map<string, number>()
    for (const o of facts.orders) bySupplier.set(o.supplier, (bySupplier.get(o.supplier) ?? 0) + o.total)
    chartTitle = 'Spend by supplier'
    chart = <Bars rows={[...bySupplier.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} format={ugx} />
  }

  if (current === 'finance') {
    const cash = cashPosition(facts, range)
    const over30 = cash.bands.find((b) => b.label === 'Over 30 days')?.amount ?? 0
    const t = target('finance', 'debtOver30')
    tiles = [
      { label: 'Cash collected', value: ugx(cash.collected), icon: 'money', hint: `${cash.entries.length} payments` },
      { label: 'Guests owe', value: ugx(cash.guestDebt), icon: 'alert', tone: cash.guestDebt > 0 ? 'warn' : 'good', to: link('/desk/folios?view=balance') },
      { label: 'Companies owe', value: ugx(cash.companyDebt), icon: 'guests', to: link('/desk/companies') },
      { label: 'Debt over 30 days', value: ugx(over30), icon: 'alert', target: fmtTarget(t), tone: judge(over30, t) === 'good' ? 'good' : 'bad' },
    ]
    chartTitle = 'Guest debt by age'
    chart = <Bars rows={cash.bands.map((b) => ({ label: b.label, value: b.amount, hint: `${b.count}`, tone: b.label === 'Over 30 days' ? 'bad' : b.label === 'In the house' ? 'brand' : 'warn' }))} format={ugx} />
  }

  const periodic = current !== 'housekeeping'

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reports" title="Departments" description="Four KPIs and a chart for each department head." />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs<Department> label="Department" value={current} onChange={setTab} tabs={departments.map((d) => ({ key: d, label: LABEL[d] }))} />
        {periodic && (
          <Segmented<RangePreset>
            label="Period"
            value={preset}
            onChange={setPreset}
            options={[
              { key: 'today', label: 'Today' },
              { key: '7', label: '7 days' },
              { key: '30', label: '30 days' },
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatCard key={t.label} label={t.label} value={t.value} hint={t.target ?? t.hint} icon={t.icon} tone={t.tone} to={t.to} />
        ))}
      </div>

      <Card title={chartTitle} icon="list" actions={current === 'fnb' && facts.salesAreSample ? <SampleBadge label="Sample till history" /> : undefined}>
        {chart}
      </Card>
    </div>
  )
}
