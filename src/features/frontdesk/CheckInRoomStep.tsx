import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui'
import { floorLabel, floorOf } from '../../lib/rooms'
import type { Proposal } from '../../lib/roomAssign'
import type { Reservation, Room } from '../../types'
import ArrivalRoomHelp from './ArrivalRoomHelp'

const SHOW = 24
const box =
  'rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'

// Choose the room for a check-in. Only clean rooms that are free for the whole stay can be picked.
// Dirty rooms of the same type are shown greyed out, so the desk can see why the list is short.
export default function CheckInRoomStep({
  type,
  ready,
  dirty,
  booked,
  reservation,
  value,
  onChange,
  suggestion,
}: {
  type: string
  ready: Room[]
  dirty: Room[]
  /** The room already assigned to this booking, if any. */
  booked?: string | null
  reservation: Reservation
  value: string
  onChange: (room: string) => void
  /** The room the assignment rules propose, when the hotel has them and the stay has no room yet. */
  suggestion?: Proposal
}) {
  const [q, setQ] = useState('')
  const [floor, setFloor] = useState('all')

  const floors = useMemo(() => [...new Set(ready.map(floorOf))].sort((a, b) => a - b), [ready])

  const list = useMemo(
    () =>
      ready
        .filter((r) => (floor === 'all' || floorOf(r) === Number(floor)) && (q.trim() === '' || r.number.includes(q.trim())))
        .sort(
          (a, b) =>
            Number(b.number === booked) - Number(a.number === booked) ||
            Number(b.number === suggestion?.room) - Number(a.number === suggestion?.room) ||
            Number(a.number) - Number(b.number),
        ),
    [ready, floor, q, booked, suggestion?.room],
  )
  const shown = list.slice(0, SHOW)

  if (ready.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          No clean {type} room is free for this stay.
          {dirty.length > 0 && ` ${dirty.length} ${type} room${dirty.length === 1 ? ' is' : 's are'} dirty. Ask housekeeping to clean one first.`}
        </div>
        <ArrivalRoomHelp reservation={reservation} force />
      </div>
    )
  }

  const suggested = suggestion?.room && ready.some((r) => r.number === suggestion.room) ? suggestion : undefined

  return (
    <div className="space-y-4">
      {suggested && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/25 bg-brand/[0.06] px-3 py-2 text-sm">
          <span>
            <b>Suggested: {suggested.reason}</b>
          </span>
          {value !== suggested.room && (
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => onChange(suggested.room as string)}>
              Use it
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Room number"
          aria-label="Room number"
          className={`${box} w-40`}
        />
        {floors.length > 1 && (
          <select value={floor} onChange={(e) => setFloor(e.target.value)} aria-label="Floor" className={box}>
            <option value="all">All floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                {floorLabel(f)}
              </option>
            ))}
          </select>
        )}
      </div>

      {shown.length === 0 && <p className="text-sm text-ink/60">No ready room matches.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((r) => {
          const on = r.number === value
          return (
            <button
              key={r.number}
              type="button"
              onClick={() => onChange(r.number)}
              aria-pressed={on}
              className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                on
                  ? 'border-brand bg-linear-to-br from-brand/15 to-surface ring-2 ring-brand'
                  : 'border-ink/10 bg-surface shadow-sm hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold text-ink">{r.number}</span>
                {r.number === booked && <Badge tone="brand">Booked room</Badge>}
                {r.number !== booked && r.number === suggested?.room && <Badge tone="brand">Suggested</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-ink/60">
                {floorLabel(floorOf(r))} · {r.type}
                {r.tags?.length ? ` · ${r.tags.join(', ')}` : ''}
              </p>
              <div className="mt-2">
                <Badge tone="good" dot>
                  Ready
                </Badge>
              </div>
            </button>
          )
        })}
      </div>

      {dirty.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-ink/55">Not ready yet, so they cannot be picked:</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dirty.slice(0, 6).map((r) => (
              <div key={r.number} className="rounded-xl border border-ink/10 bg-canvas/60 p-3 opacity-70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-bold text-ink/60">{r.number}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink/55">
                  {floorLabel(floorOf(r))} · {r.type}
                </p>
                <div className="mt-2">
                  <Badge tone="warn">{r.hk === 'cleaning' ? 'Being cleaned' : 'Needs cleaning'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink/55">
        {list.length > SHOW
          ? `Showing ${SHOW} of ${list.length} ready rooms. `
          : `${list.length} ready room${list.length === 1 ? '' : 's'}. `}
        Clean and free for the whole stay.
      </p>
    </div>
  )
}
