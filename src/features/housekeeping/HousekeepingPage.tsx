import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, Field, PageHeader, Pager, Select, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { BIG_HOTEL } from '../../lib/rooms'
import { useHotel } from '../../lib/hotelContext'
import { answerHousekeeping, isQuestion, planAssignments } from './assistant'
import { useHousekeeping } from './hkContext'
import {
  ADVANCE_LABEL,
  estimateReady,
  exceptionStatuses,
  nextStatus,
  previousStatus,
  priorityTone,
  statusFlow,
  statusTone,
} from './hkModel'
import type { HkRoom, HkStatus } from './hkModel'
import ShortageBanner from './ShortageBanner'
import { useRoomOverlays } from './useRoomOverlays'

const NEEDS = 'Needs action'
const ALL = 'All rooms'
const PAGE = 25
const order: Record<HkStatus, number> = {
  Dirty: 0,
  'Being Cleaned': 1,
  Clean: 2,
  Discrepancy: 3,
  'Out of Service': 4,
  'Out of Order': 5,
  Inspected: 6,
  Occupied: 7,
}
const rank = { Urgent: 0, High: 1, Normal: 2 } as const
const examples = ['Which rooms will be ready by 3pm?', 'Who is leaving today?', 'Which tasks have no attendant?']

export default function HousekeepingPage() {
  const { rooms: shared, reservations } = useHotel()
  const hk = useHousekeeping()
  const navigate = useNavigate()
  const big = shared.length > BIG_HOTEL
  const { overlays, openRoom, reportIssue, newTask } = useRoomOverlays()

  // A big hotel opens on the rooms that need work, not on 400 rows.
  const [status, setStatus] = useState(big ? NEEDS : ALL)
  const [floor, setFloor] = useState('All floors')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const asking = isQuestion(search)

  const floors = useMemo(() => {
    const set = new Map<number, string>()
    for (const r of hk.rooms) set.set(r.floor, r.zone)
    return [...set.entries()].sort((a, b) => a[0] - b[0])
  }, [hk.rooms])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of hk.rooms) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [hk.rooms])

  const list = useMemo(() => {
    const s = search.trim().toLowerCase()
    const out = hk.rooms.filter((r) => {
      if (floor !== 'All floors' && String(r.floor) !== floor) return false
      if (status === NEEDS && r.status !== 'Dirty' && r.status !== 'Being Cleaned') return false
      if (status !== NEEDS && status !== ALL && r.status !== status) return false
      if (!s || asking) return true
      return r.room.includes(s) || r.type.toLowerCase().includes(s) || r.attendant.toLowerCase().includes(s)
    })
    return out.sort(
      (a, b) => order[a.status] - order[b.status] || rank[a.priority] - rank[b.priority] || a.room.localeCompare(b.room),
    )
  }, [hk.rooms, floor, status, search, asking])

  const shown = list.slice(page * PAGE, page * PAGE + PAGE)

  function change(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      setPage(0)
    }
  }

  // Questions typed into the search bar are answered from the live data (rules, not AI).
  const leaving = reservations
    .filter((r) => r.status === 'in-house' && r.departure <= TODAY)
    .sort((a, b) => Number(a.room) - Number(b.room))
  const answer = asking
    ? answerHousekeeping(search, { rooms: hk.rooms, tasks: hk.tasks, leaving, assign: hk.assignTask, go: navigate })
    : null
  const plan = planAssignments(hk.tasks)

  const kpis: { label: string; value: number; hint: string; filter: string; icon: 'clean' | 'tasks' | 'check' | 'bed' }[] = [
    { label: 'Rooms to clean', value: counts.Dirty ?? 0, hint: 'Dirty', filter: 'Dirty', icon: 'clean' },
    { label: 'Being cleaned', value: counts['Being Cleaned'] ?? 0, hint: 'Active now', filter: 'Being Cleaned', icon: 'tasks' },
    { label: 'For inspection', value: counts.Clean ?? 0, hint: 'Waiting for a supervisor', filter: 'Clean', icon: 'check' },
    { label: 'Inspected', value: counts.Inspected ?? 0, hint: 'Ready to sell', filter: 'Inspected', icon: 'bed' },
  ]

  const columns: Column<HkRoom>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: (room) => {
        const waiting = room.status === 'Dirty' || room.status === 'Being Cleaned'
        return (
          <>
            <button
              type="button"
              onClick={() => openRoom(room.room)}
              className="whitespace-nowrap font-semibold text-ink hover:text-brand"
            >
              Room {room.room}
            </button>
            <p className="text-xs text-ink/60">
              {room.type} · {room.zone}
            </p>
            {room.arrival && <p className="text-xs font-medium text-warn">{room.arrival}</p>}
            {waiting && !room.readyBy && <p className="text-xs text-ink/50">Estimate: ready about {estimateReady(room)}</p>}
          </>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (room) => (
        <>
          <Badge tone={statusTone[room.status]} dot>
            {room.status}
          </Badge>
          {room.reason && <p className="mt-1 max-w-48 truncate text-xs text-ink/60">{room.reason}</p>}
        </>
      ),
    },
    { key: 'priority', header: 'Priority', hideBelow: 'sm', cell: (room) => <Badge tone={priorityTone[room.priority]}>{room.priority}</Badge> },
    { key: 'attendant', header: 'Attendant', hideBelow: 'md', cell: (room) => <span className="text-ink/70">{room.attendant}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (room) => {
        const next = nextStatus(room.status)
        const back = previousStatus(room.status)
        const flagged = exceptionStatuses.includes(room.status as never)
        return (
          <div className="flex justify-end gap-2">
            {next && (
              <Button size="sm" onClick={() => hk.advanceRoom(room)}>
                {ADVANCE_LABEL[next] ?? next}
              </Button>
            )}
            {back && (
              <Button size="sm" variant="ghost" onClick={() => hk.moveRoomBack(room)}>
                Back
              </Button>
            )}
            {flagged &&
              (hk.blockedByRepair(room.room) ? (
                <span className="self-center text-xs text-ink/60">Waiting for repair</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => hk.resetRoom(room.room)}>
                  Reset
                </Button>
              ))}
            {!flagged && (
              <Button size="sm" variant="secondary" onClick={() => reportIssue(room.room)}>
                Report
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const activeFilters = [status !== (big ? NEEDS : ALL), floor !== 'All floors'].filter(Boolean).length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Housekeeping"
        title="Rooms"
        description="Room readiness, from check-out to inspected. Changes show on the front desk board straight away."
        actions={<Button onClick={() => newTask()}>New task</Button>}
      />

      <ShortageBanner />

      {plan.length > 0 && !asking && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-ink/80">
              <Badge tone="brand">Rule</Badge>
              {plan.length} open task{plan.length === 1 ? ' has' : 's have'} no attendant.
            </p>
            <Button onClick={() => plan.forEach((p) => hk.assignTask(p.task.id, p.attendant))}>Assign fairly</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard
            key={k.label}
            label={k.label}
            icon={k.icon}
            value={String(k.value)}
            hint={k.hint}
            active={status === k.filter}
            onClick={() => change(setStatus)(status === k.filter ? (big ? NEEDS : ALL) : k.filter)}
          />
        ))}
      </div>

      <FilterBar
        query={search}
        onQuery={change(setSearch)}
        placeholder="Search a room, or ask a question"
        active={activeFilters}
      >
        <Field label="Floor">
          {(id) => (
            <Select id={id} value={floor} onChange={(e) => change(setFloor)(e.target.value)}>
              <option>All floors</option>
              {floors.map(([f, label]) => (
                <option key={f} value={f}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => change(setStatus)(e.target.value)}>
              <option>{NEEDS}</option>
              <option>{ALL}</option>
              {[...statusFlow, ...exceptionStatuses, 'Occupied'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
      </FilterBar>

      {answer ? (
        <Card>
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">Rule</Badge>
            <span className="text-xs text-ink/50">Worked out from today&apos;s data, not AI</span>
          </p>
          <p className="text-sm text-ink/80">{answer.text}</p>
          {answer.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.actions.map((a) => (
                <Button key={a.label} size="sm" onClick={a.run}>
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        !search && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
            <span>Ask:</span>
            {examples.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => change(setSearch)(x)}
                className="rounded-full border border-ink/15 bg-surface px-3 py-1 hover:border-brand hover:text-brand"
              >
                {x}
              </button>
            ))}
          </div>
        )
      )}

      <Card
        title="Room readiness"
        icon="clean"
        count={list.length}
        description="Dirty → Being cleaned → Clean → Inspected. A clean or inspected room can be checked into."
        padded={false}
      >
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(room) => room.room}
          empty={{
            title: status === NEEDS ? 'Nothing needs cleaning right now' : 'No rooms found',
            hint: status === NEEDS ? 'Choose "All rooms" to see every room.' : 'Try changing the search or the filters.',
          }}
        />
        <Pager page={page} total={list.length} perPage={PAGE} onPage={setPage} noun="rooms" />
      </Card>

      {overlays}
    </div>
  )
}
