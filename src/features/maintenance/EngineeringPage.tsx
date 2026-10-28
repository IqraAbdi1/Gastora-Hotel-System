import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, EmptyState, MoneyBars, PageHeader, Pager, Segmented, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonthYear, ugx } from '../../lib/format'
import {
  HEAVY_SHARE,
  PERIOD_LABEL,
  costPerAsset,
  engineeringTotals,
  jobsIn,
  recurring,
  repairsIn,
  startOf,
  unattributed,
  workHistory,
} from '../../lib/engineering'
import type { AssetCost, Period, Recurring, WorkRow } from '../../lib/engineering'
import { useNow } from '../../lib/useNow'
import { useAssets } from '../assets/useAssets'
import { usePreventive } from '../assets/usePreventive'
import { useHousekeeping } from '../housekeeping/hkContext'
import { useFeatures } from '../platform/featuresContext'
import { useRoomOverlays } from '../housekeeping/useRoomOverlays'

const PAGE = 15

export default function EngineeringPage() {
  const { assets } = useAssets()
  const { jobs } = usePreventive()
  const hk = useHousekeeping()
  const { stayTimes, features } = useFeatures()
  const { overlays, openRoom } = useRoomOverlays()
  const now = useNow(60000)
  const [period, setPeriod] = useState<Period>(90)
  const [page, setPage] = useState(0)

  const from = startOf(period, TODAY)
  const repairs = useMemo(() => repairsIn(hk.allDefects, from), [hk.allDefects, from])
  const periodJobs = useMemo(() => jobsIn(jobs, from), [jobs, from])

  const costs = useMemo(
    () => costPerAsset(assets, repairs, periodJobs, hk.spells, stayTimes.checkInTime, TODAY, now),
    [assets, repairs, periodJobs, hk.spells, stayTimes.checkInTime, now],
  )
  const repeats = useMemo(() => recurring(repairs), [repairs])
  const history = useMemo(() => workHistory(repairs, periodJobs, assets), [repairs, periodJobs, assets])
  const totals = engineeringTotals(history, costs)

  const shown = history.slice(page * PAGE, page * PAGE + PAGE)
  const loose = unattributed(history)
  const spenders = costs.filter((c) => c.spent > 0).slice(0, 6)

  const costColumns: Column<AssetCost>[] = [
    {
      key: 'asset',
      header: 'Machine',
      cell: (c) => (
        <>
          <p className="font-semibold text-ink">{c.asset.tag}</p>
          <p className="text-xs text-ink/60">
            {c.asset.name} · {c.asset.where}
          </p>
        </>
      ),
    },
    { key: 'repairs', header: 'Repairs', align: 'right', hideBelow: 'sm', cell: (c) => <span className="tabular-nums">{c.repairs}</span> },
    { key: 'services', header: 'Services', align: 'right', hideBelow: 'md', cell: (c) => <span className="tabular-nums">{c.services}</span> },
    {
      key: 'nights',
      header: 'Nights lost',
      align: 'right',
      hideBelow: 'lg',
      cell: (c) => <span className="tabular-nums text-ink/70">{c.nightsLost || '—'}</span>,
    },
    { key: 'spent', header: 'Spent on parts', align: 'right', cell: (c) => <span className="tabular-nums font-semibold">{c.spent > 0 ? ugx(c.spent) : '—'}</span> },
    {
      key: 'worth',
      header: 'Against its value',
      align: 'right',
      hideBelow: 'xl',
      cell: (c) =>
        c.share === undefined ? (
          <span className="text-ink/50">—</span>
        ) : (
          <>
            <span className="tabular-nums text-ink/70">{Math.round(c.share * 100)}%</span>
            {c.share > HEAVY_SHARE && <p className="text-xs font-medium text-warn">Worth a look</p>}
          </>
        ),
    },
  ]

  const repeatColumns: Column<Recurring>[] = [
    {
      key: 'where',
      header: 'Where',
      cell: (r) =>
        /^\d/.test(r.where) ? (
          <button type="button" onClick={() => openRoom(r.where, 'defects')} className="font-semibold text-ink hover:text-brand">
            Room {r.where}
          </button>
        ) : (
          <span className="font-semibold text-ink">{r.where}</span>
        ),
    },
    { key: 'what', header: 'Fault', cell: (r) => <span className="text-ink/70">{r.category}</span> },
    { key: 'times', header: 'Times', align: 'right', cell: (r) => <Badge tone={r.times >= 4 ? 'bad' : 'warn'}>{r.times}</Badge> },
    {
      key: 'last',
      header: 'Last one',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className="text-ink/70">{r.lastOn ? dayMonthYear(r.lastOn) : '—'}</span>,
    },
  ]

  const historyColumns: Column<WorkRow>[] = [
    { key: 'day', header: 'When', cell: (r) => <span className="text-ink/70">{r.day ? dayMonthYear(r.day) : 'Not recorded'}</span> },
    { key: 'kind', header: 'Kind', cell: (r) => <Badge tone={r.kind === 'service' ? 'info' : 'neutral'}>{r.kind === 'service' ? 'Service' : 'Repair'}</Badge> },
    { key: 'where', header: 'Where', hideBelow: 'sm', cell: (r) => <span className="text-ink/70">{r.where}</span> },
    { key: 'what', header: 'Work', cell: (r) => <span className="text-ink">{r.what}</span> },
    {
      key: 'took',
      header: 'Took',
      align: 'right',
      hideBelow: 'lg',
      cell: (r) => <span className="tabular-nums text-ink/70">{r.tookDays === undefined ? '—' : `${r.tookDays} d`}</span>,
    },
    { key: 'spent', header: 'Parts', align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular-nums text-ink/70">{r.spent > 0 ? ugx(r.spent) : '—'}</span> },
    { key: 'status', header: 'Status', align: 'right', cell: (r) => <span className="text-xs text-ink/60">{r.status}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Maintenance"
        title="Engineering"
        description="Repeat faults, running costs and machine history."
        actions={
          <Segmented
            label="Period"
            value={String(period) as '30' | '90' | '365'}
            onChange={(v) => {
              setPeriod(Number(v) as Period)
              setPage(0)
            }}
            options={[
              { key: '30', label: '30 days' },
              { key: '90', label: '90 days' },
              { key: '365', label: 'Year' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Repairs" icon="alert" value={String(totals.repairs)} hint={PERIOD_LABEL[period]} />
        <StatCard
          label="Average to close"
          icon="calendar"
          value={totals.averageDays === undefined ? '—' : `${totals.averageDays.toFixed(1)} d`}
          hint="Reported to closed"
        />
        <StatCard label="Spent on parts" icon="money" value={ugx(totals.spent)} hint="Issued by the store" />
        <StatCard
          label="Costing too much"
          icon="alert"
          value={String(totals.heavy)}
          hint={`Over ${Math.round(HEAVY_SHARE * 100)}% of what they are worth`}
          tone={totals.heavy > 0 ? 'warn' : 'default'}
        />
      </div>

      <Card
        title="The same fault again"
        icon="alert"
        count={repeats.length}
        description="Three of the same fault in one place."
        padded={false}
      >
        {repeats.length === 0 ? (
          <EmptyState
            title="Nothing is repeating"
            hint={`No repeat faults in the ${PERIOD_LABEL[period].toLowerCase()}.`}
          />
        ) : (
          <DataTable columns={repeatColumns} rows={repeats} rowKey={(r) => `${r.where}-${r.category}`} />
        )}
      </Card>

      {features.assetCosts && (spenders.length > 0 || loose > 0) && (
        <Card title="What each machine has cost" icon="money" description="Parts the store issued, in this period.">
          <MoneyBars
            rows={[
              ...spenders.map((c) => ({
                label: `${c.asset.tag} · ${c.asset.name}`,
                amount: c.spent,
                count: c.repairs + c.services,
                tone: ((c.share ?? 0) > HEAVY_SHARE ? 'warn' : 'brand') as 'warn' | 'brand',
              })),
              ...(loose > 0 ? [{ label: 'Not against any machine', amount: loose }] : []),
            ]}
          />
        </Card>
      )}

      {features.assetCosts && (
        <Card
          title="Cost to keep"
          icon="list"
          count={costs.length}
          description="Parts from the store only. Labour is not counted."
          padded={false}
        >
          <DataTable
            columns={costColumns}
            rows={costs.filter((c) => c.repairs + c.services > 0 || c.spent > 0)}
            rowKey={(c) => c.asset.id}
            empty={{ title: 'Nothing spent yet', hint: 'A repair that draws parts from the store shows up here.' }}
          />
          {loose > 0 && (
            <p className="border-t border-ink/10 px-4 py-3 text-sm text-ink/70">
              <span className="font-semibold text-ink">{ugx(loose)}</span> went on work that named no machine.
            </p>
          )}
        </Card>
      )}

      <Card title="Everything that was done" icon="list" count={history.length} padded={false}>
        <DataTable
          columns={historyColumns}
          rows={shown}
          rowKey={(r) => r.id}
          empty={{ title: 'No work in this period', hint: 'Try a longer period.' }}
        />
        <Pager page={page} total={history.length} perPage={PAGE} onPage={setPage} noun="jobs" />
      </Card>

      {overlays}
    </div>
  )
}
