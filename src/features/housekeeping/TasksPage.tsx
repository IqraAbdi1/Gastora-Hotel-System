import { useMemo, useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, Field, PageHeader, Pager, Select, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { useHousekeeping } from './hkContext'
import {
  attendants,
  isActive,
  nextTaskStatus,
  priorityRank,
  priorityTone,
  TASK_ADVANCE_LABEL,
  taskStatuses,
  taskStatusTone,
} from './hkModel'
import type { HkTask } from './hkModel'
import { useRoomOverlays } from './useRoomOverlays'

const OPEN = 'Open tasks'
const ALL = 'All tasks'
const PAGE = 25

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
  const set = (fn: (v: string) => void) => (v: string) => {
    fn(v)
    setPage(0)
  }
  const activeFilters = [status !== OPEN, priority !== 'All priorities', who !== 'Everyone'].filter(Boolean).length

  const columns: Column<HkTask>[] = [
    {
      key: 'task',
      header: 'Task',
      cell: (task) => (
        <>
          <p className="font-semibold text-ink">{task.type}</p>
          {task.notes && <p className="max-w-xs truncate text-xs text-ink/60">{task.notes}</p>}
        </>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      cell: (task) => (
        <button type="button" onClick={() => openRoom(task.room)} className="font-semibold text-ink hover:text-brand">
          {task.room}
        </button>
      ),
    },
    { key: 'zone', header: 'Floor', hideBelow: 'md', cell: (task) => <span className="text-ink/70">{task.zone}</span> },
    { key: 'priority', header: 'Priority', hideBelow: 'sm', cell: (task) => <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge> },
    {
      key: 'attendant',
      header: 'Attendant',
      hideBelow: 'lg',
      cell: (task) => (
        <Select
          value={task.attendant}
          disabled={!isActive(task)}
          onChange={(e) => hk.assignTask(task.id, e.target.value)}
          className="w-auto! py-1.5 text-xs"
          aria-label={`Attendant for ${task.room}`}
        >
          {attendants.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      ),
    },
    { key: 'due', header: 'Due', hideBelow: 'sm', cell: (task) => <span className="font-medium tabular-nums">{task.dueTime}</span> },
    { key: 'status', header: 'Status', cell: (task) => <Badge tone={taskStatusTone[task.status]}>{task.status}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (task) => {
        const next = nextTaskStatus(task.status)
        return (
          <div className="flex justify-end gap-2">
            {next && (
              <Button size="sm" onClick={() => hk.advanceTask(task)}>
                {TASK_ADVANCE_LABEL[task.status]}
              </Button>
            )}
            {isActive(task) && (
              <Button size="sm" variant="secondary" onClick={() => hk.cancelTask(task.id)}>
                Cancel
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Housekeeping"
        title="Tasks"
        description="Assign and track cleaning work by room, attendant, priority and due time."
        actions={<Button onClick={() => newTask()}>New task</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Open" icon="list" value={String(summary.open)} hint="Not finished" />
        <StatCard
          label="Unassigned"
          icon="tasks"
          value={String(summary.unassigned)}
          hint="Nobody on them"
          tone={summary.unassigned > 0 ? 'warn' : 'default'}
        />
        <StatCard label="In progress" icon="clean" value={String(summary.progress)} hint="Being done now" />
        <StatCard
          label="Urgent"
          icon="alert"
          value={String(summary.urgent)}
          hint="Arrivals and rushes"
          tone={summary.urgent > 0 ? 'bad' : 'default'}
        />
        <StatCard label="Done" icon="check" value={String(summary.done)} hint="Finished today" tone="good" />
      </div>

      <FilterBar
        query={search}
        onQuery={set(setSearch)}
        placeholder="Search room, task or floor"
        active={activeFilters}
      >
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => set(setStatus)(e.target.value)}>
              <option>{OPEN}</option>
              <option>{ALL}</option>
              {taskStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={priority} onChange={(e) => set(setPriority)(e.target.value)}>
              <option>All priorities</option>
              <option>Urgent</option>
              <option>High</option>
              <option>Normal</option>
            </Select>
          )}
        </Field>
        <Field label="Attendant">
          {(id) => (
            <Select id={id} value={who} onChange={(e) => set(setWho)(e.target.value)}>
              <option>Everyone</option>
              {attendants.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          )}
        </Field>
      </FilterBar>

      <Card title="Tasks" icon="tasks" count={list.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(task) => String(task.id)}
          empty={{ title: 'No tasks found', hint: 'A dirty room gets a task automatically when it appears.' }}
        />
        <Pager page={page} total={list.length} perPage={PAGE} onPage={setPage} noun="tasks" />
      </Card>

      {overlays}
    </div>
  )
}
