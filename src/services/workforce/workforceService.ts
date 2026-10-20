import type { Actor, Unsubscribe } from '../types'
import type {
  AttendanceEvent,
  CaseAction,
  CaseInput,
  CaseStatus,
  Compensation,
  CorrectionInput,
  Department,
  EmployeeLink,
  EscalationRule,
  FollowUpOutcome,
  PayrollExport,
  RosterShift,
  ServiceCase,
  ShiftTemplate,
  StaffInput,
  StaffUser,
  TaskEscalation,
  TaskInput,
  TaskStatus,
  Timesheet,
  TrademateEmployee,
  WorkNotification,
  WorkTask,
} from './workforceTypes'

/** Everything one hotel's people pages read, in one call. */
export interface WorkforceSnapshot {
  departments: Department[]
  staff: StaffUser[]
  links: EmployeeLink[]
  /** Trademate's employee list for this hotel, read-only. */
  trademate: TrademateEmployee[]
  templates: ShiftTemplate[]
  shifts: RosterShift[]
  events: AttendanceEvent[]
  tasks: WorkTask[]
  escalations: TaskEscalation[]
  notifications: WorkNotification[]
  cases: ServiceCase[]
  caseActions: CaseAction[]
  exports: PayrollExport[]
}

// What the people pages need from the backend. Every change takes the actor, because the server checks
// permissions and keeps the audit trail. Pay itself is never worked out here: Trademate HR does that.
export interface WorkforceService {
  load(propertyId: string): Promise<WorkforceSnapshot>

  // Staff and the Trademate link
  addStaff(propertyId: string, input: StaffInput, actor: Actor): Promise<StaffUser>
  updateStaff(propertyId: string, userId: string, patch: Partial<StaffInput> & { allocations?: StaffUser['allocations'] }, actor: Actor): Promise<StaffUser>
  setLoginStatus(propertyId: string, userId: string, status: StaffUser['loginStatus'], actor: Actor): Promise<StaffUser>
  linkEmployee(propertyId: string, userId: string, trademateEmployeeId: string, actor: Actor): Promise<EmployeeLink>
  unlinkEmployee(propertyId: string, userId: string, actor: Actor): Promise<void>

  // Rosters
  setShift(propertyId: string, userId: string, workDate: string, shiftTemplateId: string | null, actor: Actor): Promise<RosterShift | null>
  /** Publish every draft shift in the week (for one department, or all). Tells the staff. */
  publishWeek(propertyId: string, weekStart: string, departmentId: string | null, actor: Actor): Promise<number>
  /** Copy last week's shifts into this week as drafts, where the day is still empty. */
  copyPreviousWeek(propertyId: string, weekStart: string, departmentId: string | null, actor: Actor): Promise<number>

  // Attendance
  clock(propertyId: string, userId: string, workDate: string, kind: 'in' | 'out', actor: Actor): Promise<AttendanceEvent>
  correct(propertyId: string, input: CorrectionInput, actor: Actor): Promise<AttendanceEvent[]>
  listTimesheets(propertyId: string, period: { start: string; end: string }, now: number): Promise<Timesheet[]>
  approveTimesheet(propertyId: string, userId: string, period: { start: string; end: string }, actor: Actor): Promise<void>

  // Tasks
  createTask(propertyId: string, input: TaskInput, actor: Actor): Promise<WorkTask>
  assignTask(propertyId: string, taskId: string, userId: string | null, actor: Actor): Promise<WorkTask>
  setTaskStatus(propertyId: string, taskId: string, status: TaskStatus, actor: Actor): Promise<WorkTask>
  /** Raise any overdue task to the level it has reached. Safe to call again; nobody is told twice. */
  runEscalations(propertyId: string, rule: EscalationRule, now: number): Promise<number>
  markNotificationsRead(propertyId: string, ids: string[]): Promise<void>
  retryNotification(propertyId: string, id: string): Promise<void>

  // Service cases
  createCase(propertyId: string, input: CaseInput, actor: Actor): Promise<ServiceCase>
  assignCase(propertyId: string, caseId: string, departmentId: string, ownerUserId: string | null, actor: Actor): Promise<ServiceCase>
  setCaseStatus(propertyId: string, caseId: string, status: CaseStatus, actor: Actor): Promise<ServiceCase>
  addCaseNote(propertyId: string, caseId: string, note: string, actor: Actor): Promise<void>
  proposeCompensation(propertyId: string, caseId: string, input: Pick<Compensation, 'kind' | 'description' | 'amount'>, actor: Actor): Promise<ServiceCase>
  decideCompensation(propertyId: string, caseId: string, approve: boolean, note: string, actor: Actor): Promise<ServiceCase>
  resolveCase(propertyId: string, caseId: string, resolution: string, actor: Actor): Promise<ServiceCase>
  recordFollowUp(propertyId: string, caseId: string, outcome: FollowUpOutcome, note: string, actor: Actor): Promise<ServiceCase>

  // Payroll handoff
  sendPayroll(propertyId: string, period: { start: string; end: string }, now: number, actor: Actor): Promise<PayrollExport>

  subscribe(listener: () => void): Unsubscribe
}
