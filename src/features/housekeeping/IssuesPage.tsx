import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Pager, Select } from '../../components/ui'
import type { Column } from '../../components/ui'
import { useHousekeeping } from './hkContext'
import { defectStatusTone, exceptionStatuses, statusTone } from './hkModel'
import type { RoomDefect } from './hkModel'
import { useRoomOverlays } from './useRoomOverlays'
import { PhotoThumbs } from './RoomPhotos'

const OPEN = 'Not resolved'
const PAGE = 25

type Row = { room: string; defect: RoomDefect }

export default function IssuesPage() {
  const hk = useHousekeeping()
  const { overlays, openRoom } = useRoomOverlays()
  const [status, setStatus] = useState(OPEN)
  const [page, setPage] = useState(0)

  const flagged = useMemo(() => hk.rooms.filter((r) => exceptionStatuses.includes(r.status as never)), [hk.rooms])

  const defects = useMemo(
    () =>
      hk.allDefects
        .filter((d) => (status === OPEN ? d.defect.status !== 'Resolved' : status === 'All' || d.defect.status === status))
        .sort((a, b) => a.room.localeCompare(b.room) || b.defect.id - a.defect.id),
    [hk.allDefects, status],
  )
  const shown = defects.slice(page * PAGE, page * PAGE + PAGE)

  const columns: Column<Row>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: ({ room }) => (
        <button type="button" onClick={() => openRoom(room, 'defects')} className="font-semibold text-ink hover:text-brand">
          {room}
        </button>
      ),
    },
    {
      key: 'defect',
      header: 'Defect',
      cell: ({ defect }) => (
        <>
          <p className="font-medium text-ink">{defect.category}</p>
          <p className="max-w-xs truncate text-xs text-ink/60">{defect.description}</p>
          {defect.photos && defect.photos.length > 0 && (
            <div className="mt-1">
              <PhotoThumbs compact photos={defect.photos} alt={`Photo of the problem: ${defect.category}`} />
            </div>
          )}
        </>
      ),
    },
    { key: 'severity', header: 'Severity', hideBelow: 'sm', cell: ({ defect }) => defect.severity },
    {
      key: 'status',
      header: 'Status',
      cell: ({ defect }) => (
        <>
          <Badge tone={defectStatusTone[defect.status]}>{defect.status}</Badge>
          {defect.technician && <p className="mt-1 text-xs text-ink/60">With {defect.technician}</p>}
        </>
      ),
    },
    {
      key: 'reported',
      header: 'Reported',
      hideBelow: 'md',
      cell: ({ defect }) => <span className="text-ink/70">{defect.reportedAt}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: ({ room, defect }) =>
        defect.status === 'Open' ? (
          <Button variant="secondary" size="sm" onClick={() => hk.requestMaintenance(room, defect.id)}>
            Request maintenance
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Housekeeping"
        title="Issues"
        description="Rooms out of sale, and the defects housekeeping has reported."
      />

      <Card
        title="Rooms with an issue"
        icon="alert"
        count={flagged.length}
        description="Reset sends a vacant room back to dirty."
        padded={false}
      >
        {flagged.length === 0 ? (
          <EmptyState title="No rooms are out of sale" />
        ) : (
          <ul className="divide-y divide-ink/10">
            {flagged.map((room) => (
              <li key={room.room} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => openRoom(room.room)}
                    className="font-semibold text-ink hover:text-brand"
                  >
                    Room {room.room}
                  </button>
                  <p className="text-sm text-ink/60">
                    {room.type} · {room.zone}
                  </p>
                  {room.reason && <p className="text-sm text-ink/70">Reason: {room.reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[room.status]} dot>
                    {room.status}
                  </Badge>
                  {hk.blockedByRepair(room.room) ? (
                    <span className="text-xs text-ink/60">Waiting for repair</span>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => hk.resetRoom(room.room)}>
                      Reset
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Defects"
        icon="alert"
        count={defects.length}
        description="Report from a room's panel. Maintenance closes it."
        padded={false}
        actions={
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(0)
            }}
            className="w-auto! py-1.5"
            aria-label="Filter by status"
          >
            <option>{OPEN}</option>
            <option>Open</option>
            <option>Maintenance Requested</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Resolved</option>
            <option>All</option>
          </Select>
        }
      >
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={({ room, defect }) => `${room}-${defect.id}`}
          empty={{ title: 'No defects here', hint: 'Nothing matches this status.' }}
        />
        <Pager page={page} total={defects.length} perPage={PAGE} onPage={setPage} noun="defects" />
      </Card>

      {overlays}
    </div>
  )
}
