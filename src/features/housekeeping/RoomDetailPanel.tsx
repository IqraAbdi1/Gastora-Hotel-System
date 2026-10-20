import { useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Modal, Tabs } from '../../components/ui'
import type { Column, TabItem } from '../../components/ui'
import { dayMonth } from '../../lib/format'
import { useHousekeeping } from './hkContext'
import { useAuth } from '../auth/authContext'
import { MAX_ROOM_PHOTOS, roomHasSpace } from '../../lib/roomPhotos'
import { PhotoThumbs, TakePhotoButton } from './RoomPhotos'
import { defectStatusTone, isActive, priorityTone, statusTone, taskStatusTone } from './hkModel'
import type { LinenItem, MinibarItem, TabKey } from './hkModel'

export default function RoomDetailPanel({
  roomNumber,
  onClose,
  onIssue,
  startTab = 'overview',
}: {
  roomNumber: string
  onClose: () => void
  onIssue: (room: string) => void
  startTab?: TabKey
}) {
  const hk = useHousekeeping()
  const { user } = useAuth()
  const me = user?.staffName ?? user?.name ?? 'Housekeeping'
  const [tab, setTab] = useState<TabKey>(startTab)
  const [photoNote, setPhotoNote] = useState('')

  const room = hk.rooms.find((r) => r.room === roomNumber)
  if (!room) return null
  const details = hk.detailsOf(roomNumber)
  const stay = hk.stayOf(roomNumber)
  const task = hk.tasks.find((t) => t.room === roomNumber && isActive(t))
  const photoCount = details.photos.length
  const openDefects = details.defects.filter((d) => d.status !== 'Resolved').length

  const tabs: TabItem<TabKey>[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'minibar', label: 'Minibar' },
    { key: 'linen', label: 'Linen' },
    { key: 'defects', label: 'Defects', count: openDefects, alert: openDefects > 0 },
    { key: 'history', label: 'History' },
  ]

  const minibarColumns: Column<MinibarItem & { index: number }>[] = [
    { key: 'item', header: 'Item', cell: (i) => <span className="font-medium text-ink">{i.name}</span> },
    { key: 'stocked', header: 'Stocked', align: 'right', cell: (i) => <span className="text-ink/70">{i.quantity}</span> },
    {
      key: 'used',
      header: 'Used',
      align: 'right',
      cell: (i) => (
        <input
          type="number"
          min={0}
          max={i.quantity}
          value={i.used}
          onChange={(e) => hk.setMinibarUsed(roomNumber, i.index, Number(e.target.value))}
          aria-label={`${i.name} used`}
          className="w-20 rounded-lg border border-ink/15 px-2 py-1.5 text-right text-sm tabular-nums"
        />
      ),
    },
    {
      key: 'left',
      header: 'Remaining',
      align: 'right',
      cell: (i) => <span className="font-semibold tabular-nums">{i.quantity - i.used}</span>,
    },
  ]

  const linenColumns: Column<LinenItem & { index: number }>[] = [
    { key: 'item', header: 'Item', cell: (i) => <span className="font-medium text-ink">{i.name}</span> },
    { key: 'expected', header: 'Expected', align: 'right', cell: (i) => <span className="text-ink/70">{i.expected}</span> },
    {
      key: 'found',
      header: 'Found',
      align: 'right',
      cell: (i) => (
        <input
          type="number"
          min={0}
          max={i.expected}
          value={i.found}
          onChange={(e) => hk.setLinenFound(roomNumber, i.index, Number(e.target.value))}
          aria-label={`${i.name} found`}
          className="w-20 rounded-lg border border-ink/15 px-2 py-1.5 text-right text-sm tabular-nums"
        />
      ),
    },
    {
      key: 'variance',
      header: 'Short by',
      align: 'right',
      cell: (i) => {
        const variance = i.found - i.expected
        return <span className={`font-semibold tabular-nums ${variance < 0 ? 'text-bad' : 'text-good'}`}>{variance}</span>
      },
    },
  ]

  return (
    <Modal
      side
      wide
      title={`Room ${room.room}`}
      description={
        <>
          {room.type} · {room.zone}
          {room.arrival && ` · ${room.arrival}`}
          {room.reason && <span className="block text-ink/70">Reason: {room.reason}</span>}
        </>
      }
      onClose={onClose}
      header={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[room.status]} dot>
              {room.status}
            </Badge>
            <Badge tone={priorityTone[room.priority]}>{room.priority}</Badge>
          </div>
          <Tabs tabs={tabs} value={tab} onChange={setTab} label="Room details" />
        </div>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {tab === 'overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Occupancy', stay ? 'Occupied' : 'Vacant'],
                ['Guest', stay ? stay.guest : '—'],
                ['Reservation', stay ? `${stay.id} · until ${dayMonth(stay.departure)}` : '—'],
                ['Last cleaned', details.lastCleaned],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-ink/10 bg-canvas p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
                  <p className="mt-1 font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>

            <Card
              title="Inspection"
              icon="check"
              actions={
                <span className="text-xs text-ink/60">
                  {details.inspectedBy === '—' ? 'Pending' : `By ${details.inspectedBy}`}
                </span>
              }
            >
              <p className="text-sm text-ink/70">{details.inspectionNote}</p>
            </Card>

            <Card title="Current task" icon="tasks">
              {task ? (
                <div className="rounded-lg bg-canvas p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{task.type}</span>
                    <Badge tone={taskStatusTone[task.status]}>{task.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    {task.attendant} · Due {task.dueTime}
                  </p>
                  {task.notes && <p className="mt-1 text-sm text-ink/70">{task.notes}</p>}
                </div>
              ) : (
                <p className="text-sm text-ink/60">No active task for this room.</p>
              )}
            </Card>

            <Card
              title="Room photos"
              icon="sparkles"
              count={photoCount}
              description={`What the room looked like, with who took each photo and when. Up to ${MAX_ROOM_PHOTOS} are kept per room.`}
              actions={
                <TakePhotoButton
                  disabled={!roomHasSpace(details.photos)}
                  label={roomHasSpace(details.photos) ? 'Add photo' : 'Room full'}
                  onPhoto={(src) => setPhotoNote(hk.addPhoto(roomNumber, { src, by: me }) ?? '')}
                />
              }
            >
              {photoNote && (
                <p role="alert" className="mb-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-ink">
                  {photoNote}
                </p>
              )}
              {details.photos.length === 0 ? (
                <p className="text-sm text-ink/60">No photos yet. On a phone, Add photo opens the camera.</p>
              ) : (
                <PhotoThumbs
                  photos={details.photos}
                  onRemove={(i) => {
                    hk.removePhoto(roomNumber, i, me)
                    setPhotoNote('')
                  }}
                />
              )}
            </Card>
          </>
        )}

        {tab === 'minibar' && (
          <Card
            title="Minibar"
            icon="money"
            description="Record what was used. It posts to the folio once billing is linked."
            padded={false}
          >
            <DataTable
              columns={minibarColumns}
              rows={details.minibar.map((item, index) => ({ ...item, index }))}
              rowKey={(i) => i.name}
              empty={{ title: 'No minibar in this room' }}
            />
          </Card>
        )}

        {tab === 'linen' && (
          <Card
            title="Linen"
            icon="bed"
            description="Confirm the quantities found while servicing the room."
            padded={false}
          >
            <DataTable
              columns={linenColumns}
              rows={details.linen.map((item, index) => ({ ...item, index }))}
              rowKey={(i) => i.name}
              empty={{ title: 'No linen recorded for this room' }}
            />
          </Card>
        )}

        {tab === 'defects' && (
          <>
            <Card
              title="Defects and maintenance"
              icon="alert"
              description="Report a problem. Maintenance fixes it and closes it."
              actions={
                <Button size="sm" onClick={() => onIssue(roomNumber)}>
                  Report a problem
                </Button>
              }
            >
              {details.defects.length === 0 ? (
                <EmptyState title="No defects recorded" hint="Nothing has been reported against this room." />
              ) : (
                <ul className="space-y-3">
                  {details.defects.map((defect) => (
                    <li key={defect.id} className="rounded-xl border border-ink/10 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{defect.category}</span>
                            <Badge>{defect.severity}</Badge>
                            <Badge tone={defectStatusTone[defect.status]}>{defect.status}</Badge>
                            {defect.blocksRoom && <Badge tone="bad">Room out of sale</Badge>}
                          </div>
                          <p className="mt-2 text-sm text-ink/70">{defect.description}</p>
                          <p className="mt-1 text-xs text-ink/50">
                            Reported {defect.reportedAt}
                            {defect.technician && ` · With ${defect.technician}`}
                          </p>
                          {defect.note && <p className="mt-1 text-xs text-ink/60">{defect.note}</p>}
                          {defect.photos && defect.photos.length > 0 && (
                            <div className="mt-2">
                              <PhotoThumbs compact photos={defect.photos} alt={`Photo of the problem: ${defect.category}`} />
                            </div>
                          )}
                        </div>
                        {defect.status === 'Open' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => hk.requestMaintenance(roomNumber, defect.id)}
                          >
                            Request maintenance
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        {tab === 'history' && (
          <Card title="Room history" icon="list" description="What happened to this room in this session." padded={false}>
            {details.history.length === 0 ? (
              <EmptyState title="Nothing recorded yet" />
            ) : (
              <ul className="divide-y divide-ink/10">
                {details.history.map((item) => (
                  <li key={item.id} className="grid gap-1 p-4 sm:grid-cols-[70px_160px_110px_1fr]">
                    <span className="text-xs font-medium text-ink/50">{item.time}</span>
                    <span className="font-semibold text-ink">{item.action}</span>
                    <span className="text-sm text-ink/60">{item.user}</span>
                    <span className="text-sm text-ink/70">{item.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </Modal>
  )
}
