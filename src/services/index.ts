// The one place that decides where data comes from. Screens import services from here, never a
// mock directly. To connect the backend, write an API version of each service (same interface,
// calling the server) and swap it in below. Nothing else needs to change.
import { createMockCorporateService } from './corporate/mockCorporateService'
import type { CorporateService } from './corporate/corporateService'
import { createMockNotificationService } from './notifications/mockNotificationService'
import type { NotificationService } from './notifications/notificationService'
import { createMockTaskService } from './tasks/mockTaskService'
import type { TaskService } from './tasks/taskService'

export const taskService: TaskService = createMockTaskService()
export const notificationService: NotificationService = createMockNotificationService()
export const corporateService: CorporateService = createMockCorporateService()
