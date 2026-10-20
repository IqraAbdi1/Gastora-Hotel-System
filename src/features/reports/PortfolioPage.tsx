import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, PageHeader, Segmented, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { ugx } from '../../lib/format'
import { reportsService } from '../../services'
import { addDays, compareRange, execKpis, rangeFor } from '../../services/reports/analytics'
import type { ExecKpis, Range, RangePreset } from '../../services/reports/analytics'
import type { CostProfile, DailyKpi } from '../../services/reports/reportsTypes'
import type { ReportFacts } from '../../services/reports/facts'
import { useFeatures } from '../platform/featuresContext'
import { Bars, ColumnChart, SampleBadge } from './ReportsUi'
import { deltaWords } from './reportsUtils'
import { useCostProfile, useServiceValue } from './useReports'
import { useReportFacts } from './useReportFacts'

type View = 'consolidated' | 'benchmark' | 'budget' | 'periods'

interface Figures {
  id: string
  name: string
  sample: boolean
  available: number
  sold: number
  roomRevenue: number
  fnbRevenue: number
  otherRevenue: number
  totalRevenue: number
  costs: number
  gop: number
  cash: number
  cancellations: number
}

const NO_ROWS: DailyKpi[] = []

const occ = (f: Pick<Figures, 'sold' | 'available'>) => (f.available ? Math.round((f.sold / f.available) * 1000) / 10 : 0)
const per = (n: number, d: number) => (d ? Math.round(n / d) : 0)

function fromKpis(id: string, name: string, k: ExecKpis): Figures {
  return {
    id,
    name,
    sample: false,
    available: k.available,
    sold: k.sold,
    roomRevenue: k.roomRevenue,
    fnbRevenue: k.fnbRevenue,
    otherRevenue: k.extrasRevenue,
    totalRevenue: k.totalRevenue,
    costs: k.costs,
    gop: k.gop,
    cash: k.cash,
    cancellations: k.cancellations,
  }
}

function fromRows(id: string, name: string, rows: DailyKpi[], scale = 1): Figures {
  const sum = (f: (r: DailyKpi) => number) => Math.round(rows.reduce((n, r) => n + f(r), 0) * scale)
  return {
    id,
    name,
    sample: true,
    available: sum((r) => r.roomsAvailable),
    sold: sum((r) => r.roomsSold),
    roomRevenue: sum((r) => r.roomRevenue),
    fnbRevenue: sum((r) => r.fnbRevenue),
    otherRevenue: sum((r) => r.otherRevenue),
    totalRevenue: sum((r) => r.totalRevenue),
    costs: sum((r) => r.operatingCosts),
    gop: sum((r) => r.gop),
    cash: sum((r) => r.cashCollected),
    cancellations: sum((r) => r.cancellations),
  }
}

function total(list: Figures[], name: string): Figures {
  const sum = (f: (x: Figures) => number) => list.reduce((n, x) => n + f(x), 0)
  return {
    id: 'all',
    name,
    sample: list.some((x) => x.sample),
    available: sum((x) => x.available),
    sold: sum((x) => x.sold),
    roomRevenue: sum((x) => x.roomRevenue),
    fnbRevenue: sum((x) => x.fnbRevenue),
    otherRevenue: sum((x) => x.otherRevenue),
    totalRevenue: sum((x) => x.totalRevenue),
    costs: sum((x) => x.costs),
    gop: sum((x) => x.gop),
    cash: sum((x) => x.cash),
    cancellations: sum((x) => x.cancellations),
  }
}

const variance = (actual: number, budget: number) => (budget ? Math.round(((actual - budget) / Math.abs(budget)) * 1000) / 10 : 0)
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`

export default function PortfolioPage() {
  const facts = useReportFacts()
  const cost = useCostProfile()
  const { tenant, tenants, features } = useFeatures()
  const [preset, setPreset] = useState<RangePreset>('mtd')
  const range = useMemo(() => rangeFor(preset, facts.today), [preset, facts.today])

  const group = tenant.group ? tenants.filter((t) => t.group === tenant.group) : [tenant]
  const multi = features.portfolio && group.length >= 2
  const sisters = multi ? group.filter((t) => t.id !== tenant.id) : []
  const sisterIds = sisters.map((t) => t.id).join(',')
  const allIds = group.map((t) => t.id).join(',')

  const sisterRows = useServiceValue(
    () => (sisterIds ? reportsService.listDailyKpis({ propertyIds: sisterIds.split(','), from: range.from, to: range.to, scenario: 'actual' }) : Promise.resolve([])),
    NO_ROWS,
    `pf:${sisterIds}:${range.from}:${range.to}`,
  ).value
  const budgetRows = useServiceValue(
    () => (multi ? reportsService.listDailyKpis({ propertyIds: allIds.split(','), from: range.from, to: range.to, scenario: 'budget' }) : Promise.resolve([])),
    NO_ROWS,
    `bd:${multi}:${allIds}:${range.from}:${range.to}`,
  ).value

  const own = useMemo(() => fromKpis(tenant.id, tenant.name, execKpis(facts, range, cost)), [facts, range, cost, tenant.id, tenant.name])
  const properties = useMemo(
    () => [own, ...sisters.map((t) => fromRows(t.id, t.name, sisterRows.filter((r) => r.propertyId === t.id)))],
    // sisters is derived from the tenant list and the group, both named in sisterIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [own, sisterRows, sisterIds],
  )
  const all = total(properties, tenant.group ?? 'All properties')

  // A budget is written per available room, so this hotel's budget follows the rooms it has on record.
  const budgets = useMemo(
    () =>
      group.map((t) => {
        const rows = budgetRows.filter((r) => r.propertyId === t.id)
        const budgetRooms = rows.reduce((n, r) => n + r.roomsAvailable, 0)
        const scale = t.id === tenant.id && budgetRooms ? own.available / budgetRooms : 1
        return fromRows(t.id, t.name, rows, scale)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgetRows, allIds, own.available, tenant.id],
  )

  const views: View[] = multi ? ['consolidated', 'benchmark', 'budget', 'periods'] : ['periods']
  const [tab, setTab] = useState<View>(multi ? 'consolidated' : 'periods')
  const view = views.includes(tab) ? tab : views[0]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title={multi ? 'Portfolio' : 'Period comparison'}
        description={multi ? `${tenant.group}: ${group.length} properties side by side.` : `${tenant.name}: this period against the last one and last year.`}
        meta={<Badge tone="neutral">{range.from === range.to ? range.from : `${range.from} to ${range.to}`}</Badge>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {views.length > 1 ? (
          <Tabs<View>
            label="Portfolio"
            value={view}
            onChange={setTab}
            tabs={views.map((v) => ({ key: v, label: { consolidated: 'Consolidated', benchmark: 'Benchmark', budget: 'Budget vs actual', periods: 'Periods' }[v] }))}
          />
        ) : (
          <span />
        )}
        <Segmented<RangePreset>
          label="Period"
          value={preset}
          onChange={setPreset}
          options={[
            { key: '7', label: '7 days' },
            { key: '30', label: '30 days' },
            { key: 'mtd', label: 'Month' },
          ]}
        />
      </div>

      {view === 'consolidated' && <Consolidated all={all} properties={properties} />}
      {view === 'benchmark' && <Benchmark properties={properties} />}
      {view === 'budget' && <Budget properties={properties} budgets={budgets} groupName={tenant.group ?? 'All'} />}
      {view === 'periods' && <Periods range={range} facts={facts} cost={cost} />}
    </div>
  )
}

function SourceBadge({ f }: { f: Figures }) {
  return f.sample ? <SampleBadge /> : <Badge tone="good">Records</Badge>
}

function Consolidated({ all, properties }: { all: Figures; properties: Figures[] }) {
  const cols: Column<Figures>[] = [
    {
      key: 'name',
      header: 'Property',
      cell: (f) => (
        <span className="flex items-center gap-2 font-medium text-ink">
          {f.name} {f.id !== 'all' && <SourceBadge f={f} />}
        </span>
      ),
    },
    { key: 'occ', header: 'Occupancy', align: 'right', cell: (f) => <span className="tabular-nums">{occ(f)}%</span> },
    { key: 'rooms', header: 'Rooms', align: 'right', cell: (f) => <span className="tabular-nums">{ugx(f.roomRevenue)}</span>, hideBelow: 'md' },
    { key: 'fnb', header: 'F&B', align: 'right', cell: (f) => <span className="tabular-nums">{ugx(f.fnbRevenue)}</span>, hideBelow: 'lg' },
    { key: 'total', header: 'Revenue', align: 'right', cell: (f) => <span className="tabular-nums font-semibold">{ugx(f.totalRevenue)}</span> },
    { key: 'gop', header: 'GOP', align: 'right', cell: (f) => <span className={`tabular-nums ${f.gop < 0 ? 'text-bad' : ''}`}>{ugx(f.gop)}</span>, hideBelow: 'sm' },
    { key: 'cash', header: 'Cash', align: 'right', cell: (f) => <span className="tabular-nums">{ugx(f.cash)}</span>, hideBelow: 'xl' },
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Group revenue" value={ugx(all.totalRevenue)} icon="money" hint={`${properties.length} properties`} />
        <StatCard label="Group occupancy" value={`${occ(all)}%`} icon="occupancy" hint={`${all.sold} of ${all.available} room nights`} />
        <StatCard label="Group GOP" value={ugx(all.gop)} icon="money" hint={`${all.totalRevenue ? Math.round((all.gop / all.totalRevenue) * 100) : 0}% margin · sample costs`} tone={all.gop < 0 ? 'bad' : 'default'} />
        <StatCard label="Group RevPAR" value={ugx(per(all.roomRevenue, all.available))} icon="list" hint={`ADR ${ugx(per(all.roomRevenue, all.sold))}`} />
      </div>
      <Card title="By property" icon="list" padded={false}>
        <DataTable columns={cols} rows={[...properties, all]} rowKey={(f) => f.id} />
      </Card>
      <Card title="Share of group revenue" icon="money">
        <Bars rows={properties.map((p) => ({ label: p.name, value: p.totalRevenue, hint: `${all.totalRevenue ? Math.round((p.totalRevenue / all.totalRevenue) * 100) : 0}%` }))} format={ugx} />
      </Card>
    </>
  )
}

function Benchmark({ properties }: { properties: Figures[] }) {
  const metrics: { key: string; label: string; value: (f: Figures) => number; fmt: (n: number) => string }[] = [
    { key: 'occ', label: 'Occupancy', value: occ, fmt: (n) => `${n}%` },
    { key: 'adr', label: 'ADR', value: (f) => per(f.roomRevenue, f.sold), fmt: ugx },
    { key: 'revpar', label: 'RevPAR', value: (f) => per(f.roomRevenue, f.available), fmt: ugx },
    { key: 'trevpar', label: 'TRevPAR', value: (f) => per(f.totalRevenue, f.available), fmt: ugx },
    { key: 'goppar', label: 'GOPPAR', value: (f) => per(f.gop, f.available), fmt: ugx },
    { key: 'margin', label: 'GOP margin', value: (f) => (f.totalRevenue ? Math.round((f.gop / f.totalRevenue) * 100) : 0), fmt: (n) => `${n}%` },
    { key: 'fnb', label: 'F&B per room sold', value: (f) => per(f.fnbRevenue, f.sold), fmt: ugx },
    { key: 'cancel', label: 'Cancellations per 100 sold', value: (f) => (f.sold ? Math.round((f.cancellations / f.sold) * 1000) / 10 : 0), fmt: (n) => `${n}` },
  ]
  type Row = (typeof metrics)[number]
  const cols: Column<Row>[] = [
    { key: 'label', header: 'Per room', cell: (m) => <span className="font-medium text-ink">{m.label}</span> },
    ...properties.map((p) => ({
      key: p.id,
      header: (
        <span className="inline-flex items-center gap-1">
          {p.name} <SourceBadge f={p} />
        </span>
      ),
      align: 'right' as const,
      cell: (m: Row) => {
        const values = properties.map(m.value)
        const best = m.key === 'cancel' ? Math.min(...values) : Math.max(...values)
        const v = m.value(p)
        return <span className={`tabular-nums ${v === best && properties.length > 1 ? 'font-bold text-good' : ''}`}>{m.fmt(v)}</span>
      },
    })),
  ]
  return (
    <>
      <Card title="Benchmark" icon="list" padded={false} description="Per-room figures, so properties of any size compare fairly. Best in green.">
        <DataTable columns={cols} rows={metrics} rowKey={(m) => m.key} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="RevPAR" icon="money">
          <Bars rows={properties.map((p) => ({ label: p.name, value: per(p.roomRevenue, p.available) }))} format={ugx} />
        </Card>
        <Card title="Occupancy" icon="occupancy">
          <Bars rows={properties.map((p) => ({ label: p.name, value: occ(p) }))} format={(n) => `${n}%`} />
        </Card>
      </div>
    </>
  )
}

function Budget({ properties, budgets, groupName }: { properties: Figures[]; budgets: Figures[]; groupName: string }) {
  type Row = { id: string; name: string; actual: Figures; budget: Figures }
  const rows: Row[] = properties.map((a) => ({ id: a.id, name: a.name, actual: a, budget: budgets.find((b) => b.id === a.id) ?? total([], a.name) }))
  rows.push({ id: 'all', name: groupName, actual: total(properties, groupName), budget: total(budgets, groupName) })
  const all = rows[rows.length - 1]
  const tone = (n: number) => (n >= 0 ? 'text-good' : 'text-bad')
  const cols: Column<Row>[] = [
    { key: 'name', header: 'Property', cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'rev', header: 'Revenue', align: 'right', cell: (r) => <span className="tabular-nums">{ugx(r.actual.totalRevenue)}</span> },
    { key: 'revb', header: 'Budget', align: 'right', cell: (r) => <span className="tabular-nums text-ink/60">{ugx(r.budget.totalRevenue)}</span>, hideBelow: 'sm' },
    { key: 'revv', header: 'Var.', align: 'right', cell: (r) => <span className={`tabular-nums ${tone(variance(r.actual.totalRevenue, r.budget.totalRevenue))}`}>{signed(variance(r.actual.totalRevenue, r.budget.totalRevenue))}</span> },
    { key: 'gop', header: 'GOP', align: 'right', cell: (r) => <span className="tabular-nums">{ugx(r.actual.gop)}</span>, hideBelow: 'md' },
    { key: 'gopb', header: 'Budget', align: 'right', cell: (r) => <span className="tabular-nums text-ink/60">{ugx(r.budget.gop)}</span>, hideBelow: 'lg' },
    { key: 'gopv', header: 'Var.', align: 'right', cell: (r) => <span className={`tabular-nums ${tone(variance(r.actual.gop, r.budget.gop))}`}>{signed(variance(r.actual.gop, r.budget.gop))}</span>, hideBelow: 'md' },
    { key: 'occ', header: 'Occ. vs budget', align: 'right', cell: (r) => <span className="tabular-nums">{occ(r.actual)}% / {occ(r.budget)}%</span>, hideBelow: 'lg' },
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue vs budget" value={signed(variance(all.actual.totalRevenue, all.budget.totalRevenue))} icon="money" hint={`${ugx(all.actual.totalRevenue)} of ${ugx(all.budget.totalRevenue)}`} tone={variance(all.actual.totalRevenue, all.budget.totalRevenue) >= 0 ? 'good' : 'warn'} />
        <StatCard label="GOP vs budget" value={signed(variance(all.actual.gop, all.budget.gop))} icon="money" hint={ugx(all.actual.gop - all.budget.gop)} tone={variance(all.actual.gop, all.budget.gop) >= 0 ? 'good' : 'warn'} />
        <StatCard label="Occupancy" value={`${occ(all.actual)}%`} icon="occupancy" hint={`Budget ${occ(all.budget)}%`} />
        <StatCard label="ADR" value={ugx(per(all.actual.roomRevenue, all.actual.sold))} icon="bed" hint={`Budget ${ugx(per(all.budget.roomRevenue, all.budget.sold))}`} />
      </div>
      <Card title="Budget vs actual" icon="list" padded={false} actions={<SampleBadge label="Sample budgets" />}>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} />
      </Card>
      <Card title="Revenue variance by property" icon="money">
        <Bars rows={rows.slice(0, -1).map((r) => ({ label: r.name, value: r.actual.totalRevenue - r.budget.totalRevenue, tone: r.actual.totalRevenue >= r.budget.totalRevenue ? 'good' : 'bad' }))} format={ugx} />
      </Card>
    </>
  )
}

function Periods({ range, facts, cost }: { range: Range; facts: ReportFacts; cost: CostProfile | null }) {
  const prev = useMemo(() => compareRange(range, 'previous'), [range])
  const ly = useMemo(() => compareRange(range, 'lastYear'), [range])
  const a = useMemo(() => execKpis(facts, range, cost), [facts, range, cost])
  const b = useMemo(() => execKpis(facts, prev, cost), [facts, prev, cost])
  const c = useMemo(() => execKpis(facts, ly, cost), [facts, ly, cost])

  const months = useMemo(() => {
    const out: { label: string; value: number; compare: number }[] = []
    const first = `${facts.today.slice(0, 8)}01`
    for (let i = 5; i >= 0; i--) {
      const start = new Date(`${first}T00:00:00Z`)
      start.setUTCMonth(start.getUTCMonth() - i)
      const from = start.toISOString().slice(0, 10)
      const end = new Date(start)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const to = i === 0 ? facts.today : addDays(end.toISOString().slice(0, 10), -1)
      const k = execKpis(facts, { from, to }, null)
      const l = execKpis(facts, compareRange({ from, to }, 'lastYear'), null)
      out.push({ label: start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), value: k.totalRevenue, compare: l.totalRevenue })
    }
    return out
  }, [facts])

  type Row = { key: string; label: string; v: (k: ExecKpis) => number; fmt: (n: number) => string }
  const rows: Row[] = [
    { key: 'occ', label: 'Occupancy', v: (k) => k.occupancy, fmt: (n) => `${n}%` },
    { key: 'adr', label: 'ADR', v: (k) => k.adr, fmt: ugx },
    { key: 'revpar', label: 'RevPAR', v: (k) => k.revpar, fmt: ugx },
    { key: 'trevpar', label: 'TRevPAR', v: (k) => k.trevpar, fmt: ugx },
    { key: 'rev', label: 'Total revenue', v: (k) => k.totalRevenue, fmt: ugx },
    { key: 'gop', label: 'GOP (sample costs)', v: (k) => k.gop, fmt: ugx },
    { key: 'cancel', label: 'Cancellations', v: (k) => k.cancellations, fmt: (n) => `${n}` },
    { key: 'cash', label: 'Cash collected', v: (k) => k.cash, fmt: ugx },
  ]
  const delta = (now: number, then: number) => {
    const w = deltaWords(now, then, '')
    return <span className={`text-xs ${w.startsWith('+') ? 'text-good' : w.startsWith('-') ? 'text-bad' : 'text-ink/45'}`}>{w.startsWith('No') ? '—' : w}</span>
  }
  const cols: Column<Row>[] = [
    { key: 'label', header: 'KPI', cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: 'a', header: 'This period', align: 'right', cell: (r) => <span className="tabular-nums font-semibold">{r.fmt(r.v(a))}</span> },
    {
      key: 'b',
      header: 'Previous',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-ink/70">
          {r.fmt(r.v(b))} <span className="block">{delta(r.v(a), r.v(b))}</span>
        </span>
      ),
    },
    {
      key: 'c',
      header: 'Last year',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-ink/70">
          {r.fmt(r.v(c))} <span className="block">{delta(r.v(a), r.v(c))}</span>
        </span>
      ),
    },
  ]
  return (
    <>
      <Card title="Period comparison" icon="list" padded={false} description={`Previous: ${prev.from} to ${prev.to}. Last year: ${ly.from} to ${ly.to}.`}>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.key} />
      </Card>
      <Card title="Revenue by month" icon="money" description="Bars: this year. Grey: same month last year.">
        <ColumnChart points={months} format={ugx} />
      </Card>
    </>
  )
}
