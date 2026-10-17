import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { dateTime } from '../../lib/format'
import { countTasks, filterTasks, taskState } from '../../lib/tasks'
import type { TaskFilter, TaskState } from '../../lib/tasks'
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../../services/tasks/taskTypes'
import type { FrontDeskTask, TaskPriority } from '../../services/tasks/taskTypes'
import { useAuth } from '../auth/authContext'
import { useFrontDesk } from './frontDeskContext'
import TaskFormDialog from './TaskFormDialog'

const SHOW = 6

const priorityTone: Record<TaskPriority, Tone> = { urgent: 'bad', high: 'warn', normal: 'neutral', low: 'neutral' }
const priorityLabel = Object.fromEntries(TASK_PRIORITIES.map((p) => [p.key, p.label])) as Record<TaskPriority, string>
const categoryLabel = Object.fromEntries(TASK_CATEGORIES.map((c) => [c.key, c.label]))

const stateTabs: { key: TaskFilter['state']; label: string }[] = [
  { key: 'active', label: 'To do' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Done' },
  { key: 'all', label: 'All' },
]

function TaskRow({ t, state, mine }: { t: FrontDeskTask; state: TaskState; mine: boolean }) {
  const { completeTask, reopenTask } = useFrontDesk()
  const done = state === 'completed'
  return (
    <li className="flex gap-3 px-4 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
        onClick={() => void (done ? reopenTask(t.id) : completeTask(t.id))}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          done ? 'border-good bg-good text-white' : 'border-ink/30 hover:border-brand'
        }`}
      >
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`text-sm font-semibold ${done ? 'text-ink/50 line-through' : 'text-ink'}`}>{t.title}</p>
          {!done && t.priority !== 'normal' && <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>}
          {state === 'overdue' && <Badge tone="bad">Overdue</Badge>}
        </div>
        {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink/65">{t.description}</p>}
        <p className="mt-1 text-xs text-ink/55">
          {done ? (
            <>
              Done {t.completedAt ? dateTime(t.completedAt) : ''}
              {t.completedBy ? ` by ${t.completedBy.name}` : ''}
            </>
          ) : (
            <span className={state === 'overdue' ? 'font-medium text-bad' : ''}>Due {dateTime(t.dueAt)}</span>
          )}
          {' · '}
          {categoryLabel[t.category]}
          {t.reservationId && ` · ${t.reservationId}`}
          {' · '}
          {t.assignee ? (mine ? 'You' : t.assignee.name) : 'Not assigned'}
        </p>
      </div>
    </li>
  )
}

export default function TasksCard() {
  const { tasks, tasksLoading, tasksError, now } = useFrontDesk()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [state, setState] = useState<TaskFilter['state']>('active')
  const [priority, setPriority] = useState<TaskFilter['priority']>('all')
  const [who, setWho] = useState<'all' | 'me' | 'none'>('all')
  const [expanded, setExpanded] = useState(false)

  const counts = useMemo(() => countTasks(tasks, now), [tasks, now])
  const tabCount: Record<TaskFilter['state'], number> = {
    active: counts.pending + counts.overdue,
    overdue: counts.overdue,
    pending: counts.pending,
    completed: counts.completed,
    all: tasks.length,
  }
  const list = useMemo(
    () => filterTasks(tasks, { state, priority, assignee: who === 'me' ? (user?.id ?? 'none') : who }, now),
    [tasks, state, priority, who, user, now],
  )
  const shown = expanded ? list : list.slice(0, SHOW)
  const filtered = priority !== 'all' || who !== 'all'

  return (
    <div id="tasks" className="scroll-mt-4">
      <Card
        icon="tasks"
        title="Tasks"
        count={tabCount.active}
        description={counts.overdue > 0 ? <span className="font-medium text-bad">{counts.overdue} overdue</span> : 'Front desk to-dos and follow-ups.'}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            New task
          </Button>
        }
        padded={false}
      >
        <div className="space-y-2 border-b border-ink/10 px-4 py-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Task status">
            {stateTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={state === tab.key}
                onClick={() => {
                  setState(tab.key)
                  setExpanded(false)
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  state === tab.key ? 'bg-brand text-white' : 'text-ink/65 hover:bg-canvas hover:text-ink'
                }`}
              >
                {tab.label} <span className="opacity-70">{tabCount[tab.key]}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskFilter['priority'])} className="py-1.5 text-xs">
              <option value="all">Any priority</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Assigned to" value={who} onChange={(e) => setWho(e.target.value as typeof who)} className="py-1.5 text-xs">
              <option value="all">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Not assigned</option>
            </Select>
          </div>
        </div>

        {tasksLoading ? (
          <LoadingState label="Loading tasks…" />
        ) : tasksError ? (
          <ErrorState title="Tasks could not be loaded" hint={tasksError} />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            hint="Add follow-ups such as confirming a company booking or preparing for an arrival."
            action={
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                Add the first task
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState
            title={filtered ? 'No tasks match these filters' : state === 'overdue' ? 'Nothing is overdue' : 'Nothing here'}
            hint={filtered ? 'Change the priority or assignee filter.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-ink/8">
            {shown.map((t) => (
              <TaskRow key={t.id} t={t} state={taskState(t, now)} mine={!!user && t.assignee?.id === user.id} />
            ))}
          </ul>
        )}
        {list.length > SHOW && (
          <div className="border-t border-ink/10 px-4 py-2.5">
            <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm font-semibold text-brand hover:underline">
              {expanded ? 'Show fewer' : `Show all ${list.length}`}
            </button>
          </div>
        )}
      </Card>
      {adding && <TaskFormDialog onClose={() => setAdding(false)} />}
    </div>
  )
}
