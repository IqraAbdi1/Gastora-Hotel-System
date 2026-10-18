import { useMemo, useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Pager, Select, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import {
  defectPriority,
  defectStatusTone,
  defectTarget,
  priorityRank,
  priorityTone,
  technicians,
} from '../housekeeping/hkModel'
import type { RoomDefect } from '../housekeeping/hkModel'
import { useRoomOverlays } from '../housekeeping/useRoomOverlays'

const ACTIVE = 'Active'
const PAGE = 25

type Row = { room: string; defect: RoomDefect }

export default function WorkOrdersPage() {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const { overlays, openRoom, reportIssue } = useRoomOverlays()
  const [status, setStatus] = useState(ACTIVE)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [roomNo, setRoomNo] = useState('')
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [note, setNote] = useState('')

  const full = features.maintenanceFull
  const knownRoom = hk.rooms.some((r) => r.room === roomNo.trim())

  // Defects that have reached maintenance. "Open" ones are still with the housekeeping supervisor.
  const orders = useMemo(() => {
    const s = search.trim().toLowerCase()
    return hk.allDefects
      .filter(({ defect }) => defect.status !== 'Open')
      .filter(({ defect }) => (status === ACTIVE ? defect.status !== 'Resolved' : defect.status === status))
      .filter(
        ({ room, defect }) =>
          !s || room.includes(s) || defect.category.toLowerCase().includes(s) || defect.description.toLowerCase().includes(s),
      )
      .sort(
        (a, b) =>
          priorityRank[defectPriority(a.defect)] - priorityRank[defectPriority(b.defect)] || a.room.localeCompare(b.room),
      )
  }, [hk.allDefects, status, search])
  const shown = orders.slice(page * PAGE, page * PAGE + PAGE)

  const waiting = hk.allDefects.filter((d) => d.defect.status === 'Open').length
  const live = hk.allDefects.filter((d) => d.defect.status !== 'Open' && d.defect.status !== 'Resolved')
  const urgent = live.filter((d) => defectPriority(d.defect) === 'Urgent').length
  const offSale = live.filter((d) => d.defect.blocksRoom).length

  function reject() {
    if (!rejecting || !note.trim()) return
    hk.verifyDefect(rejecting.room, rejecting.defect.id, false, note)
    setRejecting(null)
    setNote('')
  }

  const columns: Column<Row>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: ({ room, defect }) => (
        <>
          <button type="button" onClick={() => openRoom(room, 'defects')} className="font-semibold text-ink hover:text-brand">
            {room}
          </button>
          {defect.blocksRoom && <p className="text-xs font-medium text-bad">Room out of sale</p>}
        </>
      ),
    },
    {
      key: 'problem',
      header: 'Problem',
      cell: ({ defect }) => (
        <>
          <p className="font-medium text-ink">{defect.category}</p>
          <p className="max-w-xs text-xs text-ink/60">{defect.description}</p>
          {defect.note && <p className="max-w-xs text-xs text-ink/50">{defect.note}</p>}
        </>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      hideBelow: 'sm',
      cell: ({ defect }) => {
        const priority = defectPriority(defect)
        return (
          <>
            <Badge tone={priorityTone[priority]}>{priority}</Badge>
            {full && defect.status !== 'Resolved' && (
              <p className="mt-1 text-xs text-ink/50">Target: {defectTarget[priority]}</p>
            )}
          </>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: ({ defect }) => <Badge tone={defectStatusTone[defect.status]}>{defect.status}</Badge>,
    },
    ...(full
      ? ([
          {
            key: 'technician',
            header: 'Technician',
            hideBelow: 'md',
            cell: ({ room, defect }) =>
              defect.status === 'Resolved' ? (
                <span className="text-ink/60">{defect.technician ?? '—'}</span>
              ) : (
                <Select
                  value={defect.technician ?? 'Unassigned'}
                  onChange={(e) => hk.assignDefect(room, defect.id, e.target.value)}
                  className="w-auto! py-1.5"
                  aria-label={`Technician for room ${room}`}
                >
                  {technicians.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              ),
          },
        ] as Column<Row>[])
      : []),
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) => {
        const { room, defect } = row
        return (
          <div className="flex justify-end gap-2">
            {defect.status === 'Maintenance Requested' &&
              (full ? (
                <Button size="sm" onClick={() => hk.startDefect(room, defect.id)}>
                  Start
                </Button>
              ) : (
                <Button size="sm" onClick={() => hk.finishDefect(room, defect.id)}>
                  Done
                </Button>
              ))}
            {defect.status === 'In Progress' && (
              <Button size="sm" onClick={() => hk.finishDefect(room, defect.id)}>
                Done
              </Button>
            )}
            {defect.status === 'Done' && (
              <>
                <Button size="sm" onClick={() => hk.verifyDefect(room, defect.id, true, '')}>
                  Verified
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRejecting(row)
                    setNote('')
                  }}
                >
                  Reopen
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Maintenance"
        title="Work orders"
        description={
          full
            ? 'Repairs reported by housekeeping and the front desk. Rule: priority comes from how serious the fault is, and whether it has taken the room out of sale.'
            : 'Things that need fixing. Mark each one done when it is fixed.'
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open repairs" icon="alert" value={String(live.length)} hint="Not yet closed" />
        <StatCard
          label="Urgent"
          icon="alert"
          value={String(urgent)}
          hint="Serious, or room off sale"
          tone={urgent > 0 ? 'bad' : 'default'}
        />
        <StatCard
          label="Rooms off sale"
          icon="bed"
          value={String(offSale)}
          hint="Held by a repair"
          tone={offSale > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="With the supervisor"
          icon="list"
          value={String(waiting)}
          hint="Reported, not sent here yet"
          tone={full && waiting > 0 ? 'warn' : 'default'}
        />
      </div>

      <Card title="Report a problem" icon="alert" description="Raise a repair against a room number.">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={roomNo}
            onChange={(e) => setRoomNo(e.target.value)}
            placeholder="Room number"
            className="w-40!"
            aria-label="Room number"
          />
          <Button disabled={!knownRoom} onClick={() => reportIssue(roomNo.trim())}>
            Report a problem
          </Button>
          {roomNo.trim() && !knownRoom && <span className="text-xs text-ink/60">No such room.</span>}
        </div>
      </Card>

      <FilterBar
        query={search}
        onQuery={(v) => {
          setSearch(v)
          setPage(0)
        }}
        placeholder="Search a room or problem"
        active={status === ACTIVE ? 0 : 1}
      >
        <Field label="Status">
          {(id) => (
            <Select
              id={id}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
            >
              <option>{ACTIVE}</option>
              <option>Maintenance Requested</option>
              <option>In Progress</option>
              {features.repairSignoff && <option>Done</option>}
              <option>Resolved</option>
            </Select>
          )}
        </Field>
      </FilterBar>

      <Card title="Repairs" icon="alert" count={orders.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={({ room, defect }) => `${room}-${defect.id}`}
          empty={{
            title: 'No repairs here',
            hint: 'Problems reported from a room appear here when they reach maintenance.',
          }}
        />
        <Pager page={page} total={orders.length} perPage={PAGE} onPage={setPage} noun="repairs" />
      </Card>

      {rejecting && (
        <Modal
          title={`Reopen room ${rejecting.room}`}
          description={`${rejecting.defect.category}: ${rejecting.defect.description}`}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button onClick={reject} disabled={!note.trim()}>
                Send back
              </Button>
            </>
          }
        >
          <Field label="What is still wrong?" required>
            {(id) => (
              <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="The tap still drips." />
            )}
          </Field>
        </Modal>
      )}

      {overlays}
    </div>
  )
}
