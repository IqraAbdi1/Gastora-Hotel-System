import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButtons from '../../components/ActionButtons'
import { Badge, Button, Card, DataSourceBadge, DataTable, EmptyState, PageHeader, StatCard, buttonClass } from '../../components/ui'
import type { Column } from '../../components/ui'
import { aiSamples } from '../../data/assistant'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { reservationsNeedingAttention, summarizeDay, upcomingArrivals } from '../../lib/frontdesk'
import { useHotel } from '../../lib/hotelContext'
import { buildRuleSuggestions } from '../../lib/rules'
import type { Reservation } from '../../types'
import { useHousekeeping } from '../housekeeping/hkContext'
import ShortageBanner from '../housekeeping/ShortageBanner'
import CheckInPanel from './CheckInPanel'
import ReservationPanel from './ReservationPanel'
import TasksCard from './TasksCard'

// How many rows each list shows before linking to the full list.
const SHOW = 8

function PaymentBadge({ r }: { r: Reservation }) {
  if (r.paid > 0) return <Badge tone="good">Deposit {ugx(r.paid)}</Badge>
  if (r.guarantee === 'company') return <Badge tone="neutral">Company account</Badge>
  if (r.guarantee === 'card') return <Badge tone="neutral">Card guarantee</Badge>
  return <Badge tone="warn">No deposit</Badge>
}

function GuestCell({ r }: { r: Reservation }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink">{r.guest}</p>
      <p className="text-xs text-ink/55">{r.id}</p>
    </div>
  )
}

function dayLabel(iso: string) {
  if (iso === addDays(TODAY, 1)) return 'Tomorrow'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function SeeAll({ count, to, noun }: { count: number; to: string; noun: string }) {
  if (count <= SHOW) return null
  return (
    <div className="border-t border-ink/10 px-4 py-2.5">
      <Link to={to} className="text-sm font-semibold text-brand hover:underline">
        See all {count} {noun}
      </Link>
    </div>
  )
}

export default function TodayPage() {
  const { reservations, rooms } = useHotel()
  const { readyRooms, dismissReady } = useHousekeeping()
  const [checkIn, setCheckIn] = useState<{ id: string; room?: string } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const day = useMemo(() => summarizeDay(reservations, rooms, TODAY), [reservations, rooms])
  const upcoming = useMemo(() => upcomingArrivals(reservations, TODAY, 3), [reservations])
  const attention = useMemo(() => reservationsNeedingAttention(reservations, rooms, TODAY), [reservations, rooms])
  const suggestions = useMemo(() => buildRuleSuggestions(reservations, rooms), [reservations, rooms])

  const occupancy = day.sellable ? Math.round((day.occupied / day.sellable) * 100) : 0
  const checkingIn = reservations.find((r) => r.id === checkIn?.id) ?? null
  const opened = reservations.find((r) => r.id === openId) ?? null
  const todayLabel = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const arrivalColumns: Column<Reservation>[] = [
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} /> },
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <div>
          <p>{r.roomType}</p>
          <p className="text-xs text-ink/55">{r.room ? `Room ${r.room}` : 'Not assigned'}</p>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      hideBelow: 'xl',
      cell: (r) => {
        const n = nightsBetween(r.arrival, r.departure)
        return (
          <div>
            <p>
              {n} night{n === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-ink/55">Until {dayMonth(r.departure)}</p>
          </div>
        )
      },
    },
    { key: 'pay', header: 'Payment', hideBelow: 'sm', cell: (r) => <PaymentBadge r={r} /> },
    {
      key: 'act',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (r) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setCheckIn({ id: r.id })
          }}
        >
          Check in
        </Button>
      ),
    },
  ]

  const departureColumns: Column<Reservation>[] = [
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} /> },
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <div>
          <p>Room {r.room}</p>
          {r.departure < TODAY && <p className="text-xs font-medium text-bad">Was due {dayMonth(r.departure)}</p>}
        </div>
      ),
    },
    {
      key: 'bal',
      header: 'Balance',
      cell: (r) =>
        r.total > r.paid ? <Badge tone="bad">Owes {ugx(r.total - r.paid)}</Badge> : <Badge tone="good">Settled</Badge>,
    },
    {
      key: 'act',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (r) => (
        <Link
          to={`/desk/folios?view=leaving&r=${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className={buttonClass('secondary', 'sm')}
        >
          Check out
        </Link>
      ),
    },
  ]

  const upcomingColumns: Column<Reservation>[] = [
    { key: 'day', header: 'Arrives', cell: (r) => <span className="font-medium">{dayLabel(r.arrival)}</span> },
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} /> },
    { key: 'type', header: 'Room', hideBelow: 'md', cell: (r) => r.roomType },
    { key: 'pay', header: 'Payment', cell: (r) => <PaymentBadge r={r} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Today"
        description={todayLabel}
        meta={<DataSourceBadge />}
        actions={
          <>
            <Link to="/desk/rooms" className={buttonClass('ghost')}>
              Rooms board
            </Link>
            <Link to="/desk/reservations" className={buttonClass('ghost')}>
              All reservations
            </Link>
          </>
        }
      />

      {readyRooms.map((ready) => {
        const guest = day.expected.find((g) => g.roomType === ready.type && (!g.room || g.room === ready.room))
        return (
          <div
            key={ready.room}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good/30 bg-good/10 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-good">Room {ready.room} is ready</p>
              <p className="text-sm text-ink/70">
                Housekeeping finished at {ready.time}.{' '}
                {guest ? `${guest.guest} is waiting for a ${guest.roomType} room.` : 'No guest is waiting for this room type.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {guest && (
                <Button size="sm" onClick={() => setCheckIn({ id: guest.id, room: ready.room })}>
                  Check in {guest.guest.split(' ')[0]}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => dismissReady(ready.room)}>
                Dismiss
              </Button>
            </div>
          </div>
        )
      })}
      <ShortageBanner />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Arrivals"
          value={day.expected.length}
          hint={`${day.arrivedCount} checked in today`}
          to="/desk/reservations?view=arrivals"
        />
        <StatCard
          label="Departures"
          value={day.leaving.length}
          hint={`${day.checkedOutCount} checked out today`}
          to="/desk/folios?view=leaving"
        />
        <StatCard label="In house" value={day.inHouse.length} hint="Guests staying" to="/desk/reservations?view=in-house" />
        <StatCard label="Occupancy" value={`${occupancy}%`} hint={`${day.occupied} of ${day.sellable} rooms`} to="/desk/rooms" />
        <StatCard
          label="Rooms to clean"
          value={day.roomsToClean}
          hint="Open housekeeping"
          to="/housekeeping"
          tone={day.roomsToClean > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="Balances due"
          value={day.owing.length}
          hint={day.owing.length ? `${ugx(day.owedTotal)} owed` : 'All settled'}
          to="/desk/folios"
          tone={day.owing.length > 0 ? 'bad' : 'default'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card title="Arrivals today" count={day.expected.length} description="Booked to arrive today and not yet checked in." padded={false}>
            <DataTable
              columns={arrivalColumns}
              rows={day.expected.slice(0, SHOW)}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              empty={{ title: 'No arrivals waiting', hint: 'Everyone expected today has checked in.' }}
            />
            <SeeAll count={day.expected.length} to="/desk/reservations?view=arrivals" noun="arrivals" />
          </Card>

          <Card title="Departures" count={day.leaving.length} description="Due out today, plus anyone past their departure date." padded={false}>
            <DataTable
              columns={departureColumns}
              rows={day.leaving.slice(0, SHOW)}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              empty={{ title: 'No departures left', hint: 'No one else is due to leave today.' }}
            />
            <SeeAll count={day.leaving.length} to="/desk/folios?view=leaving" noun="departures" />
          </Card>

          <Card title="Upcoming arrivals" count={upcoming.length} description="Booked to arrive in the next 3 days." padded={false}>
            <DataTable
              columns={upcomingColumns}
              rows={upcoming.slice(0, SHOW)}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              empty={{ title: 'No arrivals in the next 3 days' }}
            />
            <SeeAll count={upcoming.length} to="/desk/reservations?dates=week" noun="upcoming stays" />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <TasksCard />

          <Card title="Needs attention" count={attention.length} description="Reservations to sort out today." padded={false}>
            {attention.length === 0 ? (
              <EmptyState title="Nothing needs attention" hint="No missed arrivals, overdue stays or unguaranteed arrivals." />
            ) : (
              <ul className="divide-y divide-ink/8">
                {attention.slice(0, SHOW).map((a) => (
                  <li key={`${a.kind}-${a.reservation.id}`}>
                    <button
                      type="button"
                      onClick={() => setOpenId(a.reservation.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas/70"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === 'bad' ? 'bg-bad' : 'bg-warn'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{a.title}</span>
                        <span className="block text-xs text-ink/60">
                          {a.reservation.guest} · {a.reservation.id}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink/60">{a.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attention.length > SHOW && (
              <p className="border-t border-ink/10 px-4 py-2.5 text-xs text-ink/60">
                {attention.length - SHOW} more. Use Reservations to see them all.
              </p>
            )}
          </Card>

          <Card
            title="Suggestions"
            description={
              <>
                <strong>Rule</strong> items are worked out from the bookings. <strong>AI (sample)</strong> items are fixed examples
                for the demo, not real advice.
              </>
            }
          >
            {suggestions.length + aiSamples.length === 0 ? (
              <EmptyState title="No suggestions right now" />
            ) : (
              <ul className="space-y-3">
                {[...suggestions, ...aiSamples].map((s) => (
                  <li key={s.text} className="rounded-lg border border-ink/8 bg-canvas/60 p-3 text-sm">
                    <div className="mb-1">
                      {s.source === 'rule' ? <Badge tone="brand">Rule</Badge> : <Badge tone="accent">AI (sample)</Badge>}
                    </div>
                    <p className="text-ink/85">{s.text}</p>
                    <ActionButtons actions={s.actions} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {opened && (
        <ReservationPanel
          reservation={opened}
          onClose={() => setOpenId(null)}
          onCheckIn={() => {
            setOpenId(null)
            setCheckIn({ id: opened.id })
          }}
        />
      )}
      {checkingIn && <CheckInPanel reservation={checkingIn} room={checkIn?.room} onClose={() => setCheckIn(null)} />}
    </div>
  )
}
