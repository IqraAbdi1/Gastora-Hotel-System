import { useMemo } from 'react'
import { Badge, Card, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { averageLeadTime, addDays, curveIsThin, kpisBehind, kpisOfNights, paceAhead, VERDICT_TONE } from '../../lib/pace'
import type { NightPace } from '../../lib/pace'
import { DAY_SHORT, dayOf } from '../../lib/rateCalendar'
import { useFeatures } from '../platform/featuresContext'
import RateAdviceCard from './RateAdviceCard'

const AHEAD = 30

/**
 * Pace: not what the hotel has, but what is happening to it.
 *
 * Every number here is measured against the hotel's own past nights at the same number of days out.
 * That is the only honest comparison a single hotel can make, and it is the one a revenue manager
 * actually argues from.
 */
export default function RevenuePage() {
  const { reservations, rooms } = useHotel()
  const { tenant } = useFeatures()

  const nights = useMemo(() => paceAhead(reservations, rooms, TODAY, AHEAD), [reservations, rooms])
  const thin = useMemo(() => curveIsThin(reservations, TODAY), [reservations])
  const lead = useMemo(
    () => averageLeadTime(reservations, addDays(TODAY, -90), addDays(TODAY, AHEAD)),
    [reservations],
  )

  // Forward against achieved: the pair of columns a revenue meeting actually argues over.
  const forward = useMemo(() => kpisOfNights(nights), [nights])
  const achieved = useMemo(() => kpisBehind(reservations, rooms, TODAY, AHEAD), [reservations, rooms])

  const pickedUp = nights.reduce((n, x) => n + x.pickup, 0)
  const behind = nights.filter((n) => n.verdict === 'behind').length
  const ahead = nights.filter((n) => n.verdict === 'ahead').length

  const columns: Column<NightPace>[] = [
    {
      key: 'night',
      header: 'Night',
      cell: (n) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {DAY_SHORT[dayOf(n.date)]} {dayMonth(n.date)}
          </p>
          <p className="text-xs text-ink/55">{n.daysOut === 0 ? 'Tonight' : `${n.daysOut} day${n.daysOut === 1 ? '' : 's'} out`}</p>
        </div>
      ),
    },
    {
      key: 'books',
      header: 'On the books',
      align: 'right',
      cell: (n) => (
        <span className="tabular-nums">
          {n.onBooks}/{n.sellable} <span className="text-xs text-ink/50">{n.occupancy}%</span>
        </span>
      ),
    },
    {
      key: 'pickup',
      header: 'This week',
      align: 'right',
      hideBelow: 'sm',
      cell: (n) => (
        <span className={`tabular-nums ${n.pickup > 0 ? 'font-semibold text-good' : 'text-ink/45'}`}>
          {n.pickup > 0 ? `+${n.pickup}` : '—'}
        </span>
      ),
    },
    {
      key: 'normal',
      header: 'Usually by now',
      align: 'right',
      hideBelow: 'md',
      cell: (n) =>
        n.normalShare > 0 ? (
          <span className="tabular-nums text-ink/70">{Math.round(n.normalShare * 100)}% of the house</span>
        ) : (
          <span className="text-xs text-ink/40">Not enough history</span>
        ),
    },
    {
      key: 'money',
      header: 'Room money',
      align: 'right',
      hideBelow: 'md',
      cell: (n) => <span className="tabular-nums text-ink/75">{n.revenue > 0 ? ugx(n.revenue) : '—'}</span>,
    },
    {
      key: 'forecast',
      header: 'Likely finish',
      align: 'right',
      hideBelow: 'sm',
      cell: (n) =>
        n.forecast === undefined ? (
          <span className="text-xs text-ink/40">—</span>
        ) : (
          <span className="tabular-nums">
            {n.forecast}/{n.sellable}
          </span>
        ),
    },
    {
      key: 'verdict',
      header: '',
      align: 'right',
      cell: (n) => (
        <Badge tone={VERDICT_TONE[n.verdict]} dot={n.verdict !== 'too early to say'}>
          {n.verdict}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Revenue management"
        description={`${tenant.name}. How fast the next ${AHEAD} nights are filling, against the way this hotel usually fills.`}
      />

      {thin && (
        <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-sm text-ink/80">
          <p className="font-semibold text-ink">There is not much history yet.</p>
          <p className="mt-0.5 text-xs">
            Pace is measured against this hotel's own past nights. Until there are a few months of them, the
            comparison is weak and the likely finish is left blank rather than guessed.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="On the books"
          icon="occupancy"
          value={`${forward.occupancy}%`}
          hint={`${forward.roomsSold} of ${forward.roomNights} room nights`}
        />
        <StatCard
          label="Picked up this week"
          icon="money"
          value={pickedUp > 0 ? `+${pickedUp}` : '0'}
          hint="Room nights booked in the last 7 days"
          tone={pickedUp > 0 ? 'good' : 'default'}
        />
        <StatCard
          label="Behind pace"
          icon="alert"
          value={String(behind)}
          hint={`${ahead} ahead of pace`}
          tone={behind > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Booked in advance"
          icon="calendar"
          value={lead === undefined ? '—' : `${lead} days`}
          hint="Average, booking to arrival"
        />
      </div>

      <RateAdviceCard nights={nights} />

      <Card
        title="Where the next thirty nights stand"
        icon="money"
        padded
        description="The rooms already sold for the nights ahead, beside the thirty nights just gone."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Occupancy', now: `${forward.occupancy}%`, was: `${achieved.occupancy}%` },
            { label: 'Average room rate', now: ugx(forward.adr), was: ugx(achieved.adr) },
            { label: 'Per available room', now: ugx(forward.revpar), was: ugx(achieved.revpar) },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-ink/10 bg-linear-to-br from-brand/[0.06] to-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{row.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{row.now}</p>
              <p className="mt-0.5 text-xs text-ink/55">{row.was} over the last thirty nights</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink/70">
          <span className="font-semibold text-ink">{ugx(forward.revenue)}</span> of room money is already sold for the
          nights ahead, counted at the prices those bookings were taken at. A rate rise does not enrich a booking
          already made.
        </p>
        <p className="mt-1 text-xs text-ink/55">
          The nights ahead are still filling, so their occupancy is meant to be below what the past thirty achieved.
          The question is whether it is further below than usual, which is what the table answers.
        </p>
      </Card>

      <Card
        title="The next thirty nights"
        icon="calendar"
        count={nights.length}
        padded={false}
        description="Ahead or behind is measured against this hotel's own build-up at the same number of days out."
      >
        <DataTable columns={columns} rows={nights} rowKey={(n) => n.date} />
      </Card>

      <p className="text-xs text-ink/55">
        The likely finish is what is on the books divided by the share this hotel normally holds by now. It is a
        projection of this hotel's own habit, not a prediction of the world: a conference, a funeral or a closed road
        will beat it, and nothing here knows about those.
      </p>
    </div>
  )
}
