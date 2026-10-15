import type { NotificationService } from './notificationService'
import type { AppNotification } from './notificationTypes'

type Stored = Omit<AppNotification, 'read'> & { readBy: Set<string> }

// In-memory notifications for the prototype. Not saved and not shared between browsers.
export function createMockNotificationService(): NotificationService {
  let items: Stored[] = []
  const keys = new Set<string>()
  let counter = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  return {
    list(audience, userId) {
      const out = items
        .filter((n) => n.audience === audience)
        .map(({ readBy, ...n }) => ({ ...n, read: readBy.has(userId) }))
      return Promise.resolve(out)
    },

    markRead(ids, userId) {
      let changed = false
      for (const n of items) {
        if (ids.includes(n.id) && !n.readBy.has(userId)) {
          n.readBy.add(userId)
          changed = true
        }
      }
      if (changed) emit()
      return Promise.resolve()
    },

    markAllRead(audience, userId) {
      let changed = false
      for (const n of items) {
        if (n.audience === audience && !n.readBy.has(userId)) {
          n.readBy.add(userId)
          changed = true
        }
      }
      if (changed) emit()
      return Promise.resolve()
    },

    publish(input) {
      // Checked before anything async happens, so two calls for the same event cannot both get in.
      if (keys.has(input.key)) return Promise.resolve({ created: false })
      keys.add(input.key)
      counter += 1
      items = [{ ...input, id: `N-${counter}`, createdAt: new Date().toISOString(), readBy: new Set() }, ...items]
      emit()
      return Promise.resolve({ created: true })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
