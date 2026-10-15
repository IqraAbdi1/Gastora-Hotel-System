import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TODAY } from '../../data/sample'
import { frontDeskNotifications } from '../../lib/frontDeskNotifications'
import { useHotel } from '../../lib/hotelContext'
import { useNow } from '../../lib/useNow'
import { notificationService, taskService } from '../../services'
import type { AppNotification } from '../../services/notifications/notificationTypes'
import type { FrontDeskTask, NewTaskInput } from '../../services/tasks/taskTypes'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { FrontDeskContext } from './frontDeskContext'

// Front desk tasks and notifications. Lives above the app (in Root) so they survive moving
// between pages and signing in as someone else, like the hotel's other sample data.
export default function FrontDeskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { reservations, rooms } = useHotel()
  const { accounts } = useCorporate()
  const now = useNow()
  const [tasks, setTasks] = useState<FrontDeskTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const userId = user?.id ?? null

  // Load tasks, and reload whenever the task service says they changed.
  useEffect(() => {
    let alive = true
    const load = () =>
      taskService
        .list()
        .then((list) => {
          if (!alive) return
          setTasks(list)
          setTasksError(null)
        })
        .catch((e: unknown) => alive && setTasksError(e instanceof Error ? e.message : 'Could not load tasks'))
        .finally(() => alive && setTasksLoading(false))
    load()
    const stop = taskService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [])

  // The same for notifications, as seen by whoever is signed in.
  useEffect(() => {
    if (!userId) return
    let alive = true
    const load = () =>
      notificationService
        .list('frontdesk', userId)
        .then((list) => alive && setNotifications(list))
        .catch(() => undefined)
    load()
    const stop = notificationService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [userId])

  // Prototype stand-in for the backend: raise notifications for what is happening now.
  // Re-running is harmless because the service ignores events it has already seen.
  useEffect(() => {
    for (const n of frontDeskNotifications(reservations, rooms, tasks, TODAY, now, accounts)) {
      void notificationService.publish(n)
    }
  }, [reservations, rooms, tasks, now, accounts])

  const actor = useMemo(() => (user ? { id: user.id, name: user.name } : null), [user])

  const createTask = useCallback(
    (input: NewTaskInput) => {
      if (!actor) return Promise.reject(new Error('Sign in to add tasks'))
      return taskService.create(input, actor)
    },
    [actor],
  )
  const completeTask = useCallback(
    async (id: string) => {
      if (actor) await taskService.complete(id, actor)
    },
    [actor],
  )
  const reopenTask = useCallback(
    async (id: string) => {
      if (actor) await taskService.reopen(id, actor)
    },
    [actor],
  )
  const markRead = useCallback(
    async (ids: string[]) => {
      if (userId) await notificationService.markRead(ids, userId)
    },
    [userId],
  )
  const markAllRead = useCallback(async () => {
    if (userId) await notificationService.markAllRead('frontdesk', userId)
  }, [userId])

  const visible = userId ? notifications : []
  const value = {
    tasks,
    tasksLoading,
    tasksError,
    createTask,
    completeTask,
    reopenTask,
    notifications: visible,
    unread: visible.filter((n) => !n.read).length,
    markRead,
    markAllRead,
    now,
  }

  return <FrontDeskContext.Provider value={value}>{children}</FrontDeskContext.Provider>
}
