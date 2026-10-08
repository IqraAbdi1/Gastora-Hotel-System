import { useMemo, useState } from 'react'
import { floorLabel } from '../../lib/rooms'
import type { Room } from '../../types'

type Props = {
  options: Room[] // clean, vacant, right type, free for the whole stay
  value: string
  onChange: (room: string) => void
  notReady: number // same-type rooms that are dirty, so she knows why the list is short
  type: string
}

const SHOW = 40
const floorOfRoom = (n: string) => Math.floor((Number(n) || 0) / 100)

export default function RoomPicker({ options, value, onChange, notReady, type }: Props) {
  const [open, setOpen] = useState(value === '')
  const [floor, setFloor] = useState('all')
  const [q, setQ] = useState('')

  const floors = useMemo(
    () => [...new Set(options.map((r) => floorOfRoom(r.number)))].sort((a, b) => a - b),
    [options],
  )

  const filtered = useMemo(
    () =>
      options.filter(
        (r) =>
          (floor === 'all' || floorOfRoom(r.number) === Number(floor)) &&
          (q.trim() === '' || r.number.includes(q.trim())),
      ),
    [options, floor, q],
  )

  const shown = filtered.slice(0, SHOW)
  const groups = useMemo(() => {
    const m = new Map<number, Room[]>()
    for (const r of shown) {
      const f = floorOfRoom(r.number)
      m.set(f, [...(m.get(f) ?? []), r])
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [shown])

  const chosen = options.find((r) => r.number === value)

  if (options.length === 0) {
    return (
      <div className="rounded-lg bg-warn/10 p-3 text-sm text-warn">
        No clean {type} room is free for this stay.
        {notReady > 0 && ` ${notReady} ${type} room${notReady === 1 ? ' is' : 's are'} dirty. Ask housekeeping to clean one first.`}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-ink/15 bg-canvas">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
      >
        <span>
          {chosen ? (
            <>
              <b>Room {chosen.number}</b> · {floorLabel(floorOfRoom(chosen.number))} · {chosen.type}
            </>
          ) : (
            'Choose a room'
          )}
        </span>
        <span className="font-semibold text-brand">{open ? 'Hide' : 'Change'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink/10 p-3">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Room number"
              className="w-full rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            {floors.length > 1 && (
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="rounded-lg border border-ink/15 bg-surface px-2 py-1.5 text-sm"
              >
                <option value="all">All floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {groups.length === 0 && <p className="text-sm text-ink/60">No room matches.</p>}

          {groups.map(([f, list]) => (
            <div key={f}>
              {(floors.length > 1 || groups.length > 1) && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">{floorLabel(f)}</p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {list.map((r) => (
                  <button
                    key={r.number}
                    type="button"
                    onClick={() => {
                      onChange(r.number)
                      setOpen(false)
                    }}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
                      r.number === value
                        ? 'border-brand bg-brand text-white'
                        : 'border-good/40 bg-good/10 text-ink hover:border-brand'
                    }`}
                  >
                    {r.number}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-ink/60">
            {filtered.length > SHOW
              ? `Showing ${SHOW} of ${filtered.length} ready rooms. Search or pick a floor to narrow it. `
              : `${filtered.length} ready room${filtered.length === 1 ? '' : 's'}. `}
            Only clean rooms that are free for the whole stay are listed.
            {notReady > 0 && ` ${notReady} more ${type} room${notReady === 1 ? ' is' : 's are'} not ready (dirty).`}
          </p>
        </div>
      )}
    </div>
  )
}