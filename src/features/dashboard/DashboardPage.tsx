import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Badge,
  Card,
  Donut,
  MoneyBars,
  PageHeader,
  Segmented,
  StackedBars,
  StatCard,
} from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { addDays } from '../../lib/availability'
import {
  PERIOD_LABEL,
  daySeries,
  debtorBands,
  debtors,
  giveAways,
  kpisOf,
  periodDays,
  roomMix,
} from '../../lib/dashboard'
import type { Period, PosSale } from '../../lib/dashboard'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { useApprovals } from '../approvals/approvalsContext'
import { useCorporate } from '../corporate/corporateContext'
import { useRequests } from '../procurement/requestsContext'
import { useFeatures } from '../platform/featuresContext'

type View = 'overview' | 'money' | 'rooms' | 'stock' | 'companies' | 'control'

const VIEW_LABEL: Record<View, string> = {
  overview: 'Overview',
  money: 'Money',
  rooms: 'Rooms',
  stock: 'Stock',
  companies: 'Companies',
  control: 'Control',
}

/**
 * Which views a role may open. One page with a switcher, so nobody meets the same dashboard twice.
 * Housekeeping, the store and the front desk are left out on purpose: their own pages already carry
 * these numbers, and a second copy would only go stale.
 */
function viewsFor(role: string | undefined, hasStock: boolean, hasCompanies: boolean): View[] {
  const all: View[] = ['overview', 'money', 'rooms']
  const stock: View[] = hasStock ? ['stock'] : []
  const companies: View[] = hasCompanies ? ['companies'] : []
  if (role === 'owner') return [...all, ...stock, ...companies, 'control']
  if (role === 'gm' || role === 'admin') return [...all, ...stock, ...companies]
  if (role === 'finance') return ['overview', 'money', ...companies, 'control']
  return ['overview']
}

const dayLabel = (iso: string) => dayMonth(iso).replace(/ \d{4}$/, '')

export default function DashboardPage() {
  const { reservations, rooms, guests } = useHotel()
  const { tenant, features, options } = useFeatures()
  const { role } = useAuth()
  const { records } = useApprovals()
  const { accounts } = useCorporate()
  const { stock, losses, orders, batches } = useRequests()
  const [sales] = useBrowserSyncedState<PosSale[]>('gastora.pos.sales.v1', [])

  const simple = tenant.plan === 'starter'
  const views = viewsFor(role?.id, features.stockControl, accounts.length > 0)
  const [view, setView] = useState<View>(views[0] ?? 'overview')
  const [period, setPeriod] = useState<Period>('7')

  const days = useMemo(() => periodDays(period, TODAY), [period])
  const points = useMemo(() => daySeries(days, reservations, rooms, sales, TODAY), [days, reservations, rooms, sales])
  const kpis = useMemo(() => kpisOf(points), [points])

  // A week ahead, from bookings. A forecast, not earnings, so it is drawn faded.
  const ahead = useMemo(() => {
    const next = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i + 1))
    return daySeries(next, reservations, rooms, [], TODAY)
  }, [reservations, rooms])

  const mix = roomMix(rooms)
  const owed = debtors(reservations, TODAY)
  const owedTotal = owed.reduce((n, d) => n + d.owed, 0)
  const gifts = giveAways(reservations)

  const occupancyLine = [
    ...points.map((p) => ({ label: dayLabel(p.day), value: p.sellable ? Math.round((p.occupied / p.sellable) * 100) : 0 })),
    ...ahead.map((p) => ({
      label: dayLabel(p.day),
      value: p.sellable ? Math.round((p.occupied / p.sellable) * 100) : 0,
      muted: true,
      hint: 'booked',
    })),
  ]

  const revenueBars = points.map((p) => ({
    label: dayLabel(p.day),
    parts: [
      { key: 'Rooms', value: p.rooms },
      { key: 'Food and drink', value: p.pos },
      { key: 'Extras', value: p.extras },
    ],
  }))

  const lowStock = stock.filter((s) => s.onHand <= s.reorderAt)
  const stockValue = stock.reduce((n, s) => n + s.onHand * s.unitCost, 0)
  const lossValue = losses.reduce((n, l) => n + l.qty * l.unitCost, 0)
  const openOrders = orders.filter((o) => o.status !== 'Received').length
  const expiring = batches.filter((b) => b.qty > 0 && b.expiry && b.expiry <= addDays(TODAY, 30)).length

  const overLimit = accounts.filter((a) => a.creditLimit > 0 && a.outstandingBalance > a.creditLimit)
  const companyOwed = accounts.reduce((n, a) => n + a.outstandingBalance, 0)

  const noPhoto = records.filter((r) => r.photoSkipped || r.approvers.every((a) => !a.photo))
  const reversed = records.filter((r) => r.kind === 'charge-reversal')
  const reversedValue = reversed.reduce((n, r) => n + (r.amount ?? 0), 0)

  const periodPicker = (
    <Segmented<Period>
      label="Period"
      value={period}
      onChange={setPeriod}
      options={(['today', '7', '30'] as Period[]).map((p) => ({ key: p, label: PERIOD_LABEL[p] }))}
    />
  )

  if (views.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <p className="rounded-xl bg-ink/5 p-4 text-sm text-ink/70">No dashboard for your role. Use the menu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`${tenant.name}. Worked out from the hotel's own records, not estimated.`}
        meta={<Badge tone="neutral">{TODAY}</Badge>}
        actions={
          views.length > 1 ? (
            <Segmented<View> label="Dashboard" value={view} onChange={setView} options={views.map((v) => ({ key: v, label: VIEW_LABEL[v] }))} />
          ) : undefined
        }
      />

      {(view === 'overview' || view === 'money') && <div className="flex justify-end">{periodPicker}</div>}

      {view === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Occupancy" icon="occupancy" value={`${kpis.occupancy}%`} hint={`${kpis.roomsSold} of ${kpis.roomNights} room nights`} />
            <StatCard label="Money taken" icon="money" value={ugx(kpis.total)} hint={PERIOD_LABEL[period]} />
            {!simple && <StatCard label="Average room rate" icon="bed" value={ugx(kpis.adr)} hint="Of the rooms sold" />}
            {!simple && <StatCard label="Per available room" icon="list" value={ugx(kpis.revpar)} hint="RevPAR" />}
            {simple && <StatCard label="Owed to the hotel" icon="alert" value={ugx(owedTotal)} hint={`${owed.length} guests`} tone={owedTotal > 0 ? 'bad' : 'good'} />}
            {simple && <StatCard label="Rooms ready" icon="clean" value={mix.ready} hint={`${mix.dirty} to clean`} />}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Occupancy" icon="occupancy" padded description="The past, then what is already booked.">
              <AreaChart points={occupancyLine} suffix="%" />
            </Card>
            <Card title="Rooms right now" icon="bed" padded>
              <Donut
                centre={`${rooms.length}`}
                caption="Room status"
                slices={[
                  { label: 'Occupied', value: mix.occupied, colour: 'var(--color-brand)' },
                  { label: 'Ready', value: mix.ready, colour: 'var(--color-good)' },
                  { label: 'To clean', value: mix.dirty, colour: 'var(--color-warn)' },
                  { label: 'Out of service', value: mix.blocked, colour: 'var(--color-bad)' },
                ]}
              />
            </Card>
          </div>

          {!simple && (
            <Card title="Where the money came from" icon="money" padded description={PERIOD_LABEL[period]}>
              <StackedBars bars={revenueBars} keys={['Rooms', 'Food and drink', 'Extras']} />
            </Card>
          )}

          <Card title="Needs a decision" icon="alert" padded>
            <ul className="space-y-2 text-sm">
              {owedTotal > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink/75">{owed.length} guest{owed.length === 1 ? '' : 's'} owe money</span>
                  <Link to="/desk/folios?view=balance" className="font-semibold text-brand hover:underline">
                    {ugx(owedTotal)}
                  </Link>
                </li>
              )}
              {mix.blocked > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink/75">{mix.blocked} room{mix.blocked === 1 ? '' : 's'} out of service</span>
                  <Link to="/desk/rooms?quick=blocked" className="font-semibold text-brand hover:underline">Open rooms</Link>
                </li>
              )}
              {overLimit.length > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink/75">{overLimit.length} company over its credit limit</span>
                  <Link to="/desk/companies" className="font-semibold text-brand hover:underline">Open companies</Link>
                </li>
              )}
              {features.stockControl && lowStock.length > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink/75">{lowStock.length} item{lowStock.length === 1 ? '' : 's'} below reorder level</span>
                  <Link to="/inventory" className="font-semibold text-brand hover:underline">Open stock</Link>
                </li>
              )}
              {owedTotal === 0 && mix.blocked === 0 && overLimit.length === 0 && (!features.stockControl || lowStock.length === 0) && (
                <li className="text-ink/55">Nothing is waiting.</li>
              )}
            </ul>
          </Card>
        </>
      )}

      {view === 'money' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Rooms" icon="bed" value={ugx(kpis.roomRevenue)} hint={`${kpis.roomsSold} room nights`} />
            <StatCard label="Food and drink" icon="money" value={ugx(kpis.posRevenue)} hint="From the point of sale" />
            <StatCard label="Extras" icon="list" value={ugx(kpis.extrasRevenue)} hint="Laundry, transport, spa" />
            <StatCard label="Owed to the hotel" icon="alert" value={ugx(owedTotal)} hint={`${owed.length} guests`} tone={owedTotal > 0 ? 'bad' : 'good'} />
          </div>

          <Card title="Money by day" icon="money" padded description={PERIOD_LABEL[period]}>
            <StackedBars bars={revenueBars} keys={['Rooms', 'Food and drink', 'Extras']} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="How old the debt is" icon="alert" padded description="Money in the house is at risk too.">
              <MoneyBars rows={debtorBands(owed).map((b) => ({ label: b.label, amount: b.amount, count: b.count, tone: b.label === 'Over 30 days' ? 'bad' : b.label === 'In the house' ? 'brand' : 'warn' }))} />
            </Card>
            <Card title="Who owes it" icon="guests" count={owed.length} padded>
              {owed.length === 0 ? (
                <p className="text-sm text-ink/55">Nobody owes anything.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {owed.slice(0, 8).map((d) => (
                    <li key={d.reservation.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <Link to={`/desk/folios?r=${d.reservation.id}`} className="truncate font-medium text-ink hover:text-brand">
                          {d.reservation.guest}
                        </Link>
                        <span className="block text-xs text-ink/55">
                          {d.reservation.id} · {d.age === 0 ? 'in the house' : `left ${d.age} day${d.age === 1 ? '' : 's'} ago`}
                          {d.reservation.corporate ? ` · ${d.reservation.corporate.accountName}` : ''}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-bad">{ugx(d.owed)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {view === 'rooms' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Occupied" icon="guests" value={mix.occupied} hint={`of ${rooms.length} rooms`} />
            <StatCard label="Ready to sell" icon="clean" value={mix.ready} hint="Clean and inspected" tone="good" />
            <StatCard label="To clean" icon="tasks" value={mix.dirty} hint="Waiting for housekeeping" tone={mix.dirty > 0 ? 'warn' : 'default'} />
            <StatCard label="Out of service" icon="alert" value={mix.blocked} hint="Cannot be sold" tone={mix.blocked > 0 ? 'bad' : 'default'} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Rooms right now" icon="bed" padded>
              <Donut
                centre={`${rooms.length}`}
                caption="Room status"
                slices={[
                  { label: 'Occupied', value: mix.occupied, colour: 'var(--color-brand)' },
                  { label: 'Ready', value: mix.ready, colour: 'var(--color-good)' },
                  { label: 'To clean', value: mix.dirty, colour: 'var(--color-warn)' },
                  { label: 'Out of service', value: mix.blocked, colour: 'var(--color-bad)' },
                ]}
              />
            </Card>
            <Card title="Occupancy" icon="occupancy" padded description="The past, then what is already booked.">
              <AreaChart points={occupancyLine} suffix="%" />
            </Card>
          </div>
          <Card title="Guests on the books" icon="calendar" padded>
            <p className="text-sm text-ink/70">
              {guests.length} guest profiles. {reservations.filter((r) => r.status === 'booked').length} bookings still to arrive.
            </p>
          </Card>
        </>
      )}

      {view === 'stock' && features.stockControl && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Stock value" icon="money" value={ugx(stockValue)} hint={`${stock.length} items`} />
            <StatCard label="Below reorder" icon="alert" value={lowStock.length} hint="Order these" tone={lowStock.length > 0 ? 'warn' : 'good'} />
            <StatCard label="Written off" icon="alert" value={ugx(lossValue)} hint={`${losses.length} reports`} tone={lossValue > 0 ? 'bad' : 'default'} />
            <StatCard label="Open orders" icon="list" value={openOrders} hint={features.batchExpiry ? `${expiring} batches expiring` : 'Purchase orders'} />
          </div>
          <Card title="Items below their reorder level" icon="alert" count={lowStock.length} padded>
            {lowStock.length === 0 ? (
              <p className="text-sm text-ink/55">Everything is above its level.</p>
            ) : (
              <MoneyBars
                rows={lowStock.slice(0, 8).map((s) => ({ label: `${s.name} · ${s.onHand} ${s.unit} left`, amount: s.reorderAt * s.unitCost, tone: 'warn' as const }))}
              />
            )}
          </Card>
        </>
      )}

      {view === 'companies' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Company accounts" icon="guests" value={accounts.length} hint={`${accounts.filter((a) => a.status === 'active').length} active`} />
            <StatCard label="Owed by companies" icon="money" value={ugx(companyOwed)} hint="Outstanding on account" tone={companyOwed > 0 ? 'warn' : 'good'} />
            <StatCard label="Over their limit" icon="alert" value={overLimit.length} hint="Need approval" tone={overLimit.length > 0 ? 'bad' : 'good'} />
            <StatCard label="Company stays" icon="bed" value={reservations.filter((r) => r.corporate).length} hint="Booked or in house" />
          </div>
          <Card title="What each company owes" icon="money" count={accounts.length} padded>
            {accounts.length === 0 ? (
              <p className="text-sm text-ink/55">No company accounts yet.</p>
            ) : (
              <MoneyBars
                rows={accounts
                  .filter((a) => a.creditLimit > 0 || a.outstandingBalance > 0)
                  .map((a) => ({
                    label: `${a.name}${a.creditLimit ? ` · limit ${ugx(a.creditLimit)}` : ''}`,
                    amount: a.outstandingBalance,
                    tone: a.outstandingBalance > a.creditLimit && a.creditLimit > 0 ? ('bad' as const) : ('brand' as const),
                  }))}
              />
            )}
          </Card>
        </>
      )}

      {view === 'control' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Charges cancelled" icon="alert" value={reversed.length} hint={ugx(reversedValue)} tone={reversed.length > 0 ? 'warn' : 'good'} />
            <StatCard label="Without a photo" icon="alert" value={noPhoto.length} hint="Check these first" tone={noPhoto.length > 0 ? 'bad' : 'good'} />
            <StatCard label="Given away" icon="sparkles" value={gifts.length} hint="Upgrades, free moves, unpaid" />
            <StatCard label="Write-offs" icon="alert" value={ugx(lossValue)} hint={`${losses.length} reports`} tone={lossValue > 0 ? 'warn' : 'default'} />
          </div>

          <Card
            title="Who approved money off a folio"
            icon="check"
            count={records.length}
            padded
            description="A wrong face means a borrowed PIN."
          >
            {records.length === 0 ? (
              <p className="text-sm text-ink/55">Nothing has been approved yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {records.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.what}</span>
                      <span className="block text-xs text-ink/55">
                        {r.at} · asked by {r.requestedBy} · approved by {r.approvers.map((a) => a.name).join(' and ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.amount ? <span className="font-semibold tabular-nums">{ugx(r.amount)}</span> : null}
                      {(r.photoSkipped || r.approvers.every((a) => !a.photo)) && <Badge tone="warn">No photo</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link to="/admin/approvals" className="text-sm font-semibold text-brand hover:underline">
                See every approval
              </Link>
            </div>
          </Card>

          <Card title="Money given away" icon="money" count={gifts.length} padded description="Free upgrades, free room moves and guests who left owing.">
            {gifts.length === 0 ? (
              <p className="text-sm text-ink/55">Nothing has been given away.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {gifts.slice(0, 8).map((g, i) => (
                  <li key={`${g.kind}-${i}`} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{g.what}</span>
                      <span className="block text-xs text-ink/55">
                        {g.kind} · {g.who} · {g.at}
                      </span>
                    </span>
                    {g.amount ? <span className="shrink-0 font-semibold tabular-nums text-bad">{ugx(g.amount)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <p className="text-xs text-ink/50">
        Future days show bookings, not money earned.
        {options.loyalty.on ? '' : ' Returning-guest rewards are switched off.'}
      </p>
    </div>
  )
}
