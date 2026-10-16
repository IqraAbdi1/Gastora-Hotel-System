import type { Actor } from '../types'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

/** What the task is about. Helps staff scan the list; "other" covers anything else. */
export type TaskCategory = 'reservation-follow-up' | 'company-booking' | 'arrival-prep' | 'guest-request' | 'other'

/** Stored status. "Overdue" is not stored: it is an open task whose due time has passed. */
export type TaskStatus = 'open' | 'done'

export interface FrontDeskTask {
  id: string
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  /** When it is due, as an ISO timestamp. */
  dueAt: string
  status: TaskStatus
  assignee?: Actor
  /** A reservation the task is about, such as "R-1042". */
  reservationId?: string
  createdAt: string
  createdBy: Actor
  completedAt?: string
  completedBy?: Actor
}

export interface NewTaskInput {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  dueAt: string
  assignee?: Actor
  reservationId?: string
}

export const TASK_PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
]

export const TASK_CATEGORIES: { key: TaskCategory; label: string }[] = [
  { key: 'reservation-follow-up', label: 'Reservation follow-up' },
  { key: 'company-booking', label: 'Company booking' },
  { key: 'arrival-prep', label: 'Arrival preparation' },
  { key: 'guest-request', label: 'Guest request' },
  { key: 'other', label: 'Other' },
]
