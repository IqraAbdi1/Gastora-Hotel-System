// The events the front desk is told about. Corporate approvals and lost-and-found claims are
// defined now so the bell and the API contract are ready; their sources arrive in later phases.
export type NotificationType =
  | 'reservation-verification'
  | 'corporate-approval'
  | 'reservation-change'
  | 'reservation-cancelled'
  | 'arrival-attention'
  | 'departure-attention'
  | 'task-overdue'
  | 'lost-found-claim'
  // Area L: AI and automation layer (anomalies, escalations, workflow notifications).
  | 'automation-alert'

export type NotificationSeverity = 'info' | 'warn' | 'bad'

/** Which team sees it. Only the front desk uses notifications so far. */
export type NotificationAudience = 'frontdesk'

export type NotificationEntity = { kind: 'reservation' | 'task' | 'company' | 'lost-item'; id: string }

export interface AppNotification {
  id: string
  /**
   * One key per real-world event, such as "cancelled:R-1042". Publishing the same key again does
   * nothing, so a page that renders twice, or a rule that runs every minute, never makes duplicates.
   */
  key: string
  type: NotificationType
  severity: NotificationSeverity
  audience: NotificationAudience
  title: string
  body: string
  createdAt: string
  /** Page to open when the notification is clicked. */
  link?: string
  entity?: NotificationEntity
  /** Whether the person asking has read it. Read status is kept per staff member. */
  read: boolean
}

export type NotificationInput = Omit<AppNotification, 'id' | 'createdAt' | 'read'>

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  'reservation-verification': 'Needs verification',
  'corporate-approval': 'Company approval',
  'reservation-change': 'Reservation changed',
  'reservation-cancelled': 'Cancellation',
  'arrival-attention': 'Arrival',
  'departure-attention': 'Departure',
  'task-overdue': 'Overdue task',
  'lost-found-claim': 'Lost and found',
  'automation-alert': 'Automation',
}
