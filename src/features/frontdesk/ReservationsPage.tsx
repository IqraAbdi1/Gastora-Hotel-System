import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, Chip, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { roomTypes } from '../../lib/booking'
import { dayMonth, ugx } from '../../lib/format'
import { summarizeDay } from '../../lib/frontdesk'
import { useHotel } from '../../lib/hotelContext'
import { BIG_HOTEL } from '../../lib/rooms'
import { partyLabel, partyOf, stillIn } from '../../lib/party'
import type { Reservation } from '../../types'
import AssignRoomsButton from './AssignRoomsDialog'
import CheckInPanel from './CheckInPanel'
import ReservationPanel from './ReservationPanel'

const PAGE = 25

type Source = NonNullable<Reservation['source']>

const sourceLabel: Record<Source | 'none', string> = {
  'walk-in': 'Walk-in',
  'front desk': 'Front desk',
  phone: 'Phone',
  email: 'Email',
  online: 'Online',
  ota: 'OTA',
  agent: 'Travel agent',
  none: 'Not recorded',
}

const views = [
  { key: 'all', label: 'All' },
  { key: 'arrivals', label: 'Arrivals today', dot: 'bg-accent' },
  { key: 'departures', label: 'Departures today', dot: 'bg-warn' },
  { key: 'in-house', label: 'In house', dot: 'bg-brand' },
]

const datesList = [
  { key: 'any', label: 'Any dates' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'past', label: 'Ended in the last 7 days' },
]

const sortList = [
  { key: 'stay', label: 'Arrival date' },
  { key: 'latest', label: 'Latest booked' },
  { key: 'guest', label: 'Guest A to Z' },
  { key: 'balance', label: 'Highest balance' },
]

function filterFor(view: string, list: Reservation[]) {
  if (view === 'arrivals') return list.filter((r) => r.status === 'booked' && r.arrival === TODAY)
  if (view === 'departures') return list.filter((r) => r.status === 'in-house' && r.departure === TODAY)
  if (view === 'in-house') return list.filter((r) => r.status === 'in-house')
  return list
}

// A stay counts for a window if any part of it falls inside the window.
function inDates(key: string, r: Reservation) {
  if (key === 'today') return r.arrival <= TODAY && r.departure >= TODAY
  if (key === 'week') return r.arrival <= addDays(TODAY, 7) && r.departure >= TODAY
  if (key === 'month') {
    const m = TODAY.slice(0, 7)
    return r.arrival.slice(0, 7) <= m && r.departure.slice(0, 7) >= m
  }
  if (key === 'past') return r.departure < TODAY && r.departure >= addDays(TODAY, -7)
  return true
}

const idNum = (r: Reservation) => parseInt(r.id.replace('R-', ''), 10) || 0

const sorters: Record<string, (a: Reservation, b: Reservation) => number> = {
  stay: (a, b) => a.arrival.localeCompare(b.arrival) || a.guest.localeCompare(b.guest),
  latest: (a, b) => idNum(b) - idNum(a),
  guest: (a, b) => a.guest.localeCompare(b.guest),
  balance: (a, b) => b.total - b.paid - (a.total - a.paid),
}

const box = 'rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'

function Pick({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <label className="block text-xs font-medium text-ink/60">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${box} mt-0.5 block text-ink`}>
        {children}
      </select>
    </label>
  )
}

export default function ReservationsPage() {
  const { reservations, rooms } = useHotel()
  const big = rooms.length > BIG_HOTEL
  const datesDefault = big ? 'week' : 'any'

  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pageNo, setPageNo] = useState(0)

  const view = params.get('view') ?? 'all'
  const dates = params.get('dates') ?? datesDefault
  const status = params.get('status') ?? 'all'
  const source = params.get('source') ?? 'all'
  const type = params.get('type') ?? 'all'
  const payment = params.get('payment') ?? 'all'
  const sort = params.get('sort') ?? 'stay'
  const q = search.trim().toLowerCase()

  function setParam(key: string, value: string, def: string) {
    const next = new URLSearchParams(params)
    if (value === def) next.delete(key)
    else next.set(key, value)
    setParams(next)
    setPageNo(0)
  }

  function clear() {
    setParams({})
    setSearch('')
    setPageNo(0)
  }

  const day = useMemo(() => summarizeDay(reservations, rooms, TODAY), [reservations, rooms])
  const availableTonight = Math.max(0, day.sellable - day.occupied)

  const rows = useMemo(() => {
    const list = filterFor(view, reservations).filter(
      (r) =>
        inDates(dates, r) &&
        (status === 'all' || r.status === status) &&
        (source === 'all' || (r.source ?? 'none') === source) &&
        (type === 'all' || r.roomType === type) &&
        (payment === 'all' ||
          (payment === 'none' ? r.paid === 0 : payment === 'balance' ? r.paid < r.total : r.paid >= r.total)) &&
        (q === '' || r.guest.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.room ?? '').includes(q)),
    )
    return list.sort(sorters[sort] ?? sorters.stay)
  }, [reservations, view, dates, status, source, type, payment, q, sort])

  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reservations) m.set(r.source ?? 'none', (m.get(r.source ?? 'none') ?? 0) + 1)
    return m
  }, [reservations])

  const viewCounts = useMemo(
    () => Object.fromEntries(views.map((v) => [v.key, filterFor(v.key, reservations).length])),
    [reservations],
  )

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(pageNo, pages - 1)
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE)

  // How many of the dropdown filters are set. The search box and the quick chips show their own state.
  const activeFilters = [
    dates !== datesDefault,
    status !== 'all',
    source !== 'all',
    type !== 'all',
    payment !== 'all',
    sort !== 'stay',
  ].filter(Boolean).length
  const changed = activeFilters > 0 || view !== 'all' || q !== ''

  const selected = reservations.find((r) => r.id === selectedId) ?? null
  const checkingIn = reservations.find((r) => r.id === checkInId) ?? null

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.guest}</p>
          <p className="text-xs text-ink/55">
            {r.id}
            {r.party ? ` · ${partyLabel(partyOf(reservations, r).filter(stillIn).length)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      hideBelow: 'lg',
      cell: (r) => <Badge>{sourceLabel[r.source ?? 'none']}</Badge>,
    },
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <div>
          <p>{r.room ? `Room ${r.room}` : 'Not assigned'}</p>
          <p className="text-xs text-ink/55">
            {r.roomType}
            {r.roomBy && r.status === 'booked' ? ' · by the rules' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      cell: (r) => (
        <span>
          {dayMonth(r.arrival)} to {dayMonth(r.departure)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (r) => {
        const balance = r.total - r.paid
        return (
          <span className={`font-semibold tabular-nums ${balance > 0 ? 'text-bad' : 'text-good'}`}>{ugx(balance)}</span>
        )
      },
    },
    {
      key: 'act',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (r) =>
        r.status === 'booked' && r.arrival <= TODAY ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setCheckInId(r.id)
            }}
          >
            Check in
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservations"
        description="Click a booking to see it without leaving this page. Guests due today have a Check in button."
        actions={<AssignRoomsButton size="md" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Arrivals today"
          icon="arrival"
          value={day.expected.length}
          hint={`${day.arrivedCount} checked in`}
          active={view === 'arrivals'}
          onClick={() => setParam('view', view === 'arrivals' ? 'all' : 'arrivals', 'all')}
        />
        <StatCard
          label="Departures today"
          icon="departure"
          value={day.leaving.length}
          hint={`${day.checkedOutCount} checked out`}
          active={view === 'departures'}
          onClick={() => setParam('view', view === 'departures' ? 'all' : 'departures', 'all')}
        />
        <StatCard
          label="In house"
          icon="guests"
          value={day.inHouse.length}
          hint={`${day.occupied} rooms occupied`}
          active={view === 'in-house'}
          onClick={() => setParam('view', view === 'in-house' ? 'all' : 'in-house', 'all')}
        />
        <StatCard
          label="Available tonight"
          icon="bed"
          value={availableTonight}
          hint={`of ${day.sellable} sellable rooms`}
          to="/desk/rooms"
          tone={availableTonight === 0 ? 'bad' : 'good'}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Chip
            key={v.key}
            active={view === v.key}
            dot={v.dot}
            count={viewCounts[v.key]}
            onClick={() => setParam('view', v.key, 'all')}
          >
            {v.label}
          </Chip>
        ))}
        {changed && (
          <button type="button" onClick={clear} className="px-2 text-sm font-semibold text-brand hover:underline">
            Reset filters
          </button>
        )}
      </div>

      <FilterBar
        query={search}
        onQuery={(v) => {
          setSearch(v)
          setPageNo(0)
        }}
        placeholder="Search guest, booking or room"
        active={activeFilters}
      >
        <Pick label="Dates" value={dates} onChange={(v) => setParam('dates', v, datesDefault)}>
          {datesList.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </Pick>
        <Pick label="Status" value={status} onChange={(v) => setParam('status', v, 'all')}>
          <option value="all">Any status</option>
          <option value="booked">Booked</option>
          <option value="in-house">In house</option>
          <option value="checked-out">Checked out</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No-show</option>
        </Pick>
        <Pick label="Source" value={source} onChange={(v) => setParam('source', v, 'all')}>
          <option value="all">Any source</option>
          {(Object.keys(sourceLabel) as (Source | 'none')[]).map((s) => (
            <option key={s} value={s}>
              {sourceLabel[s]} ({sourceCounts.get(s) ?? 0})
            </option>
          ))}
        </Pick>
        <Pick label="Room type" value={type} onChange={(v) => setParam('type', v, 'all')}>
          <option value="all">Any type</option>
          {roomTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Pick>
        <Pick label="Payment" value={payment} onChange={(v) => setParam('payment', v, 'all')}>
          <option value="all">Any payment</option>
          <option value="none">No deposit</option>
          <option value="balance">Balance due</option>
          <option value="settled">Fully paid</option>
        </Pick>
        <Pick label="Sort by" value={sort} onChange={(v) => setParam('sort', v, 'stay')}>
          {sortList.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Pick>
      </FilterBar>

      <Card
        title="Bookings"
        icon="list"
        count={rows.length}
        description={
          rows.length === 0
            ? 'No reservations match.'
            : `Showing ${current * PAGE + 1} to ${current * PAGE + shown.length} of ${rows.length} (${reservations.length} in total)${
                big && dates === 'week' ? '. This hotel opens on the next 7 days. Change Dates to see more.' : ''
              }`
        }
        padded={false}
      >
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          empty={{ title: 'No reservations match these filters', hint: 'Change a filter or reset them.' }}
        />
        {pages > 1 && (
          <div className="flex items-center justify-end gap-3 border-t border-ink/10 px-4 py-2.5 text-sm">
            <Button variant="ghost" size="sm" onClick={() => setPageNo(current - 1)} disabled={current === 0}>
              Previous
            </Button>
            <span className="text-ink/60">
              Page {current + 1} of {pages}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPageNo(current + 1)} disabled={current >= pages - 1}>
              Next
            </Button>
          </div>
        )}
      </Card>

      {selected && (
        <ReservationPanel
          reservation={selected}
          onClose={() => setSelectedId(null)}
          onCheckIn={() => {
            setCheckInId(selected.id)
            setSelectedId(null)
          }}
        />
      )}
      {checkingIn && <CheckInPanel reservation={checkingIn} onClose={() => setCheckInId(null)} />}
    </div>
  )
}
