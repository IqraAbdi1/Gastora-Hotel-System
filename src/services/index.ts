// The one place that decides where data comes from. Screens import services from here, never a
// mock directly. To connect the backend, write an API version of each service (same interface,
// calling the server) and swap it in below. Nothing else needs to change.
import { createMockCorporateService } from './corporate/mockCorporateService'
import type { CorporateService } from './corporate/corporateService'
import { createMockNotificationService } from './notifications/mockNotificationService'
import type { NotificationService } from './notifications/notificationService'
import { createMockTaskService } from './tasks/mockTaskService'
import type { TaskService } from './tasks/taskService'
// J. Workforce and service management
import { createMockWorkforceService } from './workforce/mockWorkforceService'
import type { WorkforceService } from './workforce/workforceService'
// Area M: compliance, security and controls
import { createMockSecurityService } from './security/mockSecurityService'
import type { SecurityService } from './security/securityService'
import { createMockEventsService } from './events/mockEventsService'
import type { EventsService } from './events/eventsService'
// Area L: AI and automation layer.
import { createMockAutomationService } from './automation/mockAutomationService'
import type { AutomationService } from './automation/automationService'
import { createMockPosService } from './pos/mockPosService'
import type { PosService } from './pos/posService'

export const taskService: TaskService = createMockTaskService()
export const notificationService: NotificationService = createMockNotificationService()
export const corporateService: CorporateService = createMockCorporateService()
// J. Workforce and service management
export const workforceService: WorkforceService = createMockWorkforceService()
// Area K: management reports and the analytics assistant.
export { reportsService, analyticsAssistant } from './reports'
// Area M: compliance, security and controls
export const securityService: SecurityService = createMockSecurityService()
// Area I: procurement, inventory and cost control
import { createMockProcurementService } from './procurement/mockProcurementService'
import type { ProcurementService } from './procurement/procurementService'
export const procurementService: ProcurementService = createMockProcurementService()
// Area G: events, banqueting and sales
export const eventsService: EventsService = createMockEventsService()
// Area H: Finance and hotel accounting (Trademate link)
import { createMockAccountingService } from './accounting/mockAccountingService'
import type { AccountingService } from './accounting/accountingService'
export const accountingService: AccountingService = createMockAccountingService()
// Area L: AI and automation layer. Rules stand in for a model (services/automation/automationModels.ts).
export const automationService: AutomationService = createMockAutomationService({ tasks: taskService, notifications: notificationService })
// Area F: POS, F&B and kitchen
export const posService: PosService = createMockPosService()
