import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, DataSourceBadge, DataTable, Icon, StatCard, buttonClass } from '../../components/ui'
import type { Column } from '../../components/ui'
import { aiSamples } from '../../data/assistant'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { reservationsNeedingAttention, summarizeDay, upcomingArrivals } from '../../lib/frontdesk'
import { useHotel } from '../../lib/hotelContext'
import { stayHistory } from '../../lib/loyalty'
import { partyLabel, partyOf, stillIn } from '../../lib/party'
import { buildRuleSuggestions } from '../../lib/rules'
import type { Guest, Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import ShortageBanner from '../housekeeping/ShortageBanner'
import AssignRoomsButton from './AssignRoomsDialog'
import AttentionPanel from './AttentionPanel'
import CheckInPanel from './CheckInPanel'
import ConfirmCallsCard from './ConfirmCallsCard'
import GuestRequestsCard from './GuestRequestsCard'
import ExpressCheckoutCard from './ExpressCheckoutCard'
import OnlineCheckoutCard from './OnlineCheckoutCard'
import ServiceBookingsCard from './ServiceBookingsCard'
import { useOnlineCheckouts } from '../portal/useOnlineCheckouts'
import ReservationPanel from './ReservationPanel'
import SuggestionsPanel from './SuggestionsPanel'
import TasksCard from './TasksCard'

// How many rows each list shows before linking to the full list.
const SHOW = 8

function PaymentBadge({ r }: { r: Reservation }) {
  if (r.paid > 0) return <Badge tone="good">Deposit {ugx(r.paid)}</Badge>
  if (r.guarantee === 'company') return <Badge tone="neutral">Company account</Badge>
  if (r.guarantee === 'card') return <Badge tone="neutral">Card guarantee</Badge>
  return <Badge tone="warn">No deposit</Badge>
}

/**
 * A guest in a list. The marks beside the name are the two things worth knowing before anybody walks
 * up: that the hotel has decided this guest is a VIP, and that they have been here before. A VIP flag
 * nobody can see is a flag that does nothing.
 */
function GuestCell({ r, guests, reservations }: { r: Reservation; guests: Guest[]; reservations: Reservation[] }) {
  const profile = guests.find((g) => (r.guestId ? g.id === r.guestId : g.name === r.guest))
  const stays = profile ? stayHistory(profile, reservations, r.id).stays : 0
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-1.5 truncate font-semibold text-ink">
        {r.guest}
        {profile?.vip && <Badge tone="warn">VIP</Badge>}
        {stays > 0 && (
          <Badge tone="good">
            {stays === 1 ? 'Been before' : `${stays} stays`}
          </Badge>
        )}
        {r.party && <Badge tone="brand">{partyLabel(partyOf(reservations, r).filter(stillIn).length)}</Badge>}
      </p>
      <p className="text-xs text-ink/55">{r.id}</p>
    </div>
  )
}

function dayLabel(iso: string) {
  if (iso === addDays(TODAY, 1)) return 'Tomorrow'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Buttons that sit on the green banner.
const onBrand =
  'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const onBrandGhost = `${onBrand} border-ink/15 bg-surface text-ink/80 hover:border-brand/40 hover:text-ink`

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
  const { reservations, rooms, guests } = useHotel()
  const { checkouts } = useOnlineCheckouts()
  const { readyRooms, dismissReady } = useHousekeeping()
  const [checkIn, setCheckIn] = useState<{ id: string; room?: string } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'attention' | 'suggestions' | null>(null)
  const { user } = useAuth()

  const day = useMemo(() => summarizeDay(reservations, rooms, TODAY), [reservations, rooms])
  const upcoming = useMemo(() => upcomingArrivals(reservations, TODAY, 3), [reservations])
  const attention = useMemo(() => reservationsNeedingAttention(reservations, rooms, TODAY), [reservations, rooms])
  const suggestions = useMemo(() => [...buildRuleSuggestions(reservations, rooms), ...aiSamples], [reservations, rooms])
  const urgent = attention.some((a) => a.severity === 'bad')

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
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} guests={guests} reservations={reservations} /> },
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <div>
          <p>{r.roomType}</p>
          <p className="text-xs text-ink/55">
            {r.room ? `Room ${r.room}` : 'Not assigned'}
            {r.room && r.roomBy ? (r.roomBy.auto ? ' · assigned this morning' : ' · assigned by the rules') : ''}
          </p>
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
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} guests={guests} reservations={reservations} /> },
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <div>
          <p>Room {r.room}</p>
          {r.departure < TODAY && <p className="text-xs font-medium text-bad">Was due {dayMonth(r.departure)}</p>}
          {checkouts.some((x) => x.reservationId === r.id && x.state === 'requested') && (
            <p className="text-xs font-medium text-brand">Checking out online</p>
          )}
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
    { key: 'guest', header: 'Guest', cell: (r) => <GuestCell r={r} guests={guests} reservations={reservations} /> },
    { key: 'type', header: 'Room', hideBelow: 'md', cell: (r) => r.roomType },
    { key: 'pay', header: 'Payment', cell: (r) => <PaymentBadge r={r} /> },
  ]

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">
              {greeting()}
              {user ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/60">
              <span>{todayLabel}</span>
              <span aria-hidden="true">·</span>
              <DataSourceBadge />
              <span aria-hidden="true">·</span>
              {plural(day.expected.length, 'arrival', 'arrivals')} still expected ·{' '}
              {plural(day.leaving.length, 'departure', 'departures')} ·{' '}
              {plural(day.owing.length, 'balance', 'balances')} due
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-nowrap">
            <button
              type="button"
              onClick={() => setPanel('attention')}
              className={
                attention.length === 0
                  ? onBrandGhost
                  : urgent
                    ? `${onBrand} border-transparent bg-bad text-white hover:bg-bad/90`
                    : `${onBrand} border-transparent bg-accent text-ink hover:bg-accent/90`
              }
            >
              <Icon name={attention.length ? 'alert' : 'check'} className="h-4 w-4" />
              {attention.length ? 'Needs attention' : 'All clear'}
              {attention.length > 0 && (
                <span className={`rounded-full bg-white px-1.5 text-xs font-bold leading-5 ${urgent ? 'text-bad' : 'text-warn'}`}>
                  {attention.length}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setPanel('suggestions')} className={onBrandGhost}>
              <Icon name="sparkles" className="h-4 w-4" />
              Suggestions
              {suggestions.length > 0 && (
                <span className="rounded-full bg-ink/8 px-1.5 text-xs font-bold leading-5">{suggestions.length}</span>
              )}
            </button>
            <Link to="/desk/rooms" className={onBrandGhost}>
              <Icon name="bed" className="h-4 w-4" />
              Rooms board
            </Link>
            <Link to="/desk/reservations" className={onBrandGhost}>
              <Icon name="list" className="h-4 w-4" />
              All reservations
            </Link>
          </div>
        </div>
      </section>

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Arrivals"
          icon="arrival"
          value={day.expected.length}
          hint={`${day.arrivedCount} checked in today`}
          to="/desk/reservations?view=arrivals"
        />
        <StatCard
          label="Departures"
          icon="departure"
          value={day.leaving.length}
          hint={`${day.checkedOutCount} checked out today`}
          to="/desk/folios?view=leaving"
        />
        <StatCard label="In house"
          icon="guests" value={day.inHouse.length} hint="Guests staying" to="/desk/reservations?view=in-house" />
        <StatCard label="Occupancy"
          icon="occupancy" value={`${occupancy}%`} hint={`${day.occupied} of ${day.sellable} rooms`} to="/desk/rooms" />
        <StatCard
          label="Balances due"
          icon="money"
          value={day.owing.length}
          hint={day.owing.length ? `${ugx(day.owedTotal)} owed` : 'All settled'}
          to="/desk/folios"
          tone={day.owing.length > 0 ? 'bad' : 'default'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <GuestRequestsCard />
          <ServiceBookingsCard />

          <Card
            icon="arrival"
            title="Arrivals today"
            count={day.expected.length}
            description="Booked to arrive today and not yet checked in."
            actions={<AssignRoomsButton />}
            padded={false}
          >
            <DataTable
              columns={arrivalColumns}
              rows={day.expected.slice(0, SHOW)}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              empty={{ title: 'No arrivals waiting', hint: 'Everyone expected today has checked in.' }}
            />
            <SeeAll count={day.expected.length} to="/desk/reservations?view=arrivals" noun="arrivals" />
          </Card>

          <OnlineCheckoutCard />

          <Card icon="departure" title="Departures" count={day.leaving.length} description="Due out today, plus anyone past their departure date." padded={false}>
            <DataTable
              columns={departureColumns}
              rows={day.leaving.slice(0, SHOW)}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              empty={{ title: 'No departures left', hint: 'No one else is due to leave today.' }}
            />
            <SeeAll count={day.leaving.length} to="/desk/folios?view=leaving" noun="departures" />
          </Card>

          <Card icon="calendar" title="Upcoming arrivals" count={upcoming.length} description="Booked to arrive in the next 3 days." padded={false}>
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

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <ExpressCheckoutCard />
          <ConfirmCallsCard />
          <TasksCard />
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
      {panel === 'attention' && (
        <AttentionPanel
          items={attention}
          onClose={() => setPanel(null)}
          onOpen={(id) => {
            setPanel(null)
            setOpenId(id)
          }}
        />
      )}
      {panel === 'suggestions' && <SuggestionsPanel items={suggestions} onClose={() => setPanel(null)} />}
      {checkingIn && <CheckInPanel reservation={checkingIn} room={checkIn?.room} onClose={() => setCheckIn(null)} />}
    </div>
  )
}
