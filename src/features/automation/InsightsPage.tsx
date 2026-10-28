import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Badge, Button, Card, Chip, DataTable, EmptyState, Modal, PageHeader, Segmented, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dateTime, dayMonth, ugx } from '../../lib/format'
import { DAY_SHORT, dayOf, newOverrideId } from '../../lib/rateCalendar'
import type { RateOverride } from '../../lib/rateCalendar'
import { automationService } from '../../services'
import type { Anomaly, AnomalyActionKind, AnomalyKind, Forecast, Recommendation } from '../../services/automation/automationTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { DecisionButtons, Drivers, ErrorLine, ReasonDialog, SeverityBadge } from './automationUi'
import { useActor, useAutomationData, useAutomationSnapshot, useRefresh, useRun } from './useAutomation'

type Tab = 'forecast' | 'rates' | 'anomalies'

const KIND_LABEL: Record<AnomalyKind, string> = {
  leakage: 'Revenue leakage',
  discount: 'Discounts',
  refund: 'Refunds',
  void: 'Voids',
  posting: 'Unusual postings',
}
const CONF_TONE = { high: 'good', medium: 'info', low: 'neutral' } as const
const night = (d: string) => `${DAY_SHORT[dayOf(d)]} ${dayMonth(d)}`

export default function InsightsPage() {
  const { tenant, options, setOptions, features } = useFeatures()
  const { canOpen } = useAuth()
  const snapshot = useAutomationSnapshot()
  const refreshError = useRefresh(automationService.refreshInsights, snapshot)
  const pid = tenant.id
  const { data: forecasts } = useAutomationData(() => automationService.listForecasts(pid), [], [pid])
  const { data: recs } = useAutomationData(() => automationService.listRecommendations(pid), [], [pid])
  const { data: anomalies } = useAutomationData(() => automationService.listAnomalies(pid), [], [pid])
  const { data: actions } = useAutomationData(() => automationService.listAnomalyActions(pid), [], [pid])
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [tab, setTab] = useState<Tab>('forecast')
  const [openNight, setOpenNight] = useState<Forecast | null>(null)

  const open = anomalies.filter((a) => a.status === 'open')
  const atRisk = open.reduce((n, a) => n + (a.amount ?? 0), 0)
  const openRecs = recs.filter((r) => r.status === 'open')
  const avg = forecasts.length ? Math.round(forecasts.reduce((n, f) => n + f.occupancyPct, 0) / forecasts.length) : 0
  const onBooks = forecasts.length ? Math.round((forecasts.reduce((n, f) => n + f.onBooks, 0) / Math.max(1, forecasts.reduce((n, f) => n + f.sellable, 0))) * 100) : 0
  const showRateLink = features.revenue && canOpen('/admin/revenue')

  function acceptRate(r: Recommendation) {
    if (!actor) return
    const rates = options.rates
    const override: RateOverride = {
      id: newOverrideId(rates.overrides ?? []),
      date: r.date,
      type: r.roomType as RateOverride['type'],
      rate: r.suggestedRate,
      by: actor.name,
      at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      note: r.drivers.map((d) => d.text).join(' '),
    }
    void run(
      () => automationService.decideRecommendation(r.id, true, '', actor, `Price set to ${ugx(r.suggestedRate)}`),
      () => setOptions({ rates: { ...rates, overrides: [...(rates.overrides ?? []), override] } }),
    )
  }

  const columns: Column<Forecast>[] = [
    {
      key: 'night',
      header: 'Night',
      cell: (f) => (
        <div>
          <p className="font-semibold text-ink">{night(f.date)}</p>
          <p className="text-xs text-ink/55">{f.daysOut === 0 ? 'Tonight' : `${f.daysOut} day${f.daysOut === 1 ? '' : 's'} out`}</p>
        </div>
      ),
    },
    { key: 'books', header: 'On the books', align: 'right', cell: (f) => <span className="tabular-nums">{f.onBooks}/{f.sellable}</span> },
    {
      key: 'pickup',
      header: 'Pickup',
      align: 'right',
      hideBelow: 'sm',
      cell: (f) => <span className={`tabular-nums ${f.pickup ? 'font-semibold text-good' : 'text-ink/45'}`}>{f.pickup ? `+${f.pickup}` : '—'}</span>,
    },
    {
      key: 'forecast',
      header: 'Forecast',
      align: 'right',
      cell: (f) => (
        <span className="tabular-nums font-semibold text-ink">
          {f.forecastRooms} <span className="text-xs font-normal text-ink/55">{f.occupancyPct}%</span>
        </span>
      ),
    },
    { key: 'conf', header: 'Confidence', align: 'right', hideBelow: 'sm', cell: (f) => <Badge tone={CONF_TONE[f.confidence]}>{f.confidence}</Badge> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Automation" title="Insights" description={`${tenant.name}. Demand ahead, rate suggestions and records worth a second look.`} />
      <ErrorLine error={refreshError ?? error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Forecast, 30 nights" icon="occupancy" value={`${avg}%`} hint={`${onBooks}% on the books now`} onClick={() => setTab('forecast')} active={tab === 'forecast'} />
        <StatCard label="Rate suggestions" icon="money" value={openRecs.length} hint="Waiting for a decision" onClick={() => setTab('rates')} active={tab === 'rates'} />
        <StatCard
          label="Open anomalies"
          icon="alert"
          value={open.length}
          hint={`${open.filter((a) => a.severity === 'high').length} high`}
          tone={open.some((a) => a.severity === 'high') ? 'bad' : open.length ? 'warn' : 'default'}
          onClick={() => setTab('anomalies')}
          active={tab === 'anomalies'}
        />
        <StatCard label="Money at risk" icon="money" value={ugx(atRisk)} hint="Across open anomalies" tone={atRisk > 0 ? 'warn' : 'default'} />
      </div>

      <Tabs<Tab>
        label="Insights"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'forecast', label: 'Demand forecast' },
          { key: 'rates', label: 'Rate suggestions', count: openRecs.length },
          { key: 'anomalies', label: 'Anomalies', count: open.length, alert: open.some((a) => a.severity === 'high') },
        ]}
      />

      {tab === 'forecast' && (
        <>
          <Card title="Forecast occupancy" icon="occupancy" description="Next 30 nights, from on-the-books and pace.">
            <AreaChart suffix="%" points={forecasts.map((f) => ({ label: dayMonth(f.date), value: f.occupancyPct, hint: `${f.onBooks} on books` }))} />
          </Card>
          <Card title="Night by night" icon="calendar" count={forecasts.length} padded={false} description="Tap a night to see why.">
            <DataTable columns={columns} rows={forecasts} rowKey={(f) => f.id} onRowClick={setOpenNight} empty={{ title: 'No nights to forecast' }} />
          </Card>
        </>
      )}

      {tab === 'rates' && (
        <Card
          title="Rate suggestions"
          icon="money"
          count={openRecs.length}
          actions={
            showRateLink ? (
              <Link to="/admin/revenue" className="text-sm font-semibold text-brand">
                Open rate advice
              </Link>
            ) : undefined
          }
        >
          {recs.length === 0 ? (
            <EmptyState title="No rate changes suggested" hint="Every night is filling as usual." />
          ) : (
            <ul className="divide-y divide-ink/8">
              {[...recs].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || a.date.localeCompare(b.date)).map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {night(r.date)} · {r.roomType}
                        <Badge tone={r.direction === 'raise' ? 'good' : 'warn'}>{r.direction === 'raise' ? 'Ask more' : 'Ask less'}</Badge>
                      </p>
                      <p className="mt-0.5 text-sm tabular-nums text-ink/70">
                        {ugx(r.currentRate)} → <span className="font-semibold text-ink">{ugx(r.suggestedRate)}</span>
                      </p>
                    </div>
                    <DecisionButtons
                      item={r}
                      busy={busy}
                      acceptLabel="Set this price"
                      onAccept={() => acceptRate(r)}
                      onDismiss={(reason) => actor && run(() => automationService.decideRecommendation(r.id, false, reason, actor))}
                    />
                  </div>
                  <Drivers drivers={r.drivers} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'anomalies' && <AnomalyFeed anomalies={anomalies} actions={actions} />}

      {openNight && (
        <Modal title={night(openNight.date)} description={`${openNight.forecastRooms} of ${openNight.sellable} rooms forecast`} onClose={() => setOpenNight(null)}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['On the books', openNight.onBooks],
              ['Picked up', openNight.pickup],
              ['Forecast', `${openNight.occupancyPct}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-canvas p-2">
                <p className="text-xs text-ink/55">{l}</p>
                <p className="text-lg font-bold tabular-nums text-ink">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">Why</p>
          <Drivers drivers={openNight.drivers} />
        </Modal>
      )}
    </div>
  )
}

function AnomalyFeed({ anomalies, actions }: { anomalies: Anomaly[]; actions: { id: string; anomalyId: string; action: string; note: string; by: { name: string }; at: string }[] }) {
  const actor = useActor()
  const { run, busy, error, setError } = useRun()
  const [kind, setKind] = useState<AnomalyKind | 'all'>('all')
  const [view, setView] = useState<'open' | 'handled'>('open')
  const [asking, setAsking] = useState<{ a: Anomaly; action: AnomalyActionKind } | null>(null)

  const inView = anomalies.filter((a) => (view === 'open' ? a.status === 'open' || a.status === 'case' : a.status === 'dismissed' || a.status === 'resolved'))
  const shown = inView.filter((a) => kind === 'all' || a.kind === kind)
  const count = (k: AnomalyKind) => inView.filter((a) => a.kind === k).length
  const history = useMemo(() => {
    const m = new Map<string, typeof actions>()
    for (const x of actions) m.set(x.anomalyId, [...(m.get(x.anomalyId) ?? []), x])
    return m
  }, [actions])

  const act = (a: Anomaly, action: AnomalyActionKind, note = '') => actor && run(() => automationService.actOnAnomaly(a.id, action, note, actor), () => setAsking(null))

  const DIALOG: Record<string, { title: string; label: string; confirm: string; optional: boolean }> = {
    dismiss: { title: 'Dismiss anomaly', label: 'Why is it fine?', confirm: 'Dismiss', optional: false },
    'open-case': { title: 'Open a case', label: 'Note for whoever investigates', confirm: 'Open case', optional: true },
    notify: { title: 'Tell the front desk', label: 'Message', confirm: 'Send', optional: true },
    resolve: { title: 'Close the case', label: 'What was found?', confirm: 'Close case', optional: false },
  }

  return (
    <Card title="Anomaly feed" icon="alert" count={shown.length} actions={<Segmented label="Show" value={view} onChange={setView} options={[{ key: 'open', label: 'Open' }, { key: 'handled', label: 'Handled' }]} />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip active={kind === 'all'} onClick={() => setKind('all')} count={inView.length}>
          All
        </Chip>
        {(Object.keys(KIND_LABEL) as AnomalyKind[]).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)} count={count(k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </div>
      <ErrorLine error={asking ? null : error} />
      {shown.length === 0 ? (
        <EmptyState title={view === 'open' ? 'Nothing needs a look' : 'Nothing handled yet'} />
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => (
            <li key={a.id} className={`rounded-xl border p-3.5 ${a.status === 'case' ? 'border-info/30 bg-info/[0.04]' : 'border-ink/10'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <SeverityBadge severity={a.severity} />
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {KIND_LABEL[a.kind]} · score {a.score}
                    {a.user ? ` · ${a.user}` : ''}
                    {a.status === 'case' ? ` · case ${a.caseRef ?? ''}` : ''}
                    {a.status === 'dismissed' ? ' · dismissed' : ''}
                    {a.status === 'resolved' ? ' · resolved' : ''}
                  </p>
                </div>
                {a.amount ? <p className="font-bold tabular-nums text-ink">{ugx(a.amount)}</p> : null}
              </div>
              <Drivers drivers={a.drivers} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.sources.map((s) =>
                  s.link ? (
                    <Link key={s.kind + s.id} to={s.link} className="rounded-md border border-ink/10 px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/5">
                      {s.label}
                    </Link>
                  ) : (
                    <span key={s.kind + s.id} className="rounded-md border border-ink/10 px-2 py-0.5 text-xs text-ink/65">
                      {s.label}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === 'open' && (
                  <>
                    <Button size="sm" onClick={() => setAsking({ a, action: 'open-case' })} disabled={busy}>
                      Open case
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking({ a, action: 'notify' })} disabled={busy}>
                      Notify
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking({ a, action: 'dismiss' })} disabled={busy}>
                      Dismiss
                    </Button>
                  </>
                )}
                {a.status === 'case' && (
                  <>
                    <Button size="sm" onClick={() => setAsking({ a, action: 'resolve' })} disabled={busy}>
                      Close case
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking({ a, action: 'notify' })} disabled={busy}>
                      Notify
                    </Button>
                  </>
                )}
                {(a.status === 'dismissed' || a.status === 'resolved') && (
                  <Button size="sm" variant="ghost" onClick={() => void act(a, 'reopen', 'Reopened')} disabled={busy}>
                    Reopen
                  </Button>
                )}
              </div>
              {(history.get(a.id) ?? []).length > 0 && (
                <ul className="mt-3 space-y-0.5 border-t border-ink/8 pt-2">
                  {(history.get(a.id) ?? []).map((h) => (
                    <li key={h.id} className="text-xs text-ink/55">
                      {dateTime(h.at)} · {h.by.name}: {h.note || h.action}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {asking && (
        <ReasonDialog
          {...DIALOG[asking.action]}
          error={error}
          onCancel={() => {
            setAsking(null)
            setError(null)
          }}
          onConfirm={(note) => act(asking.a, asking.action, note)}
        />
      )}
    </Card>
  )
}
