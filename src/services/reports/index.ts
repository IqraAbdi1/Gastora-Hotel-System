// Reports area wiring. Swap either line for an API version to connect the backend or a language model.
import { createMockReportsService } from './mockReportsService'
import type { ReportsService } from './reportsService'
import { createRuleAnalyticsAssistant } from './ruleAnalyticsAssistant'
import type { AnalyticsAssistant } from './analyticsAssistant'

export const reportsService: ReportsService = createMockReportsService()
export const analyticsAssistant: AnalyticsAssistant = createRuleAnalyticsAssistant()
