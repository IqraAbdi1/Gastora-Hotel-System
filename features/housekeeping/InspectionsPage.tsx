import { useMemo, useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from './hkContext'
import { priorityRank } from './hkModel'
import { Empty, PAGE, PageHeader, Pager, PriorityChip, btnGhost, btnPrimary, card, field } from './hkUi'
import { useRoomOverlays } from './useRoomOverlays'

// Supervisor queue: rooms the attendant has finished, waiting to be passed or sent back.
export default function InspectionsPage() {
  const hk = useHousekeeping()
  const { inspectionMode, options } = useFeatures()
  const { overlays, openRoom } = useRoomOverlays()
  const [page, setPage] = useState(0)
  const [failing, setFailing] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const queue = useMemo(
    () =>
      hk.rooms
        .filter((r) => r.status === 'Clean')
        .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.room.localeCompare(b.room)),
    [hk.rooms],
  )
  const inspected = useMemo(() => hk.rooms.filter((r) => r.status === 'Inspected').length, [hk.rooms])
  const shown = queue.slice(page * PAGE, page * PAGE + PAGE)

    const except = options.skipRushed ? ', except rooms the front desk rushed.' : '.'
  const modeText =
    inspectionMode === 'every'
      ? `Rule: every cleaned room is inspected${except}`
      : `Rule: about ${options.spotPercent}% of cleaned rooms are inspected${
          options.alwaysInspectArrivals ? ', plus every room with a guest arriving today' : ''
        }${except}`

  function fail(room: string) {
    if (!note.trim()) return
    hk.inspectRoom(room, false, note)
    setFailing(null)
    setNote('')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Inspections" hint="Pass a room to make it ready to sell, or send it back with a reason." />
      <p className="-mt-3 text-xs text-ink/60">{modeText}</p>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className={`${card} p-3`}>
          <p className="text-xs text-ink/60">Waiting for inspection</p>
          <p className="text-2xl font-bold text-brand">{queue.length}</p>
        </div>
        <div className={`${card} p-3`}>
          <p className="text-xs text-ink/60">Inspected, ready to sell</p>
          <p className="text-2xl font-bold text-brand">{inspected}</p>
        </div>
      </div>

      <div className={card}>
        <ul className="divide-y divide-ink/10">
          {shown.map((room) => {
            const details = hk.detailsOf(room.room)
            const open = failing === room.room
            return (
              <li key={room.room} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <button type="button" onClick={() => openRoom(room.room)} className="text-lg font-bold hover:text-brand">
                      Room {room.room}
                    </button>
                    <p className="text-sm text-ink/60">
                      {room.type} · {room.zone} · cleaned {details.lastCleaned}
                      {room.arrival && ` · ${room.arrival}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityChip priority={room.priority} />
                    <button type="button" onClick={() => hk.inspectRoom(room.room, true, '')} className={btnPrimary}>
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFailing(open ? null : room.room)
                        setNote('')
                      }}
                      className={btnGhost}
                    >
                      Fail
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What needs fixing? (required)"
                      className={field}
                      autoFocus
                    />
                    <button type="button" onClick={() => fail(room.room)} disabled={!note.trim()} className={btnPrimary}>
                      Send back
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {queue.length === 0 && <Empty title="Nothing waiting for inspection" hint="Rooms appear here when an attendant marks them clean." />}
        <Pager page={page} total={queue.length} onPage={setPage} noun="rooms" />
      </div>

      {overlays}
    </div>
  )
}