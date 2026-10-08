import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useHotel } from '../../lib/hotelContext'
import { TODAY } from '../../data/sample'
import { addDays, clashingStay } from '../../lib/availability'
import { dayMonth, ugx } from '../../lib/format'
import { BIG_HOTEL, floorLabel, floorOf } from '../../lib/rooms'
import { useBooking } from '../../lib/bookingContext'
import type { Reservation, ReservationStatus, Room, RoomStatus } from '../../types'

const LABEL = 120
const ROW = 40
const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

const barStyle: Record<ReservationStatus, string> = {
  'in-house': 'bg-brand text-white',
  booked: 'bg-accent text-ink',
  'checked-out': 'bg-ink/25 text-ink',
}

const statusLabel: Record<ReservationStatus, string> = {
  'in-house': 'In house',
  booked: 'Booked',
  'checked-out': 'Checked out',
}

const dot: Record<RoomStatus, string> = {
  clean: 'bg-good',
  dirty: 'bg-warn',
  occupied: 'bg-brand',
  blocked: 'bg-bad',
}

const control = 'rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand'

type Selection = { kind: 'stay'; stay: Reservation } | { kind: 'cell'; room: Room; date: string }

function diff(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

function weekday(iso: string) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

function monthName(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function flagFor(r: Reservation) {
  if (r.status === 'booked' && r.paid === 0) return 'No deposit'
  if (r.status === 'in-house' && r.paid < r.total) return 'Balance due'
  return null
}

export default function RoomsCalendar() {
  const { rooms, reservations } = useHotel()
  const { openBooking } = useBooking()
  const big = rooms.length > BIG_HOTEL

  const [start, setStart] = useState(TODAY)
  const [days, setDays] = useState(14)
  const [typeFilter, setTypeFilter] = useState<Room['type'] | 'all'>('all')
  const [floor, setFloor] = useState<number | 'all'>('all')
  const [attention, setAttention] = useState(false)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [selection, setSelection] = useState<Selection | null>(null)

  const cell = days <= 7 ? 96 : days <= 14 ? 64 : 44
  const half = cell / 2
  const width = days * cell
  const q = search.trim().toLowerCase()

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days])
  const live = useMemo(() => reservations.filter((r) => r.status !== 'checked-out'), [reservations])

  // Built once per data change, so each room row is a quick lookup instead of a search.
  const byRoom = useMemo(() => {
    const m = new Map<string, Reservation[]>()
    for (const r of live) {
      if (!r.room) continue
      const list = m.get(r.room)
      if (list) list.push(r)
      else m.set(r.room, [r])
    }
    return m
  }, [live])

  const unassignedByType = useMemo(() => {
    const m = new Map<Room['type'], Reservation[]>()
    for (const r of live) {
      if (r.room) continue
      const list = m.get(r.roomType)
      if (list) list.push(r)
      else m.set(r.roomType, [r])
    }
    return m
  }, [live])

  const arrivalTypesToday = useMemo(
    () => new Set(reservations.filter((r) => r.status === 'booked' && r.arrival === TODAY).map((r) => r.roomType)),
    [reservations],
  )

  const flaggedCount = useMemo(() => live.filter((r) => flagFor(r)).length, [live])
  const floors = useMemo(() => Array.from(new Set(rooms.map(floorOf))).sort((a, b) => a - b), [rooms])

  // Rooms booked per type per night, counted in one pass over the reservations.
  const booked = useMemo(() => {
    const out: Record<string, number[]> = {}
    for (const t of types) out[t] = new Array<number>(days).fill(0)
    for (const r of live) {
      const a = Math.max(0, diff(start, r.arrival))
      const d = Math.min(days, diff(start, r.departure))
      for (let i = a; i < d; i++) out[r.roomType][i] += 1
    }
    return out
  }, [live, start, days])

  const totals = useMemo(() => {
    const out: Record<string, { total: number; blocked: number }> = {}
    for (const t of types) out[t] = { total: 0, blocked: 0 }
    for (const r of rooms) {
      out[r.type].total += 1
      if (r.status === 'blocked') out[r.type].blocked += 1
    }
    return out
  }, [rooms])

  const months: { key: string; label: string; count: number }[] = []
  dates.forEach((d) => {
    const key = d.slice(0, 7)
    const last = months[months.length - 1]
    if (last && last.key === key) last.count += 1
    else months.push({ key, label: monthName(d), count: 1 })
  })

  const roomAlert = (room: Room) => room.status === 'dirty' && arrivalTypesToday.has(room.type)
  const needsAttention = (room: Room) => (byRoom.get(room.number)?.some((r) => flagFor(r)) ?? false) || roomAlert(room)
  const matches = (room: Room) =>
    q === '' || room.number.includes(q) || (byRoom.get(room.number)?.some((r) => r.guest.toLowerCase().includes(q)) ?? false)

  const visible = rooms.filter(
    (r) =>
      (typeFilter === 'all' || r.type === typeFilter) &&
      (floor === 'all' || floorOf(r) === floor) &&
      matches(r) &&
      (!attention || needsAttention(r)),
  )

  // Large hotels open with the room-type groups folded, and unfold when you filter or search.
  const filtersOn = q !== '' || attention || floor !== 'all'
  const isOpen = (t: string) => open[t] ?? (!big || filtersOn)

  const barSpan = (r: Reservation) => {
    const a = diff(start, r.arrival)
    const d = diff(start, r.departure)
    if (d < 0 || a >= days) return null
    const from = a < 0 ? 1 : a * 2 + 2
    const to = Math.min(d * 2 + 2, days * 2 + 1)
    return to > from ? { from, to } : null
  }

  const bar = (r: Reservation, from: number, to: number, row: number) => {
    const flag = flagFor(r)
    const faded = q !== '' && !r.guest.toLowerCase().includes(q)
    return (
      <button
        key={r.id}
        type="button"
        title={`${r.guest} · ${dayMonth(r.arrival)} to ${dayMonth(r.departure)}${flag ? ` · ${flag}` : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setSelection({ kind: 'stay', stay: r })
        }}
        style={{ left: (from - 1) * half + 2, width: (to - from) * half - 4, top: (row - 1) * ROW + 3, height: ROW - 6 }}
        className={`absolute z-1 flex items-center gap-1 overflow-hidden rounded-md px-2 text-left text-xs font-semibold ${
          barStyle[r.status]
        } ${faded ? 'opacity-30' : ''}`}
      >
        {flag && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bad text-[10px] text-white">!</span>
        )}
        <span className="truncate">{r.guest}</span>
      </button>
    )
  }

  // Day lines are drawn as one background, so there is no element per cell.
  const lines = {
    width,
    backgroundImage: 'linear-gradient(to right, rgb(17 48 44 / 0.1) 1px, transparent 1px)',
    backgroundSize: `${cell}px 100%`,
  }

  const pickCell = (e: MouseEvent<HTMLDivElement>, room: Room) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.min(days - 1, Math.max(0, Math.floor((e.clientX - rect.left) / cell)))
    setSelection({ kind: 'cell', room, date: dates[i] })
  }

  const clash =
    selection?.kind === 'cell'
      ? clashingStay(selection.room.number, selection.date, addDays(selection.date, 1), reservations)
      : undefined
  const selFlag = selection?.kind === 'stay' ? flagFor(selection.stay) : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStart(addDays(start, -days))} className={control}>
          «
        </button>
        <button type="button" onClick={() => setStart(TODAY)} className={control}>
          Today
        </button>
        <button type="button" onClick={() => setStart(addDays(start, days))} className={control}>
          »
        </button>
        <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className={control} />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={control}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={31}>31 days</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as Room['type'] | 'all')} className={control}>
          <option value="all">All room types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={floor}
          onChange={(e) => setFloor(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className={control}
        >
          <option value="all">All floors</option>
          {floors.map((f) => (
            <option key={f} value={f}>
              {floorLabel(f)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAttention(!attention)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${attention ? 'bg-bad text-white' : 'bg-surface text-bad'}`}
        >
          Needs attention {flaggedCount}
        </button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find guest or room" className={control} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink/70">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand" /> In house</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent" /> Booked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink/25" /> Checked out</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-bad/30" /> Blocked</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-bad text-[10px] text-white">!</span> No deposit or balance due
        </span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-good" /> Clean</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warn" /> Dirty</span>
      </div>

      {big && !filtersOn && (
        <p className="text-xs text-ink/60">
          This is a large hotel, so the room types are folded. Open one, or filter by floor or search, to see its rooms. The numbers at the bottom always cover the whole hotel.
        </p>
      )}

      <div className="overflow-auto rounded-xl border border-ink/10 bg-surface" style={{ maxHeight: '65vh' }}>
        <div style={{ minWidth: LABEL + width }}>
          <div className="sticky top-0 z-20 flex bg-surface">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end bg-surface px-3 pb-1 text-xs font-semibold"
              style={{ width: LABEL }}
            >
              Room
            </div>
            <div>
              <div className="flex">
                {months.map((m) => (
                  <div
                    key={m.key}
                    style={{ width: m.count * cell }}
                    className="truncate border-l border-ink/10 bg-canvas px-2 py-1 text-xs font-semibold"
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="flex">
                {dates.map((d) => {
                  const wd = weekday(d)
                  return (
                    <div
                      key={d}
                      style={{ width: cell }}
                      className={`border-b border-l border-ink/10 py-1 text-center ${
                        d === TODAY ? 'bg-accent/30' : wd === 0 || wd === 6 ? 'bg-ink/5' : ''
                      }`}
                    >
                      <p className="text-sm font-semibold leading-tight">{Number(d.slice(8))}</p>
                      <p className="text-[10px] text-ink/60">{'SMTWTFS'[wd]}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="relative">
            {/* Today and weekend shading: a few columns for the whole table, not one per cell. */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL, width }}>
              {dates.map((d, i) => {
                const wd = weekday(d)
                const tone = d === TODAY ? 'bg-accent/15' : wd === 0 || wd === 6 ? 'bg-ink/5' : ''
                return tone ? <div key={d} className={`absolute inset-y-0 ${tone}`} style={{ left: i * cell, width: cell }} /> : null
              })}
            </div>

            {types
              .filter((t) => typeFilter === 'all' || t === typeFilter)
              .map((t) => {
                const list = visible.filter((r) => r.type === t)
                const unassignedAll = unassignedByType.get(t) ?? []
                if (list.length === 0 && unassignedAll.length === 0) return null
                const opened = isOpen(t)

                // Bookings with no room yet, packed into rows so overlaps do not hide each other.
                const ends: number[] = []
                const laneItems = opened
                  ? unassignedAll
                      .filter((r) => !attention || flagFor(r))
                      .flatMap((r) => {
                        const s = barSpan(r)
                        return s ? [{ r, from: s.from, to: s.to }] : []
                      })
                      .sort((a, b) => a.from - b.from)
                      .map((u) => {
                        let row = ends.findIndex((e) => e <= u.from)
                        if (row === -1) {
                          row = ends.length
                          ends.push(u.to)
                        } else {
                          ends[row] = u.to
                        }
                        return { ...u, row: row + 1 }
                      })
                  : []
                const laneRows = Math.max(1, ends.length)

                return (
                  <div key={t}>
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [t]: !opened }))}
                      className="block w-full border-t border-ink/10 bg-canvas py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink/60"
                    >
                      <span className="sticky left-0 inline-block px-3">
                        {opened ? '▾' : '▸'} {t} · {list.length} rooms
                        {unassignedAll.length > 0 && ` · ${unassignedAll.length} unassigned`}
                      </span>
                    </button>

                    {opened && (
                      <>
                        {list.map((room) => {
                          const stays = (byRoom.get(room.number) ?? []).filter((r) => !attention || flagFor(r))
                          return (
                            <div key={room.number} className="flex border-t border-ink/10">
                              <div
                                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-surface px-3 text-sm font-semibold"
                                style={{ width: LABEL }}
                                title={`Room ${room.number} is ${room.status}`}
                              >
                                <span className={`h-2.5 w-2.5 rounded-full ${dot[room.status]}`} />
                                {room.number}
                                {roomAlert(room) && (
                                  <span
                                    title="Dirty, and a guest of this type arrives today"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-warn text-[10px] text-white"
                                  >
                                    !
                                  </span>
                                )}
                              </div>
                              <div
                                onClick={(e) => pickCell(e, room)}
                                className="relative cursor-pointer hover:bg-brand/5"
                                style={{ ...lines, height: ROW }}
                              >
                                {room.status === 'blocked' && (
                                  <div className="pointer-events-none absolute inset-1 z-1 flex items-center rounded-md bg-bad/15 px-2 text-xs font-semibold text-bad">
                                    Blocked
                                  </div>
                                )}
                                {stays.map((r) => {
                                  const s = barSpan(r)
                                  return s ? bar(r, s.from, s.to, 1) : null
                                })}
                              </div>
                            </div>
                          )
                        })}

                        <div className="flex border-t border-dashed border-ink/20">
                          <div
                            className="sticky left-0 z-10 flex shrink-0 items-center bg-surface px-3 text-xs italic text-ink/60"
                            style={{ width: LABEL }}
                          >
                            Unassigned
                          </div>
                          <div className="relative" style={{ ...lines, height: ROW * laneRows }}>
                            {laneItems.map((u) => bar(u.r, u.from, u.to, u.row))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

            <div className="border-t-2 border-ink/20 bg-canvas py-1.5">
              <span className="sticky left-0 inline-block px-3 text-xs font-semibold uppercase tracking-wide text-ink/60">
                Available by room type (whole hotel)
              </span>
            </div>
            {types.map((t) => (
              <div key={t} className="flex border-t border-ink/10 text-xs">
                <div className="sticky left-0 z-10 shrink-0 bg-surface px-3 py-2 font-semibold" style={{ width: LABEL }}>
                  {t}
                </div>
                {dates.map((d, i) => {
                  const free = totals[t].total - totals[t].blocked - booked[t][i]
                  return (
                    <div
                      key={d}
                      style={{ width: cell }}
                      className={`border-l border-ink/10 py-2 text-center font-semibold ${
                        free < 0 ? 'bg-bad/15 text-bad' : free === 0 ? 'bg-warn/15 text-warn' : 'text-ink'
                      }`}
                      title={free < 0 ? 'Overbooked' : undefined}
                    >
                      {free}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selection && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
            <h2 className="text-lg font-semibold">
              {selection.kind === 'stay' ? selection.stay.guest : `Room ${selection.room.number}`}
            </h2>
            <button type="button" onClick={() => setSelection(null)} className="text-sm font-semibold text-brand">
              Close
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {selection.kind === 'stay' ? (
              <>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${barStyle[selection.stay.status]}`}>
                  {statusLabel[selection.stay.status]}
                </span>
                {selFlag && <p className="rounded-lg bg-bad/10 p-3 font-semibold text-bad">{selFlag}</p>}
                <p>
                  {selection.stay.id} · {selection.stay.roomType} ·{' '}
                  {selection.stay.room ? `Room ${selection.stay.room}` : 'Room not assigned yet (assigned at check-in)'}
                </p>
                <p>
                  {dayMonth(selection.stay.arrival)} to {dayMonth(selection.stay.departure)} (
                  {diff(selection.stay.arrival, selection.stay.departure)} nights)
                </p>
                <p>
                  Total {ugx(selection.stay.total)} · Paid {ugx(selection.stay.paid)} · Balance{' '}
                  <span className="font-semibold">{ugx(selection.stay.total - selection.stay.paid)}</span>
                </p>
                <p className="text-ink/60">
                  {selection.stay.details ? 'Check-in details are on file.' : 'Check-in details not taken yet.'}
                </p>
              </>
            ) : (
              <>
                <p className="text-ink/60">
                  {selection.room.type} · {floorLabel(floorOf(selection.room))} · {dayMonth(selection.date)} · {selection.room.status}
                </p>
                {selection.room.status === 'blocked' ? (
                  <p className="rounded-lg bg-bad/10 p-3 text-bad">This room is blocked and cannot be sold.</p>
                ) : clash ? (
                  <p className="rounded-lg bg-canvas p-3">
                    Taken that night by <span className="font-semibold">{clash.guest}</span> ({clash.id}).
                  </p>
                ) : (
                  <>
                    <p className="rounded-lg bg-good/10 p-3 text-good">Free that night.</p>
                    <button
                      type="button"
                      onClick={() => {
                        openBooking({ room: selection.room.number, date: selection.date })
                        setSelection(null)
                      }}
                      className="inline-block rounded-lg bg-brand px-4 py-2 font-semibold text-white"
                    >
                      Book this room from here
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}