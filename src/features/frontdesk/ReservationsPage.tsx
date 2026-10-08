import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { roomTypes } from '../../lib/booking'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { BIG_HOTEL } from '../../lib/rooms'
import type { Reservation } from '../../types'
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
  none: 'Not recorded',
}

const views = [
  { key: 'all', label: 'All' },
  { key: 'arrivals', label: 'Arrivals today' },
  { key: 'departures', label: 'Departures today' },
  { key: 'in-house', label: 'In house' },
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

const box = 'rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand'

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

  const changed =
    view !== 'all' ||
    dates !== datesDefault ||
    status !== 'all' ||
    source !== 'all' ||
    type !== 'all' ||
    payment !== 'all' ||
    sort !== 'stay' ||
    q !== ''

  const selected = reservations.find((r) => r.id === selectedId) ?? null
  const checkingIn = reservations.find((r) => r.id === checkInId) ?? null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reservations</h1>
        <p className="text-sm text-ink/60">Click a guest to see the booking without leaving this page.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setParam('view', v.key, 'all')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              view === v.key ? 'bg-brand text-white' : 'bg-surface text-ink/70 hover:bg-brand/10'
            }`}
          >
            {v.label} {viewCounts[v.key]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3">
        <label className="block text-xs font-medium text-ink/60">
          Search
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPageNo(0)
            }}
            placeholder="Guest, booking or room"
            className={`${box} mt-0.5 block text-ink`}
          />
        </label>
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
        {changed && (
          <button type="button" onClick={clear} className="pb-2 text-sm font-semibold text-brand">
            Reset filters
          </button>
        )}
      </div>

      <p className="text-xs text-ink/60">
        {rows.length === 0
          ? 'No reservations match.'
          : `Showing ${current * PAGE + 1} to ${current * PAGE + shown.length} of ${rows.length} reservations (${reservations.length} in total)`}
        {big && dates === 'week' && '. This hotel opens on the next 7 days. Change Dates to see more.'}
      </p>

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Stay</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {shown.map((r) => {
              const balance = r.total - r.paid
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`cursor-pointer hover:bg-canvas ${selectedId === r.id ? 'bg-canvas' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setSelectedId(r.id)} className="font-semibold text-brand">
                      {r.guest}
                    </button>
                  </td>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium">
                      {sourceLabel[r.source ?? 'none']}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.room ?? r.roomType}</td>
                  <td className="px-4 py-3">
                    {dayMonth(r.arrival)} to {dayMonth(r.departure)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${balance > 0 ? 'text-bad' : 'text-good'}`}>
                    {ugx(balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-ink/60">No reservations match these filters.</p>}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPageNo(current - 1)}
            disabled={current === 0}
            className="rounded-lg border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-ink/60">
            Page {current + 1} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPageNo(current + 1)}
            disabled={current >= pages - 1}
            className="rounded-lg border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {selected && (
        <ReservationPanel
          reservation={selected}
          onClose={() => setSelectedId(null)}
          onCheckIn={() => setCheckInId(selected.id)}
        />
      )}
      {checkingIn && <CheckInPanel reservation={checkingIn} onClose={() => setCheckInId(null)} />}
    </div>
  )
}