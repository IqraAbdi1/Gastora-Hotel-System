import type { RoleId } from '../../lib/roles'
import type { Actor } from '../types'

// Records of the hotel's working side: who works where, when, what they are doing and the guest cases
// they own. Named after the tables in gst_workforce, gst_core and gst_integration.
//
// Trademate HR holds the employee record and pays people. Gastora keeps the link to it, never a copy of
// payroll data: the Trademate fields below are read-only and come back from Trademate.

export type WorkPriority = 'Urgent' | 'High' | 'Normal'

/** gst_core.departments */
export interface Department {
  id: string
  propertyId: string
  code: string
  name: string
  /** The department head, who gets the first escalation. */
  headUserId?: string
}

export type LoginStatus = 'active' | 'invited' | 'none' | 'disabled'
export type ContractType = 'permanent' | 'contract' | 'casual'

/** gst_core.users, the hotel's own view of a person who works there. */
export interface StaffUser {
  id: string
  propertyId: string
  fullName: string
  phone: string
  email?: string
  jobTitle: string
  /** Home department. */
  departmentId: string
  /** Other departments this person covers, with the share of their time. */
  allocations: { departmentId: string; percent: number }[]
  /** Gastora roles, from src/lib/roles. Empty when the person has no login. */
  roles: RoleId[]
  loginStatus: LoginStatus
  /** The demo sign-in account, when there is one. */
  loginUserId?: string
  contractType: ContractType
  active: boolean
}

/** gst_integration.employee_links (employees_link): one Gastora user to one Trademate employee. */
export interface EmployeeLink {
  id: string
  propertyId: string
  userId: string
  trademateEmployeeId: string
  linkedAt: string
  linkedBy: Actor
}

/** Read-only, from Trademate HR. Gastora shows it and never edits it. */
export interface TrademateEmployee {
  trademateEmployeeId: string
  propertyId: string
  employeeNo: string
  fullName: string
  grade: string
  startDate: string
  nationalIdMasked: string
  bankMasked: string
  payGroup: string
}

/** gst_workforce.shift_templates */
export interface ShiftTemplate {
  id: string
  propertyId: string
  code: 'morning' | 'evening' | 'night' | 'day'
  name: string
  /** HH:mm, local time. A night shift ends the next morning. */
  startTime: string
  endTime: string
  paidHours: number
}

export type RosterStatus = 'draft' | 'published'

/** gst_workforce.roster_shifts */
export interface RosterShift {
  id: string
  propertyId: string
  userId: string
  departmentId: string
  /** The day the shift starts, YYYY-MM-DD. */
  workDate: string
  shiftTemplateId: string
  status: RosterStatus
  publishedAt?: string
  publishedBy?: Actor
}

export type AttendanceKind = 'in' | 'out'
export type AttendanceSource = 'clock' | 'manual' | 'correction'

/** gst_workforce.attendance_events */
export interface AttendanceEvent {
  id: string
  propertyId: string
  userId: string
  /** The roster day the event belongs to, so a night shift's clock-out stays with its start. */
  workDate: string
  kind: AttendanceKind
  at: string
  source: AttendanceSource
  /** A correction replaces the events of the same day and kind. */
  reason?: string
  recordedBy?: Actor
  approvedBy?: Actor
  /** An absence the manager recorded on purpose, so it is not just a missing clock-in. */
  absence?: 'sick' | 'leave' | 'unexplained'
}

export type TimesheetStatus = 'open' | 'approved'

/** gst_workforce.timesheets, one per person per period. Hours are worked out from the events. */
export interface Timesheet {
  id: string
  propertyId: string
  userId: string
  periodStart: string
  periodEnd: string
  scheduledShifts: number
  scheduledHours: number
  workedHours: number
  overtimeHours: number
  nightHours: number
  lateCount: number
  absentDays: number
  status: TimesheetStatus
  approvedAt?: string
  approvedBy?: Actor
}

export type TaskStatus = 'open' | 'in-progress' | 'done'

/** gst_workforce.tasks */
export interface WorkTask {
  id: string
  propertyId: string
  title: string
  description: string
  departmentId: string
  assigneeUserId?: string
  priority: WorkPriority
  status: TaskStatus
  roomNumber?: string
  /** A service case this task is part of. */
  caseId?: string
  createdAt: string
  createdBy: Actor
  /** SLA due time, from the hotel's targets for the priority. */
  dueAt: string
  startedAt?: string
  completedAt?: string
  completedBy?: Actor
  /** 0 nobody told, 1 the department head, 2 the general manager as well. */
  escalationLevel: 0 | 1 | 2
}

/** gst_workforce.task_escalations */
export interface TaskEscalation {
  id: string
  propertyId: string
  taskId: string
  level: 1 | 2
  at: string
  toUserId?: string
  toLabel: string
  reason: string
}

export type NotificationChannel = 'push' | 'in-app' | 'sms'
export type NotificationStatus = 'queued' | 'sent' | 'read' | 'failed'

/** gst_workforce.notifications: the queue the backend sends to phones. */
export interface WorkNotification {
  id: string
  propertyId: string
  userId?: string
  /** Who it is for, in words, when it goes to a role rather than a person. */
  toLabel: string
  channel: NotificationChannel
  title: string
  body: string
  createdAt: string
  status: NotificationStatus
  sentAt?: string
  readAt?: string
  entity?: { kind: 'task' | 'case' | 'roster' | 'attendance'; id: string }
}

export type CaseStatus = 'open' | 'in-progress' | 'resolved' | 'closed'
export type CaseCategory = 'request' | 'complaint' | 'recovery'
export type CaseSource = 'portal' | 'desk' | 'phone' | 'review'
export type CompensationKind = 'discount' | 'free-item' | 'upgrade' | 'refund' | 'late-checkout'
export type FollowUpOutcome = 'satisfied' | 'not-satisfied' | 'no-answer'

export interface Compensation {
  kind: CompensationKind
  description: string
  amount: number
  status: 'proposed' | 'approved' | 'declined'
  proposedBy: Actor
  proposedAt: string
  decidedBy?: Actor
  decidedAt?: string
  note?: string
}

/** gst_workforce.service_cases */
export interface ServiceCase {
  id: string
  propertyId: string
  caseNo: string
  source: CaseSource
  category: CaseCategory
  /** The portal request it came from, so it is imported once. */
  guestRequestId?: string
  reservationId?: string
  guestId?: string
  guestName: string
  roomNumber?: string
  departmentId: string
  ownerUserId?: string
  priority: WorkPriority
  title: string
  detail: string
  status: CaseStatus
  createdAt: string
  createdBy: Actor
  dueAt: string
  compensation?: Compensation
  resolution?: string
  resolvedAt?: string
  resolvedBy?: Actor
  followUp?: { outcome: FollowUpOutcome; note: string; at: string; by: Actor }
}

/** gst_workforce.case_actions: the case history. */
export interface CaseAction {
  id: string
  propertyId: string
  caseId: string
  at: string
  by: Actor
  kind: 'created' | 'assigned' | 'note' | 'status' | 'compensation' | 'resolved' | 'follow-up' | 'task'
  note: string
}

export type ExportStatus = 'draft' | 'sent' | 'acknowledged' | 'failed'

export interface PayrollExportLine {
  userId: string
  trademateEmployeeId: string
  fullName: string
  regularHours: number
  overtimeHours: number
  nightHours: number
  absentDays: number
  lateCount: number
}

/** gst_workforce.payroll_exports: hours sent to Trademate for one pay period. Pay is worked out there. */
export interface PayrollExport {
  id: string
  propertyId: string
  periodStart: string
  periodEnd: string
  status: ExportStatus
  lines: PayrollExportLine[]
  sentAt?: string
  sentBy?: Actor
  trademateBatchRef?: string
  error?: string
}

// ---- Inputs ----

export interface StaffInput {
  fullName: string
  phone: string
  email?: string
  jobTitle: string
  departmentId: string
  contractType: ContractType
  roles: RoleId[]
}

export interface TaskInput {
  title: string
  description: string
  departmentId: string
  assigneeUserId?: string
  priority: WorkPriority
  roomNumber?: string
  caseId?: string
  /** Hours to the SLA due time. The page takes it from the hotel's targets. */
  dueInHours: number
}

export interface CaseInput {
  source: CaseSource
  category: CaseCategory
  guestName: string
  reservationId?: string
  guestId?: string
  roomNumber?: string
  departmentId: string
  ownerUserId?: string
  priority: WorkPriority
  title: string
  detail: string
  dueInHours: number
  guestRequestId?: string
}

export interface CorrectionInput {
  userId: string
  workDate: string
  /** HH:mm, or empty to leave that side as it is. */
  inTime?: string
  outTime?: string
  absence?: 'sick' | 'leave' | 'unexplained'
  reason: string
  approver: Actor
}

/** Escalation settings the page passes in, from the hotel's SLA settings. */
export interface EscalationRule {
  secondStepAt: number
  on: boolean
}

export const PRIORITIES: WorkPriority[] = ['Urgent', 'High', 'Normal']

export const LOGIN_LABEL: Record<LoginStatus, string> = {
  active: 'Active login',
  invited: 'Invited',
  none: 'No login',
  disabled: 'Disabled',
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const CATEGORY_LABEL: Record<CaseCategory, string> = {
  request: 'Guest request',
  complaint: 'Complaint',
  recovery: 'Service recovery',
}

export const SOURCE_LABEL: Record<CaseSource, string> = {
  portal: 'Guest portal',
  desk: 'Front desk',
  phone: 'Phone',
  review: 'Review',
}

export const COMPENSATION_LABEL: Record<CompensationKind, string> = {
  discount: 'Discount on bill',
  'free-item': 'Complimentary item',
  upgrade: 'Room upgrade',
  refund: 'Refund',
  'late-checkout': 'Late check-out',
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
}
