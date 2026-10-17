import type { Unsubscribe } from '../types'
import type { AppNotification, NotificationAudience, NotificationInput } from './notificationTypes'

export interface NotificationService {
  /** Newest first, with `read` worked out for this staff member. */
  list(audience: NotificationAudience, userId: string): Promise<AppNotification[]>
  markRead(ids: string[], userId: string): Promise<void>
  markAllRead(audience: NotificationAudience, userId: string): Promise<void>
  /**
   * Raise a notification. Does nothing if one with the same key already exists.
   * Prototype only: with a real backend, the server raises notifications itself and the
   * browser just lists them and marks them read.
   */
  publish(input: NotificationInput): Promise<{ created: boolean }>
  subscribe(listener: () => void): Unsubscribe
}
