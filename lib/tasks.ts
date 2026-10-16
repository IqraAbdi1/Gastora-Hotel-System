import type { Actor } from '../services/types'
import type { FrontDeskTask, TaskPriority } from '../services/tasks/taskTypes'
import { USERS } from './roles'
import type { RoleId } from './roles'

/** What staff see. Overdue is worked out from the due time, so it changes as the clock moves. */
export type TaskState = 'pending' | 'overdue' | 'completed'

export function taskState(t: FrontDeskTask, now: number): TaskState {
  if (t.status === 'done') return 'completed'
  return Date.parse(t.dueAt) < now ? 'overdue' : 'pending'
}

export type TaskFilter = {
  /** "active" = pending and overdue together. */
  state: TaskState | 'active' | 'all'
  priority: TaskPriority | 'all'
  /** A staff id, "me" is resolved by the caller, "none" = unassigned. */
  assignee: string | 'all' | 'none'
}

const rank: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

export function filterTasks(tasks: FrontDeskTask[], f: TaskFilter, now: number) {
  return tasks
    .filter((t) => {
      const s = taskState(t, now)
      if (f.state === 'active' && s === 'completed') return false
      if (f.state !== 'active' && f.state !== 'all' && s !== f.state) return false
      if (f.priority !== 'all' && t.priority !== f.priority) return false
      if (f.assignee === 'none' && t.assignee) return false
      if (f.assignee !== 'all' && f.assignee !== 'none' && t.assignee?.id !== f.assignee) return false
      return true
    })
    .sort((a, b) => {
      // Open work first: overdue, then soonest due, then most urgent. Finished work: latest first.
      const sa = taskState(a, now)
      const sb = taskState(b, now)
      if ((sa === 'completed') !== (sb === 'completed')) return sa === 'completed' ? 1 : -1
      if (sa === 'completed') return (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
      return a.dueAt.localeCompare(b.dueAt) || rank[a.priority] - rank[b.priority]
    })
}

export function countTasks(tasks: FrontDeskTask[], now: number) {
  const c = { pending: 0, overdue: 0, completed: 0 }
  for (const t of tasks) c[taskState(t, now)] += 1
  return c
}

// Who a front desk task can be given to. Assumption: front desk and reservations staff plus the
// managers who also work the desk. The hotel may want a different list; it lives here.
const DESK_ROLES: RoleId[] = ['frontdesk', 'reservations', 'gm', 'admin', 'owner']

export function assignableStaff(): Actor[] {
  return USERS.filter((u) => DESK_ROLES.includes(u.role)).map((u) => ({ id: u.id, name: u.name }))
}
