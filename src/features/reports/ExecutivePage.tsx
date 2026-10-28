import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, PageHeader, Segmented, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { reportsService } from '../../services'
import {
  addDays,
  cashPosition,
  channelMix,
  compareRange,
  daysOf,
  drill,
  execKpis,
  paceVsLastYear,
  pickupList,
  rangeFor,
} from '../../services/reports/analytics'
import type { CompareMode, ExecKpis, KpiKey, RangePreset } from '../../services/reports/analytics'
import { daySeries } from '../../lib/dashboard'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { Bars, ColumnChart, DrillPanel } from './ReportsUi'
import { deltaWords, downloadFile, slug, useActor } from './reportsUtils'
import { useCostProfile } from './useReports'
import { useReportFacts } from './useReportFacts'

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'mtd', label: 'Month' },
]

const short = (iso: string) => dayMonth(iso).replace(/ \d{4}$/, '')

type Row = { key: string; label: string; now: string; before: string; change: string; kpi?: KpiKey }

export default function ExecutivePage() {
  const facts = useReportFacts()
  const cost = useCostProfile()
  const { tenant } = useFeatures()
  const { canOpen } = useAuth()
  const actor = useActor()
  const [preset, setPreset] = useState<RangePreset>('7')
  const [mode, setMode] = useState<CompareMode>('previous')
  const [open, setOpen] = useState<{ kpi: KpiKey; segment?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => rangeFor(preset, facts.today), [preset, facts.today])
  const before = useMemo(() => compareRange(range, mode), [range, mode])
  const now = useMemo(() => execKpis(facts, range, cost), [facts, range, cost])
  const then = useMemo(() => execKpis(facts, before, cost), [facts, before, cost])
  const against = mode === 'previous' ? 'vs previous' : 'vs last year'

  const pickup = pickupList(facts)
  const pickupBefore = facts.reservations.filter(
    (r) => r.bookedAt && r.bookedAt > addDays(facts.today, -14) && r.bookedAt <= addDays(facts.today, -7) && r.status !== 'cancelled' && r.status !== 'no-show',
  ).length
  const pace = useMemo(() => paceVsLastYear(facts), [facts])
  const mix = useMemo(() => channelMix(facts, range), [facts, range])
  const cash = useMemo(() => cashPosition(facts, range), [facts, range])

  const chart = useMemo(() => {
    const a = daySeries(daysOf(range), facts.reservations, facts.rooms, facts.sales, facts.today)
    const b = daySeries(daysOf(before), facts.reservations, facts.rooms, facts.sales, facts.today)
    return a.map((p, i) => ({ label: short(p.day), value: p.rooms + p.pos + p.extras, compare: b[i] ? b[i].rooms + b[i].pos + b[i].extras : 0 }))
  }, [range, before, facts])

  const detail = open ? drill(facts, open.kpi, range, cost, open.segment) : null

  async function exportDrill() {
    if (!detail) return
    const head = 'Date,Kind,Record,Name,Detail,Amount (UGX)'
    const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const body = detail.rows.map((r) => [r.date, r.kind, r.ref, r.name, r.detail, r.amount].map(esc).join(','))
    try {
      await reportsService.recordExport(tenant.id, { reportId: null, reportName: `Drill-down: ${detail.title}`, format: 'csv', rowCount: detail.rows.length, trigger: 'download', recipients: [] }, actor)
      downloadFile(`${slug(detail.title)}-${range.from}-${range.to}.csv`, [head, ...body].join('\r\n'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export')
    }
  }

  const tile = (kpi: KpiKey, label: string, value: string, hint: string, icon: Parameters<typeof StatCard>[0]['icon'], tone: 'default' | 'warn' | 'bad' | 'good' = 'default') => (
    <StatCard key={kpi} label={label} value={value} hint={hint} icon={icon} tone={tone} onClick={() => setOpen({ kpi })} />
  )

  const pct = (k: ExecKpis) => `${k.occupancy}%`
  const rows: Row[] = [
    { key: 'occ', label: 'Occupancy', now: pct(now), before: pct(then), change: deltaWords(now.occupancy, then.occupancy, ''), kpi: 'occupancy' },
    { key: 'adr', label: 'ADR', now: ugx(now.adr), before: ugx(then.adr), change: deltaWords(now.adr, then.adr, ''), kpi: 'adr' },
    { key: 'revpar', label: 'RevPAR', now: ugx(now.revpar), before: ugx(then.revpar), change: deltaWords(now.revpar, then.revpar, ''), kpi: 'revpar' },
    { key: 'trevpar', label: 'TRevPAR', now: ugx(now.trevpar), before: ugx(then.trevpar), change: deltaWords(now.trevpar, then.trevpar, ''), kpi: 'trevpar' },
    { key: 'rooms', label: 'Room revenue', now: ugx(now.roomRevenue), before: ugx(then.roomRevenue), change: deltaWords(now.roomRevenue, then.roomRevenue, ''), kpi: 'occupancy' },
    { key: 'total', label: 'Total revenue', now: ugx(now.totalRevenue), before: ugx(then.totalRevenue), change: deltaWords(now.totalRevenue, then.totalRevenue, ''), kpi: 'trevpar' },
    { key: 'gop', label: 'GOP', now: ugx(now.gop), before: ugx(then.gop), change: deltaWords(now.gop, then.gop, ''), kpi: 'gop' },
    { key: 'cancel', label: 'Cancellations', now: `${now.cancellations}`, before: `${then.cancellations}`, change: deltaWords(now.cancellations, then.cancellations, ''), kpi: 'cancellations' },
    { key: 'cash', label: 'Cash collected', now: ugx(now.cash), before: ugx(then.cash), change: deltaWords(now.cash, then.cash, ''), kpi: 'cash' },
  ]
  const columns: Column<Row>[] = [
    { key: 'label', header: 'KPI', cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: 'now', header: 'This period', align: 'right', cell: (r) => <span className="tabular-nums font-semibold">{r.now}</span> },
    { key: 'before', header: mode === 'previous' ? 'Previous' : 'Last year', align: 'right', cell: (r) => <span className="tabular-nums text-ink/65">{r.before}</span> },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      cell: (r) => <span className={`tabular-nums ${r.change.startsWith('+') ? 'text-good' : r.change.startsWith('-') ? 'text-bad' : 'text-ink/45'}`}>{r.change.replace('No figure ', '—')}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Executive"
        description={`${tenant.name}. Click any figure to see the records behind it.`}
        meta={<Badge tone="neutral">{range.from === range.to ? range.from : `${range.from} to ${range.to}`}</Badge>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<RangePreset> label="Period" value={preset} onChange={setPreset} options={PRESETS} />
        <Segmented<CompareMode>
          label="Compare with"
          value={mode}
          onChange={setMode}
          options={[
            { key: 'previous', label: 'Previous' },
            { key: 'lastYear', label: 'Last year' },
          ]}
        />
      </div>

      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tile('occupancy', 'Occupancy', `${now.occupancy}%`, deltaWords(now.occupancy, then.occupancy, against), 'occupancy')}
        {tile('adr', 'ADR', ugx(now.adr), deltaWords(now.adr, then.adr, against), 'bed')}
        {tile('revpar', 'RevPAR', ugx(now.revpar), deltaWords(now.revpar, then.revpar, against), 'list')}
        {tile('trevpar', 'TRevPAR', ugx(now.trevpar), deltaWords(now.trevpar, then.trevpar, against), 'money')}
        {tile('gop', 'GOP', ugx(now.gop), `${now.gopMargin}% margin · sample costs`, 'money', now.gop < 0 ? 'bad' : 'default')}
        {tile('goppar', 'GOPPAR', ugx(now.goppar), deltaWords(now.goppar, then.goppar, against), 'money')}
        {tile('pickup', 'Pickup, 7 days', `${pickup.length}`, deltaWords(pickup.length, pickupBefore, 'vs week before'), 'arrival')}
        {tile('pace', 'Pace, next 30 nights', `${pace.onBooks} nights`, pace.lastYear ? deltaWords(pace.onBooks, pace.lastYear, 'vs last year') : 'No history a year ago', 'calendar')}
        {tile('cancellations', 'Cancellations', `${now.cancellations}`, deltaWords(now.cancellations, then.cancellations, against), 'alert', now.cancellations > 0 ? 'warn' : 'default')}
        {tile('cash', 'Cash collected', ugx(cash.collected), `Owed ${ugx(cash.guestDebt)}`, 'money', cash.guestDebt > 0 ? 'warn' : 'default')}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue by day" icon="money" description={`Bars: this period. Grey: ${mode === 'previous' ? 'previous period' : 'last year'}.`}>
          <ColumnChart points={chart} format={ugx} />
          {facts.salesAreSample && <p className="mt-2 text-xs text-warn">F&B uses sample till history until the till records sales.</p>}
        </Card>
        <Card title="Channel mix" icon="guests" description="Room nights by where the booking came from.">
          <Bars
            rows={mix.map((m) => ({ label: m.label, value: m.nights, hint: `${m.share}% · ${ugx(m.revenue)}`, onClick: () => setOpen({ kpi: 'channel', segment: m.label }) }))}
            format={(n) => `${n} nights`}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cash position" icon="money" actions={<button type="button" onClick={() => setOpen({ kpi: 'cash' })} className="text-sm font-semibold text-brand hover:underline">Payments</button>}>
          <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink/55">Collected</dt>
              <dd className="font-semibold tabular-nums">{ugx(cash.collected)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/55">Guests owe</dt>
              <dd className="font-semibold tabular-nums text-bad">{ugx(cash.guestDebt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/55">Companies owe</dt>
              <dd className="font-semibold tabular-nums">{ugx(cash.companyDebt)}</dd>
            </div>
          </dl>
          <Bars rows={cash.bands.map((b) => ({ label: b.label, value: b.amount, hint: `${b.count}`, tone: b.label === 'Over 30 days' ? 'bad' : b.label === 'In the house' ? 'brand' : 'warn' }))} format={ugx} />
        </Card>
        <Card title="Period comparison" icon="list" padded={false} description={mode === 'previous' ? `Against ${before.from} to ${before.to}` : `Against ${before.from} to ${before.to}, last year`}>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} onRowClick={(r) => r.kpi && setOpen({ kpi: r.kpi })} />
        </Card>
      </div>

      {open && detail && (
        <DrillPanel
          title={detail.title}
          description={open.kpi === 'pickup' ? 'Bookings taken in the last 7 days' : open.kpi === 'pace' ? `${facts.today} to ${addDays(facts.today, 29)}` : `${range.from} to ${range.to}`}
          rows={detail.rows}
          canOpen={canOpen}
          onClose={() => setOpen(null)}
          onExport={exportDrill}
        />
      )}
    </div>
  )
}
