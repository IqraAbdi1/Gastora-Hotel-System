import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Modal, PageHeader, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dayMonth } from '../../lib/format'
import { DAY_SHORT, dayOf } from '../../lib/rateCalendar'
import { automationService } from '../../services'
import type { Department, PriorityScore, StaffingForecast } from '../../services/automation/automationTypes'
import { useHousekeeping } from '../housekeeping/hkContext'
import { useFeatures } from '../platform/featuresContext'
import { DecisionButtons, Drivers, ErrorLine, Reasons, ReasonDialog } from './automationUi'
import { useActor, useAutomationData, useAutomationSnapshot, useRefresh, useRun } from './useAutomation'

type Tab = 'housekeeping' | 'maintenance' | 'staffing'
const DEPTS: Department[] = ['Housekeeping', 'Front desk', 'Food and drink', 'Maintenance']
const night = (d: string) => `${DAY_SHORT[dayOf(d)]} ${dayMonth(d)}`

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${score >= 60 ? 'bg-bad' : score >= 35 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-ink/70">{score}</span>
    </div>
  )
}

export default function OperationsPage() {
  const { tenant } = useFeatures()
  const pid = tenant.id
  const snapshot = useAutomationSnapshot()
  const refreshError = useRefresh(automationService.refreshOperations, snapshot)
  const { data: scores } = useAutomationData(() => automationService.listPriorityScores(pid), [], [pid])
  const { data: staffing } = useAutomationData(() => automationService.listStaffing(pid), [], [pid])
  const [tab, setTab] = useState<Tab>('housekeeping')

  const hk = scores.filter((s) => s.area === 'housekeeping' && s.key.includes(snapshot.today))
  const mt = scores.filter((s) => s.area === 'maintenance')
  const arrivals = hk.filter((s) => s.reasons.some((r) => r.includes('arrives today'))).length
  const days = useMemo(() => [...new Set(staffing.map((s) => s.date))].sort(), [staffing])
  const peak = days
    .map((d) => ({ d, n: staffing.filter((s) => s.date === d).reduce((a, b) => a + b.staffNeeded, 0) }))
    .sort((a, b) => b.n - a.n)[0]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Automation" title="Operations" description="What to clean and fix first, and the people each department needs." />
      <ErrorLine error={refreshError} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rooms in the cleaning order" icon="clean" value={hk.filter((s) => s.status !== 'dismissed').length} hint={`${arrivals} with a guest arriving`} onClick={() => setTab('housekeeping')} active={tab === 'housekeeping'} />
        <StatCard
          label="Repairs ranked"
          icon="alert"
          value={mt.filter((s) => s.status === 'open').length}
          hint={`${mt.filter((s) => s.score >= 60 && s.status === 'open').length} scoring 60 or more`}
          tone={mt.some((s) => s.score >= 60 && s.status === 'open') ? 'warn' : 'default'}
          onClick={() => setTab('maintenance')}
          active={tab === 'maintenance'}
        />
        <StatCard label="Busiest day ahead" icon="calendar" value={peak ? night(peak.d) : '—'} hint={peak ? `${peak.n} people across departments` : undefined} onClick={() => setTab('staffing')} active={tab === 'staffing'} />
        <StatCard label="Staffing plans accepted" icon="check" value={`${days.filter((d) => staffing.filter((s) => s.date === d).every((s) => s.status === 'accepted')).length}/${days.length}`} hint="Days in the next two weeks" />
      </div>

      <Tabs<Tab>
        label="Operations"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'housekeeping', label: 'Cleaning order', count: hk.length },
          { key: 'maintenance', label: 'Repair priority', count: mt.filter((s) => s.status === 'open').length },
          { key: 'staffing', label: 'Staffing forecast' },
        ]}
      />

      {tab === 'housekeeping' && <PriorityList scores={hk} area="housekeeping" />}
      {tab === 'maintenance' && <PriorityList scores={mt} area="maintenance" />}
      {tab === 'staffing' && <Staffing rows={staffing} days={days} />}
    </div>
  )
}

function PriorityList({ scores, area }: { scores: PriorityScore[]; area: 'housekeeping' | 'maintenance' }) {
  const hk = useHousekeeping()
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [rushing, setRushing] = useState<PriorityScore | null>(null)
  const list = [...scores].sort((a, b) => Number(a.status === 'dismissed') - Number(b.status === 'dismissed') || a.rank - b.rank)

  function accept(s: PriorityScore) {
    if (!actor) return
    let ref: string | undefined
    if (area === 'maintenance' && s.state === 'Open') {
      hk.requestMaintenance(s.room, Number(s.subjectId))
      ref = 'Sent to maintenance'
    }
    void run(() => automationService.decidePriority(s.id, true, '', actor, ref))
  }

  return (
    <Card
      title={area === 'housekeeping' ? 'Suggested cleaning order' : 'Repair priority'}
      icon={area === 'housekeeping' ? 'clean' : 'alert'}
      count={list.length}
      description={area === 'housekeeping' ? 'Arrivals first, then VIPs, early check-ins and rushed rooms.' : 'Rooms off sale, guests affected and late repairs first.'}
    >
      <ErrorLine error={error} />
      {list.length === 0 ? (
        <EmptyState title={area === 'housekeeping' ? 'No rooms waiting to be cleaned' : 'No open repairs'} />
      ) : (
        <ol className="divide-y divide-ink/8">
          {list.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0 ${s.status === 'dismissed' ? 'opacity-60' : ''}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">{s.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{area === 'housekeeping' ? s.subject : `Room ${s.room}`}</p>
                  <ScoreBar score={s.score} />
                  <Badge tone="neutral">{s.label}</Badge>
                  {area === 'maintenance' && s.state && <span className="text-xs text-ink/55">{s.state}</span>}
                </div>
                {area === 'maintenance' && <p className="mt-0.5 text-sm text-ink/70">{s.subject}</p>}
                <Reasons reasons={s.reasons.filter((r) => r !== s.label.split(' · ')[0])} />
              </div>
              <div className="w-full sm:w-auto">
                <DecisionButtons
                  item={s}
                  busy={busy}
                  acceptLabel={area === 'maintenance' && s.state === 'Open' ? 'Accept, send to maintenance' : 'Accept'}
                  onAccept={() => accept(s)}
                  onDismiss={(reason) => actor && run(() => automationService.decidePriority(s.id, false, reason, actor))}
                  extra={
                    area === 'housekeeping' && s.reasons.some((r) => r.includes('arrives today')) && !s.reasons.includes('Rushed by the front desk') ? (
                      <Button size="sm" variant="secondary" onClick={() => setRushing(s)} disabled={busy}>
                        Rush
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {rushing && (
        <ReasonDialog
          title={`Rush room ${rushing.room}`}
          label="Note for housekeeping"
          optional
          confirm="Rush"
          onCancel={() => setRushing(null)}
          onConfirm={(note) => {
            hk.rushRoom(rushing.room, note || 'Guest arriving, prioritised by automation')
            if (actor) void run(() => automationService.decidePriority(rushing.id, true, note, actor, 'Room rushed'))
            setRushing(null)
          }}
        />
      )}
    </Card>
  )
}

function Staffing({ rows, days }: { rows: StaffingForecast[]; days: string[] }) {
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [day, setDay] = useState<string | null>(null)
  type Row = { date: string; items: StaffingForecast[] }
  const table: Row[] = days.map((d) => ({ date: d, items: rows.filter((r) => r.date === d) }))
  const cell = (r: Row, dep: Department) => r.items.find((i) => i.department === dep)

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: 'Day',
      cell: (r) => (
        <div>
          <p className="font-semibold text-ink">{night(r.date)}</p>
          <p className="text-xs text-ink/55">
            {r.items[0]?.forecastRooms ?? 0} room{r.items[0]?.forecastRooms === 1 ? '' : 's'} · {r.items[0]?.occupancyPct ?? 0}%
          </p>
        </div>
      ),
    },
    ...DEPTS.map(
      (dep): Column<Row> => ({
        key: dep,
        header: dep,
        align: 'right',
        hideBelow: dep === 'Maintenance' ? 'md' : dep === 'Food and drink' ? 'sm' : undefined,
        cell: (r) => {
          const c = cell(r, dep)
          return c ? (
            <span className="tabular-nums">
              <span className="font-semibold text-ink">{c.staffNeeded}</span> <span className="text-xs text-ink/50">{c.hoursNeeded} h</span>
            </span>
          ) : (
            '—'
          )
        },
      }),
    ),
    {
      key: 'state',
      header: '',
      align: 'right',
      cell: (r) => {
        const done = r.items.filter((i) => i.status !== 'open').length
        return done === r.items.length && r.items.length ? (
          <Badge tone={r.items.every((i) => i.status === 'accepted') ? 'good' : 'neutral'}>{r.items.every((i) => i.status === 'accepted') ? 'Accepted' : 'Decided'}</Badge>
        ) : (
          <Badge tone="warn">To review</Badge>
        )
      },
    },
  ]
  const open = table.find((r) => r.date === day)

  return (
    <Card title="Staffing forecast" icon="guests" count={days.length} padded={false} description="People per department, from the occupancy forecast. Tap a day to review.">
      <DataTable columns={columns} rows={table} rowKey={(r) => r.date} onRowClick={(r) => setDay(r.date)} empty={{ title: 'No forecast yet' }} />
      {open && (
        <Modal side title={night(open.date)} description={`${open.items[0]?.forecastRooms ?? 0} rooms forecast, ${open.items[0]?.arrivals ?? 0} arrivals, ${open.items[0]?.departures ?? 0} departures`} onClose={() => setDay(null)}>
          <ErrorLine error={error} />
          <ul className="space-y-4">
            {open.items.map((i) => (
              <li key={i.id} className="rounded-xl border border-ink/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{i.department}</p>
                  <p className="text-sm tabular-nums">
                    <span className="text-lg font-bold text-ink">{i.staffNeeded}</span> people · {i.hoursNeeded} h
                  </p>
                </div>
                <Drivers drivers={i.drivers} />
                <div className="mt-2">
                  <DecisionButtons
                    item={i}
                    busy={busy}
                    onAccept={() => actor && run(() => automationService.decideStaffing(i.id, true, '', actor))}
                    onDismiss={(reason) => actor && run(() => automationService.decideStaffing(i.id, false, reason, actor))}
                  />
                </div>
              </li>
            ))}
          </ul>
          {open.items.some((i) => i.status === 'open') && (
            <div className="mt-4">
              <Button
                disabled={busy}
                onClick={() => {
                  if (!actor) return
                  void run(async () => {
                    for (const i of open.items.filter((x) => x.status === 'open')) await automationService.decideStaffing(i.id, true, 'Accepted for the whole day', actor)
                  })
                }}
              >
                Accept the whole day
              </Button>
            </div>
          )}
        </Modal>
      )}
    </Card>
  )
}
