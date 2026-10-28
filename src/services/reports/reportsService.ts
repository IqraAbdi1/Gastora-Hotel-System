import type { Actor, Unsubscribe } from '../types'
import type {
  AssistantQuestion,
  CostProfile,
  DailyKpi,
  DepartmentKpi,
  NewAssistantQuestion,
  NewReportDefinition,
  NewReportExport,
  NewReportSchedule,
  ReportDefinition,
  ReportExport,
  ReportSchedule,
  SampleSale,
} from './reportsTypes'

// What the reports screens need. The mock keeps saved reports, schedules and exports in memory and
// holds sample figures for the parts the app has no records of yet (costs, budgets, sister hotels).
// An API version reads gst_analytics and checks the caller's permissions on the server.
export interface ReportsService {
  /** Daily figures for the given properties, between two days inclusive. */
  listDailyKpis(query: { propertyIds: string[]; from: string; to: string; scenario: DailyKpi['scenario'] }): Promise<DailyKpi[]>
  listDepartmentKpis(propertyId: string): Promise<DepartmentKpi[]>
  getCostProfile(propertyId: string): Promise<CostProfile>
  /** Till history to show while the hotel's own till has recorded nothing. */
  listSampleSales(propertyId: string, today: string): Promise<SampleSale[]>

  listDefinitions(propertyId: string): Promise<ReportDefinition[]>
  saveDefinition(propertyId: string, input: NewReportDefinition, actor: Actor, id?: string): Promise<ReportDefinition>
  deleteDefinition(id: string, actor: Actor): Promise<void>

  listSchedules(propertyId: string): Promise<ReportSchedule[]>
  saveSchedule(propertyId: string, input: NewReportSchedule, actor: Actor): Promise<ReportSchedule>
  setScheduleActive(id: string, active: boolean, actor: Actor): Promise<ReportSchedule>
  /** Sends a scheduled report now, as the schedule would. Records the export. */
  runScheduleNow(id: string, rowCount: number, actor: Actor): Promise<ReportSchedule>
  deleteSchedule(id: string, actor: Actor): Promise<void>

  listExports(propertyId: string): Promise<ReportExport[]>
  recordExport(propertyId: string, input: NewReportExport, actor: Actor): Promise<ReportExport>

  listQuestions(propertyId: string): Promise<AssistantQuestion[]>
  recordQuestion(propertyId: string, input: NewAssistantQuestion, actor: Actor): Promise<AssistantQuestion>

  subscribe(listener: () => void): Unsubscribe
}
