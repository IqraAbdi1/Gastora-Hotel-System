import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TODAY } from '../../data/sample'
import { BIG_HOTEL } from '../../lib/rooms'
import { useHotel } from '../../lib/hotelContext'
import { answerHousekeeping, isQuestion, planAssignments } from './assistant'
import { useHousekeeping } from './hkContext'
import { estimateReady, exceptionStatuses, nextStatus, previousStatus, statusFlow } from './hkModel'
import type { HkStatus } from './hkModel'
import { Empty, PAGE, Pager, PageHeader, PriorityChip, StatusChip, btnGhost, btnPrimary, btnWarn, card, field } from './hkUi'
import ShortageBanner from './ShortageBanner'
import { useRoomOverlays } from './useRoomOverlays'

const NEEDS = 'Needs action'
const ALL = 'All rooms'
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
      (a, b) =>
        order[a.status] - order[b.status] || rank[a.priority] - rank[b.priority] || a.room.localeCompare(b.room),
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

  const kpis: { label: string; value: number; detail: string; filter: string }[] = [
    { label: 'Rooms to clean', value: counts.Dirty ?? 0, detail: 'Dirty', filter: 'Dirty' },
    { label: 'Being cleaned', value: counts['Being Cleaned'] ?? 0, detail: 'Active now', filter: 'Being Cleaned' },
    { label: 'Ready for inspection', value: counts.Clean ?? 0, detail: 'Waiting for a supervisor', filter: 'Clean' },
    { label: 'Inspected', value: counts.Inspected ?? 0, detail: 'Ready to assign', filter: 'Inspected' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Rooms" hint="Room readiness, from check-out to inspected. Changes show on the front desk board straight away.">
        <button type="button" onClick={() => newTask()} className={btnPrimary}>
          + New task
        </button>
      </PageHeader>

      <ShortageBanner />

      {plan.length > 0 && !asking && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface p-4">
          <p className="text-sm">
            <span className="mr-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Rule</span>
            {plan.length} open task{plan.length === 1 ? ' has' : 's have'} no attendant.
          </p>
          <button
            type="button"
            onClick={() => plan.forEach((p) => hk.assignTask(p.task.id, p.attendant))}
            className={btnPrimary}
          >
            Assign fairly
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => change(setStatus)(k.filter)}
            className={`${card} p-4 text-left transition hover:border-brand ${status === k.filter ? 'border-brand' : ''}`}
          >
            <p className="text-sm font-medium text-ink/60">{k.label}</p>
            <p className="mt-1 text-3xl font-bold text-brand">{k.value}</p>
            <p className="mt-1 text-xs text-ink/60">{k.detail}</p>
          </button>
        ))}
      </section>

      <section className={`${card} min-w-0`}>
        <div className="flex flex-col gap-3 border-b border-ink/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Room readiness</h2>
            <p className="text-xs text-ink/60">
              Dirty → Being Cleaned → Clean → Inspected. A clean or inspected room can be checked into.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => change(setSearch)(e.target.value)}
              placeholder="Search a room, or ask a question"
              className={`${field} w-72! py-2`}
            />
            <select value={floor} onChange={(e) => change(setFloor)(e.target.value)} className={`${field} w-auto! py-2`}>
              <option>All floors</option>
              {floors.map(([f, label]) => (
                <option key={f} value={f}>{label}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => change(setStatus)(e.target.value)} className={`${field} w-auto! py-2`}>
              <option>{NEEDS}</option>
              <option>{ALL}</option>
              {[...statusFlow, ...exceptionStatuses, 'Occupied'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {answer ? (
          <div className="border-b border-ink/10 bg-accent/10 p-4">
            <p className="mb-1">
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Rule</span>
              <span className="ml-2 text-xs text-ink/50">Worked out from today&apos;s data, not AI</span>
            </p>
            <p className="text-sm">{answer.text}</p>
            {answer.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {answer.actions.map((a) => (
                  <button key={a.label} type="button" onClick={a.run} className={btnPrimary}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          !search && (
            <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-4 py-2 text-xs text-ink/60">
              <span>Ask:</span>
              {examples.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => change(setSearch)(x)}
                  className="rounded-full border border-ink/15 px-3 py-1 hover:border-brand hover:text-brand"
                >
                  {x}
                </button>
              ))}
            </div>
          )
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Attendant</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map((room) => {
                const next = nextStatus(room.status)
                const back = previousStatus(room.status)
                const flagged = exceptionStatuses.includes(room.status as never)
                const waiting = room.status === 'Dirty' || room.status === 'Being Cleaned'
                return (
                  <tr key={room.room} className="hover:bg-canvas/60">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openRoom(room.room)} className="whitespace-nowrap font-semibold hover:text-brand">
                        Room {room.room}
                      </button>
                      <p className="text-xs text-ink/60">{room.type} · {room.zone}</p>
                      {room.arrival && <p className="text-xs font-medium text-warn">{room.arrival}</p>}
                      {waiting && !room.readyBy && (
                        <p className="text-xs text-ink/50">Estimate: ready about {estimateReady(room)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={room.status} />
                      {room.reason && <p className="mt-1 max-w-48 truncate text-xs text-ink/60">{room.reason}</p>}
                    </td>
                    <td className="px-4 py-3"><PriorityChip priority={room.priority} /></td>
                    <td className="px-4 py-3 text-ink/70">{room.attendant}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {next && (
                          <button type="button" onClick={() => hk.advanceRoom(room)} className={btnPrimary}>→ {next}</button>
                        )}
                        {back && <button type="button" onClick={() => hk.moveRoomBack(room)} className={btnGhost}>Back</button>}
                        {flagged &&
                          (hk.blockedByRepair(room.room) ? (
                            <span className="self-center text-xs text-ink/60">Waiting for repair</span>
                          ) : (
                            <button type="button" onClick={() => hk.resetRoom(room.room)} className={btnGhost}>Reset</button>
                          ))}
                        {!flagged && <button type="button" onClick={() => reportIssue(room.room)} className={btnWarn}>Issue</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {list.length === 0 && (
          <Empty
            title={status === NEEDS ? 'Nothing needs cleaning right now' : 'No rooms found'}
            hint={status === NEEDS ? 'Choose "All rooms" to see every room.' : 'Try changing the search or filters.'}
          />
        )}
        <Pager page={page} total={list.length} onPage={setPage} noun="rooms" />
      </section>

      {overlays}
    </div>
  )
}