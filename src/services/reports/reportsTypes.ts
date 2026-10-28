// Records of the management reports area. Named after the gst_analytics tables (camelCase columns).

/** gst_analytics.daily_kpis: one property, one business day, actual or budget. */
export interface DailyKpi {
  id: string
  propertyId: string
  businessDate: string
  scenario: 'actual' | 'budget'
  roomsAvailable: number
  roomsSold: number
  roomRevenue: number
  fnbRevenue: number
  otherRevenue: number
  totalRevenue: number
  /** Payroll, cost of sales, utilities and the rest of the operating costs. */
  operatingCosts: number
  /** Gross operating profit: total revenue less operating costs. */
  gop: number
  cancellations: number
  /** Money received that day, all methods. */
  cashCollected: number
}

export type Department = 'frontOffice' | 'fnb' | 'housekeeping' | 'maintenance' | 'sales' | 'procurement' | 'finance'

/** gst_analytics.department_kpis: the target a department head is measured against. */
export interface DepartmentKpi {
  id: string
  propertyId: string
  department: Department
  kpiKey: string
  label: string
  target: number
  unit: 'percent' | 'ugx' | 'count' | 'minutes'
  /** True when a higher figure is better. */
  higherIsBetter: boolean
}

/** What a property's costs are made of, used to work GOP out from revenue. Sample until accounting is connected. */
export interface CostProfile {
  propertyId: string
  payrollPerRoomDay: number
  utilitiesPerRoomDay: number
  costPerOccupiedRoom: number
  fnbCostPercent: number
  otherCostPercent: number
}

export type DatasetKey =
  | 'reservations'
  | 'charges'
  | 'payments'
  | 'posSales'
  | 'stock'
  | 'workOrders'
  | 'debtors'
  | 'dailyKpis'

export type FilterOp = 'eq' | 'neq' | 'contains' | 'gte' | 'lte' | 'in'

export interface ReportFilter {
  column: string
  op: FilterOp
  value: string
}

export type ReportPeriod = 'all' | 'today' | '7' | '30' | 'mtd' | 'next7'

/** gst_analytics.report_definitions */
export interface ReportDefinition {
  id: string
  propertyId: string
  name: string
  description: string
  dataset: DatasetKey
  columns: string[]
  filters: ReportFilter[]
  groupBy: string | null
  period: ReportPeriod
  /** Built-in reports come with the system and cannot be changed or deleted. */
  builtIn: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type NewReportDefinition = Pick<ReportDefinition, 'name' | 'description' | 'dataset' | 'columns' | 'filters' | 'groupBy' | 'period'>

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'
export type ExportFormat = 'csv' | 'pdf'

/** gst_analytics.report_schedules */
export interface ReportSchedule {
  id: string
  propertyId: string
  reportId: string
  reportName: string
  frequency: ScheduleFrequency
  /** 0 = Sunday. Weekly only. */
  weekday: number
  /** 1 to 28. Monthly only. */
  monthDay: number
  /** "07:00", the hotel's own clock. */
  sendAt: string
  recipients: string[]
  format: ExportFormat
  active: boolean
  nextRunAt: string
  lastRunAt?: string
  createdBy: string
  createdAt: string
}

export type NewReportSchedule = Pick<
  ReportSchedule,
  'reportId' | 'frequency' | 'weekday' | 'monthDay' | 'sendAt' | 'recipients' | 'format'
>

/** gst_analytics.exports: every file that left the system, and who took it. */
export interface ReportExport {
  id: string
  propertyId: string
  reportId: string | null
  reportName: string
  format: ExportFormat
  rowCount: number
  /** 'download' by a person, 'schedule' when a schedule sent it. */
  trigger: 'download' | 'schedule'
  recipients: string[]
  createdBy: string
  createdAt: string
}

export type NewReportExport = Pick<ReportExport, 'reportId' | 'reportName' | 'format' | 'rowCount' | 'trigger' | 'recipients'>

/** gst_analytics.assistant_questions: what was asked, and whether it was answered. */
export interface AssistantQuestion {
  id: string
  propertyId: string
  question: string
  intent: string
  answered: boolean
  /** Why it was not answered: a module the person cannot open, or a question it did not understand. */
  refusal?: string
  sourceCount: number
  askedBy: string
  askedAt: string
}

export type NewAssistantQuestion = Pick<AssistantQuestion, 'question' | 'intent' | 'answered' | 'refusal' | 'sourceCount'>

/** A sale from the sample till history, used only while the hotel's own till has recorded nothing. */
export interface SampleSale {
  id: string
  createdAt: string
  outlet: 'Restaurant' | 'Bar'
  payment: 'Cash' | 'Mobile money' | 'Card' | 'Room charge'
  total: number
  items: { name: string; qty: number; price: number }[]
}
