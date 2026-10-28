import { createContext, useContext } from 'react'
import type { AppNotification } from '../../services/notifications/notificationTypes'
import type { FrontDeskTask, NewTaskInput } from '../../services/tasks/taskTypes'

export type FrontDeskValue = {
  tasks: FrontDeskTask[]
  tasksLoading: boolean
  tasksError: string | null
  createTask: (input: NewTaskInput) => Promise<FrontDeskTask>
  completeTask: (id: string) => Promise<void>
  reopenTask: (id: string) => Promise<void>
  notifications: AppNotification[]
  unread: number
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  /** The clock tasks and notifications are judged against; ticks every minute. */
  now: number
}

export const FrontDeskContext = createContext<FrontDeskValue | null>(null)

export function useFrontDesk(): FrontDeskValue {
  const v = useContext(FrontDeskContext)
  if (!v) throw new Error('useFrontDesk must be used inside FrontDeskProvider')
  return v
}
