import { useMemo, useState } from 'react'
import { useHousekeeping } from './hkContext'
import { attendants, isActive, nextTaskStatus, priorityRank } from './hkModel'
import type { HkTask } from './hkModel'
import { PriorityChip, TaskChip, btnGhost, card, field } from './hkUi'
import { useRoomOverlays } from './useRoomOverlays'

const staff = attendants.filter((a) => a !== 'Unassigned')
const POOL = 8

// Built for a phone in the corridor: one column, big buttons, only the person's own work.
export default function MyRoomsPage() {
  const hk = useHousekeeping()
  const { overlays, openRoom, reportIssue } = useRoomOverlays()
  // Until login knows who is signed in, pick who you are.
  const [me, setMe] = useState(staff[0])

  const { mine, done, pool, poolTotal } = useMemo(() => {
    const sort = (a: HkTask, b: HkTask) =>
      priorityRank[a.priority] - priorityRank[b.priority] || a.dueTime.localeCompare(b.dueTime)
    const open = hk.tasks.filter(isActive)
    const pool = open.filter((t) => t.attendant === 'Unassigned').sort(sort)
    return {
      mine: open.filter((t) => t.attendant === me).sort(sort),
      done: hk.tasks.filter((t) => t.attendant === me && t.status === 'Completed').length,
      pool: pool.slice(0, POOL),
      poolTotal: pool.length,
    }
  }, [hk.tasks, me])

  const verb = (t: HkTask) => (t.status === 'Assigned' ? 'Start cleaning' : t.status === 'In Progress' ? 'Mark done' : 'Take this')

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Housekeeping</p>
        <h1 className="text-2xl font-bold">My rooms</h1>
        <label htmlFor="me" className="mt-3 block text-sm font-medium">I am</label>
        <select id="me" value={me} onChange={(e) => setMe(e.target.value)} className={field}>
          {staff.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <p className="mt-2 text-sm text-ink/60">
          {mine.length} to do · {mine.filter((t) => t.status === 'In Progress').length} in progress · {done} done
        </p>
      </div>

      <section className="space-y-3">
        {mine.length === 0 && (
          <div className={`${card} p-6 text-center`}>
            <p className="font-semibold">Nothing assigned to you</p>
            <p className="text-sm text-ink/60">Take a room from the list below.</p>
          </div>
        )}
        {mine.map((t) => (
          <div key={t.id} className={`${card} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <button type="button" onClick={() => openRoom(t.room)} className="text-xl font-bold hover:text-brand">
                  Room {t.room}
                </button>
                <p className="text-sm text-ink/60">{t.type} · {t.zone} · due {t.dueTime}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PriorityChip priority={t.priority} />
                <TaskChip status={t.status} />
              </div>
            </div>
            {t.notes && <p className="mt-2 text-sm text-ink/70">{t.notes}</p>}
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              {nextTaskStatus(t.status) && (
                <button
                  type="button"
                  onClick={() => hk.advanceTask(t)}
                  className="rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white"
                >
                  {verb(t)}
                </button>
              )}
              <button type="button" onClick={() => reportIssue(t.room)} className={`${btnGhost} px-4 py-3 text-sm`}>
                Report issue
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Waiting for someone ({poolTotal})</h2>
        <div className="space-y-2">
          {pool.map((t) => (
            <div key={t.id} className={`${card} flex items-center justify-between gap-3 p-3`}>
              <div>
                <p className="font-semibold">Room {t.room}</p>
                <p className="text-xs text-ink/60">{t.type} · due {t.dueTime}</p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityChip priority={t.priority} />
                <button
                  type="button"
                  onClick={() => hk.assignTask(t.id, me)}
                  className="rounded-lg border border-brand px-3 py-2 text-xs font-semibold text-brand"
                >
                  {verb(t)}
                </button>
              </div>
            </div>
          ))}
          {poolTotal > POOL && (
            <p className="text-center text-xs text-ink/60">Showing the {POOL} most urgent of {poolTotal}.</p>
          )}
          {poolTotal === 0 && <p className="text-sm text-ink/60">Every task has someone on it.</p>}
        </div>
      </section>

      {overlays}
    </div>
  )
}