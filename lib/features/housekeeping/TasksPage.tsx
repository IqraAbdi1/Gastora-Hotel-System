import { useMemo, useState } from 'react'
import { useHousekeeping } from './hkContext'
import { attendants, isActive, nextTaskStatus, priorityRank, taskStatuses } from './hkModel'
import { Empty, PAGE, PageHeader, Pager, PriorityChip, TaskChip, btnGhost, btnPrimary, card, field } from './hkUi'
import { useRoomOverlays } from './useRoomOverlays'

const OPEN = 'Open tasks'
const ALL = 'All tasks'

export default function TasksPage() {
  const hk = useHousekeeping()
  const { overlays, openRoom, newTask } = useRoomOverlays()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(OPEN)
  const [priority, setPriority] = useState('All priorities')
  const [who, setWho] = useState('Everyone')
  const [page, setPage] = useState(0)

  const summary = useMemo(() => {
    const open = hk.tasks.filter(isActive)
    return {
      open: open.length,
      unassigned: open.filter((t) => t.status === 'Unassigned').length,
      progress: open.filter((t) => t.status === 'In Progress').length,
      urgent: open.filter((t) => t.priority === 'Urgent').length,
      done: hk.tasks.filter((t) => t.status === 'Completed').length,
    }
  }, [hk.tasks])

  const list = useMemo(() => {
    const s = search.trim().toLowerCase()
    return hk.tasks
      .filter((t) => {
        if (status === OPEN && !isActive(t)) return false
        if (status !== OPEN && status !== ALL && t.status !== status) return false
        if (priority !== 'All priorities' && t.priority !== priority) return false
        if (who !== 'Everyone' && t.attendant !== who) return false
        if (!s) return true
        return t.room.includes(s) || t.type.toLowerCase().includes(s) || t.zone.toLowerCase().includes(s)
      })
      .sort(
        (a, b) =>
          Number(isActive(b)) - Number(isActive(a)) ||
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.dueTime.localeCompare(b.dueTime) ||
          a.room.localeCompare(b.room),
      )
  }, [hk.tasks, search, status, priority, who])

  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tasks" hint="Assign and track cleaning work by room, attendant, priority and due time.">
        <button type="button" onClick={() => newTask()} className={btnPrimary}>+ New task</button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Open', summary.open],
          ['Unassigned', summary.unassigned],
          ['In progress', summary.progress],
          ['Urgent', summary.urgent],
          ['Done', summary.done],
        ].map(([label, value]) => (
          <div key={label} className={`${card} p-3`}>
            <p className="text-xs text-ink/60">{label}</p>
            <p className="text-2xl font-bold text-brand">{value}</p>
          </div>
        ))}
      </div>

      <div className={card}>
        <div className="flex flex-wrap gap-2 border-b border-ink/10 p-4">
          <input
            type="search"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Search room, task, floor"
            className={`${field} w-56! py-2`}
          />
          <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={`${field} w-auto! py-2`}>
            <option>{OPEN}</option>
            <option>{ALL}</option>
            {taskStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => reset(setPriority)(e.target.value)} className={`${field} w-auto! py-2`}>
            <option>All priorities</option>
            <option>Urgent</option>
            <option>High</option>
            <option>Normal</option>
          </select>
          <select value={who} onChange={(e) => reset(setWho)(e.target.value)} className={`${field} w-auto! py-2`}>
            <option>Everyone</option>
            {attendants.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-225 text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Floor</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Attendant</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map((task) => {
                const next = nextTaskStatus(task.status)
                return (
                  <tr key={task.id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{task.type}</p>
                      {task.notes && <p className="max-w-xs truncate text-xs text-ink/60">{task.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openRoom(task.room)} className="font-semibold hover:text-brand">
                        {task.room}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink/70">{task.zone}</td>
                    <td className="px-4 py-3"><PriorityChip priority={task.priority} /></td>
                    <td className="px-4 py-3">
                      <select
                        value={task.attendant}
                        disabled={!isActive(task)}
                        onChange={(e) => hk.assignTask(task.id, e.target.value)}
                        className="rounded-lg border border-ink/15 bg-surface px-2 py-1.5 text-xs disabled:opacity-60"
                      >
                        {attendants.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium">{task.dueTime}</td>
                    <td className="px-4 py-3"><TaskChip status={task.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {next && <button type="button" onClick={() => hk.advanceTask(task)} className={btnPrimary}>→ {next}</button>}
                        {isActive(task) && (
                          <button type="button" onClick={() => hk.cancelTask(task.id)} className={btnGhost}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {list.length === 0 && <Empty title="No tasks found" hint="Dirty rooms get a task automatically when they appear." />}
        <Pager page={page} total={list.length} onPage={setPage} noun="tasks" />
      </div>

      {overlays}
    </div>
  )
}