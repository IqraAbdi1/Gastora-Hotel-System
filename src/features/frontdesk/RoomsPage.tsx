import { useMemo, useState } from 'react'
import { useHotel } from '../../lib/hotelContext'
import { TODAY } from '../../data/sample'
import { addDays, isRoomFree } from '../../lib/availability'
import { dayMonth, ugx } from '../../lib/format'
import { BIG_HOTEL, floorLabel, floorOf } from '../../lib/rooms'
import type { Reservation, Room, RoomStatus } from '../../types'
import RoomsCalendar from './RoomsCalendar'

type Quick = 'all' | 'action' | 'ready' | 'leaving' | 'dirty' | 'occupied' | 'blocked'

const quickList: { key: Quick; label: string; dot?: string }[] = [
  { key: 'action', label: 'Needs action' },
  { key: 'ready', label: 'Ready to assign', dot: 'bg-good' },
  { key: 'leaving', label: 'Leaving today' },
  { key: 'dirty', label: 'Dirty', dot: 'bg-warn' },
  { key: 'occupied', label: 'Occupied', dot: 'bg-brand' },
  { key: 'blocked', label: 'Blocked', dot: 'bg-bad' },
  { key: 'all', label: 'All' },
]

const cardStyle: Record<RoomStatus, string> = {
  clean: 'border-good/40 bg-good/10',
  dirty: 'border-warn/50 bg-warn/15',
  occupied: 'border-brand/40 bg-brand/15',
  blocked: 'border-bad/40 bg-bad/10',
}

const pillStyle: Record<RoomStatus, string> = {
  clean: 'bg-good text-white',
  dirty: 'bg-warn text-white',
  occupied: 'bg-brand text-white',
  blocked: 'bg-bad text-white',
}

const dotStyle: Record<RoomStatus, string> = {
  clean: 'bg-good',
  dirty: 'bg-warn',
  occupied: 'bg-brand',
  blocked: 'bg-bad',
}

const input = 'rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-sm outline-none focus:border-brand'

export default function RoomsPage() {
  const { rooms, reservations } = useHotel()
  const big = rooms.length > BIG_HOTEL

  const [view, setView] = useState<'board' | 'calendar'>('board')
  const [quick, setQuick] = useState<Quick>(rooms.length > BIG_HOTEL ? 'action' : 'all')
  const [floor, setFloor] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<number[]>([])
  const [selected, setSelected] = useState<Room | null>(null)
  const [checking, setChecking] = useState(false)
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState(addDays(TODAY, 1))

  // Built once per data change, so each room card is a quick lookup instead of a search.
  const inHouse = useMemo(() => {
    const m = new Map<string, Reservation>()
    for (const r of reservations) if (r.room && r.status === 'in-house') m.set(r.room, r)
    return m
  }, [reservations])

  const nextBooking = useMemo(() => {
    const m = new Map<string, Reservation>()
    const sorted = reservations
      .filter((r) => r.room && r.status === 'booked' && r.arrival >= TODAY)
      .sort((a, b) => a.arrival.localeCompare(b.arrival))
    for (const r of sorted) if (r.room && !m.has(r.room)) m.set(r.room, r)
    return m
  }, [reservations])

  const leavingToday = (room: Room) => inHouse.get(room.number)?.departure === TODAY

  const test = (q: Quick, room: Room) => {
    switch (q) {
      case 'action':
        return room.status === 'dirty' || leavingToday(room)
      case 'ready':
        return room.status === 'clean'
      case 'leaving':
        return leavingToday(room)
      case 'dirty':
      case 'occupied':
      case 'blocked':
        return room.status === q
      default:
        return true
    }
  }

  const term = search.trim().toLowerCase()
  const searchOk = (room: Room) =>
    term === '' ||
    room.number.includes(term) ||
    (inHouse.get(room.number)?.guest.toLowerCase().includes(term) ?? false) ||
    (nextBooking.get(room.number)?.guest.toLowerCase().includes(term) ?? false)

  const floors = useMemo(() => Array.from(new Set(rooms.map(floorOf))).sort((a, b) => a - b), [rooms])
  const filtered = rooms.filter((r) => test(quick, r) && (floor === 'all' || floorOf(r) === floor) && searchOk(r))
  const groups = floors
    .map((f) => ({ floor: f, list: filtered.filter((r) => floorOf(r) === f) }))
    .filter((g) => g.list.length > 0)

  const rangeValid = to > from
  const freeCount = rooms.filter((r) => isRoomFree(r, from, to, reservations)).length

  const selStay = selected ? inHouse.get(selected.number) : undefined
  const selNext = selected ? nextBooking.get(selected.number) : undefined

  const toggle = (f: number) => setCollapsed((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))

  const tab = (v: 'board' | 'calendar') =>
    `rounded-lg px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-brand text-white' : 'bg-surface text-ink/70'}`

  const card = (room: Room) => {
    const stay = inHouse.get(room.number)
    const next = nextBooking.get(room.number)
    const free = checking && rangeValid && isRoomFree(room, from, to, reservations)
    const dim = checking && rangeValid && !free
    const ring = `${selected?.number === room.number ? 'ring-2 ring-brand' : ''} ${free ? 'ring-2 ring-good' : ''} ${
      dim ? 'opacity-30' : ''
    }`

    if (big) {
      return (
        <button
          key={room.number}
          type="button"
          onClick={() => setSelected(room)}
          title={`${room.number} · ${room.type} · ${room.status}`}
          className={`rounded-lg border-2 p-2 text-left hover:shadow ${cardStyle[room.status]} ${ring}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{room.number}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${dotStyle[room.status]}`} />
          </div>
          <p className="truncate text-xs text-ink/60">{stay ? stay.guest : room.type}</p>
        </button>
      )
    }

    return (
      <button
        key={room.number}
        type="button"
        onClick={() => setSelected(room)}
        className={`rounded-xl border-2 p-3 text-left transition hover:shadow ${cardStyle[room.status]} ${ring}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{room.number}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${pillStyle[room.status]}`}>
            {room.status}
          </span>
        </div>
        <p className="text-sm text-ink/60">{room.type}</p>
        {stay && (
          <p className="mt-2 text-sm font-medium">
            {stay.guest}
            <span className="block text-xs font-normal text-ink/60">
              {stay.departure === TODAY ? 'Leaves today' : `Leaves ${dayMonth(stay.departure)}`}
            </span>
          </p>
        )}
        {!stay && next && (
          <p className="mt-2 text-xs text-ink/60">
            Next: {next.guest}, {dayMonth(next.arrival)}
          </p>
        )}
        {free && <p className="mt-2 text-xs font-semibold text-good">Free for these dates</p>}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rooms</h1>
          <p className="text-sm text-ink/60">
            {view === 'board' ? 'Every room at a glance. Click a room for details.' : 'Stays by room and date.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('board')} className={tab('board')}>
            Board
          </button>
          <button type="button" onClick={() => setView('calendar')} className={tab('calendar')}>
            Calendar
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <RoomsCalendar />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {quickList.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setQuick(c.key)}
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  quick === c.key ? 'bg-brand text-white' : 'bg-surface text-ink/70'
                }`}
              >
                {c.dot && <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />}
                {c.label} {rooms.filter((r) => test(c.key, r)).length}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find room or guest"
              className={input}
            />
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className={input}
            >
              <option value="all">All floors</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={checking} onChange={(e) => setChecking(e.target.checked)} />
              Free from
            </label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            <span className="text-sm">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
            {checking && rangeValid && <span className="text-sm font-semibold text-good">{freeCount} rooms free</span>}
            {checking && !rangeValid && <span className="text-sm text-bad">The end date must be after the start date.</span>}
          </div>

          <p className="text-xs text-ink/60">
            Showing {filtered.length} of {rooms.length} rooms
            {big && quick === 'action' && '. This is a large hotel, so the board opens on the rooms that need action. Use the filters or search to see others.'}
          </p>

          {groups.length === 0 && <p className="rounded-xl bg-surface p-4 text-sm text-ink/60">No rooms match.</p>}

          {groups.map((g) => {
            const open = !collapsed.includes(g.floor)
            const dirtyN = g.list.filter((r) => r.status === 'dirty').length
            const leaveN = g.list.filter(leavingToday).length
            return (
              <section key={g.floor} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggle(g.floor)}
                  className="flex w-full items-center gap-2 py-1 text-left text-sm font-semibold"
                >
                  <span>{open ? '▾' : '▸'}</span>
                  {floorLabel(g.floor)}
                  <span className="font-normal text-ink/60">
                    · {g.list.length} rooms
                    {dirtyN > 0 && ` · ${dirtyN} dirty`}
                    {leaveN > 0 && ` · ${leaveN} leaving today`}
                  </span>
                </button>
                {open && (
                  <div
                    className={
                      big
                        ? 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8'
                        : 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4'
                    }
                  >
                    {g.list.map(card)}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}

      {view === 'board' && selected && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
            <div>
              <h2 className="text-lg font-semibold">Room {selected.number}</h2>
              <p className="text-sm text-ink/60">
                {selected.type} · {floorLabel(floorOf(selected))}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-brand">
              Close
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${pillStyle[selected.status]}`}>
              {selected.status}
            </span>

            {selStay ? (
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">In house</p>
                <p className="mt-1 font-semibold">{selStay.guest}</p>
                <p className="text-ink/60">
                  {selStay.id} · {dayMonth(selStay.arrival)} to {dayMonth(selStay.departure)}
                </p>
                <p className="mt-1">
                  Balance: <span className="font-semibold">{ugx(selStay.total - selStay.paid)}</span>
                </p>
              </div>
            ) : (
              <p className="text-ink/60">No guest in this room now.</p>
            )}

            {selNext && (
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Next booking</p>
                <p className="mt-1 font-semibold">{selNext.guest}</p>
                <p className="text-ink/60">
                  {selNext.id} · {dayMonth(selNext.arrival)} to {dayMonth(selNext.departure)}
                </p>
              </div>
            )}

            {selected.status === 'dirty' && (
              <p className="rounded-lg bg-warn/10 p-3 text-warn">
                This room needs cleaning before it can be used for a check-in. Housekeeping marks it clean.
              </p>
            )}
            {selected.status === 'blocked' && (
              <p className="rounded-lg bg-bad/10 p-3 text-bad">This room is blocked and cannot be sold.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}