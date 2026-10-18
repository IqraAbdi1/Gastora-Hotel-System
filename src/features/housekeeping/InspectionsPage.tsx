import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Pager, StatCard } from '../../components/ui'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from './hkContext'
import { priorityRank, priorityTone } from './hkModel'
import { useRoomOverlays } from './useRoomOverlays'

const PAGE = 25

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
      <PageHeader
        eyebrow="Housekeeping"
        title="Inspections"
        description="Pass a room to make it ready to sell, or send it back with a reason."
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label="Waiting"
          icon="clean"
          value={String(queue.length)}
          hint="Cleaned, not yet inspected"
          tone={queue.length > 0 ? 'warn' : 'default'}
        />
        <StatCard label="Ready to sell" icon="check" value={String(inspected)} hint="Inspected today" tone="good" />
      </div>

      <Card title="Waiting for inspection" icon="clean" count={queue.length} description={modeText} padded={false}>
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing waiting for inspection"
            hint="Rooms appear here when an attendant marks them clean."
          />
        ) : (
          <ul className="divide-y divide-ink/10">
            {shown.map((room) => {
              const details = hk.detailsOf(room.room)
              const open = failing === room.room
              return (
                <li key={room.room} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openRoom(room.room)}
                        className="text-base font-semibold text-ink hover:text-brand"
                      >
                        Room {room.room}
                      </button>
                      <p className="text-sm text-ink/60">
                        {room.type} · {room.zone} · cleaned {details.lastCleaned}
                        {room.arrival && ` · ${room.arrival}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={priorityTone[room.priority]}>{room.priority}</Badge>
                      <Button size="sm" onClick={() => hk.inspectRoom(room.room, true, '')}>
                        Pass
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setFailing(open ? null : room.room)
                          setNote('')
                        }}
                      >
                        Fail
                      </Button>
                    </div>
                  </div>
                  {open && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What needs fixing? (required)"
                        autoFocus
                      />
                      <Button onClick={() => fail(room.room)} disabled={!note.trim()} className="shrink-0">
                        Send back
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <Pager page={page} total={queue.length} perPage={PAGE} onPage={setPage} noun="rooms" />
      </Card>

      {overlays}
    </div>
  )
}
