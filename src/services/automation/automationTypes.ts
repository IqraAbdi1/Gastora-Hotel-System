// Records for the AI and automation layer. Named after the tables in the gst_automation schema, with
// columns in camelCase. Every suggestion carries its drivers (the "why") and a decision made by a
// person: nothing here acts on its own except a workflow somebody switched on.
import type { Actor } from '../types'
import type { RoleId } from '../../lib/roles'

/** A suggestion waits for a person. Accepting or dismissing records who and when. */
export type DecisionStatus = 'open' | 'accepted' | 'dismissed'

export interface Decision {
  status: DecisionStatus
  decidedBy?: Actor
  decidedAt?: string
  /** Why it was dismissed, or a note on acceptance. */
  decisionNote?: string
  /** What accepting produced: a task id, an offer, a price. */
  resultRef?: string
}

/** Where a driver comes from: something counted, a projection, or what the hotel entered. */
export type DriverBasis = 'Rule' | 'Estimate' | 'Your input'
export interface Driver {
  basis: DriverBasis
  text: string
}

// ---- Concierge ----

/** kb_articles */
export interface KbArticle {
  id: string
  propertyId: string
  topic: string
  /** The question as a guest might ask it. */
  question: string
  /** {checkOutTime}, {checkInTime}, {lateFreeUntil} and {hotelName} are filled in from the hotel's settings. */
  answer: string
  keywords: string[]
  /** An FAQ is answered; a request is answered and passed to the desk as a guest request. */
  category: 'faq' | 'request'
  /** For a request: the title the desk sees. */
  requestTitle?: string
  active: boolean
  updatedAt: string
  updatedBy: Actor
}

export type KbArticleInput = Pick<KbArticle, 'topic' | 'question' | 'answer' | 'keywords' | 'category' | 'requestTitle' | 'active'> & {
  id?: string
}

export type ConversationStatus = 'open' | 'escalated' | 'closed'

/** concierge_conversations */
export interface ConciergeConversation {
  id: string
  propertyId: string
  reservationId: string
  guestId?: string
  guestName: string
  room?: string
  channel: 'guest-page'
  status: ConversationStatus
  startedAt: string
  lastMessageAt: string
  messageCount: number
  /** Questions the assistant answered without a person. */
  answeredCount: number
}

/** concierge_messages */
export interface ConciergeMessage {
  id: string
  propertyId: string
  conversationId: string
  sender: 'guest' | 'assistant' | 'staff'
  body: string
  at: string
  /** Assistant only: what it understood and why it answered as it did. */
  intent?: 'faq' | 'request' | 'escalate' | 'greeting'
  confidence?: number
  kbArticleId?: string
  drivers?: Driver[]
  staffName?: string
  /** The guest request the assistant raised, once the page has written it. */
  guestRequestId?: string
}

export type EscalationStatus = 'open' | 'taken' | 'answered' | 'closed'

/** escalations */
export interface Escalation {
  id: string
  propertyId: string
  conversationId: string
  reservationId: string
  guestName: string
  room?: string
  question: string
  reason: string
  status: EscalationStatus
  createdAt: string
  takenBy?: Actor
  takenAt?: string
  answer?: string
  answeredBy?: Actor
  answeredAt?: string
  closedBy?: Actor
  closedAt?: string
  closeNote?: string
}

/** What the guest page tells the assistant about the stay. Never another guest's data. */
export interface ConciergeContext {
  hotelName: string
  checkInTime: string
  checkOutTime: string
  lateFreeUntil: string
}

export interface AskInput {
  reservationId: string
  guestId?: string
  guestName: string
  room?: string
  text: string
}

export interface ConciergeReply {
  body: string
  intent: NonNullable<ConciergeMessage['intent']>
  confidence: number
  kbArticleId?: string
  drivers: Driver[]
  /** Set when the guest asked for something the desk should do. */
  request?: { title: string; detail: string }
  /** Set when a person must answer. */
  escalate?: { reason: string }
}

export interface AskResult {
  conversation: ConciergeConversation
  guestMessage: ConciergeMessage
  reply: ConciergeMessage
  escalation?: Escalation
  request?: { title: string; detail: string }
}

// ---- Insights ----

export type Confidence = 'low' | 'medium' | 'high'

/** forecasts: one night, the whole house. */
export interface Forecast {
  id: string
  propertyId: string
  date: string
  daysOut: number
  onBooks: number
  pickup: number
  sellable: number
  forecastRooms: number
  occupancyPct: number
  confidence: Confidence
  drivers: Driver[]
  generatedAt: string
}

/** recommendations: a suggested rate for one night and room type. */
export interface Recommendation extends Decision {
  id: string
  propertyId: string
  key: string
  kind: 'rate'
  date: string
  roomType: string
  direction: 'raise' | 'lower'
  currentRate: number
  suggestedRate: number
  drivers: Driver[]
  generatedAt: string
}

export type AnomalyKind = 'leakage' | 'discount' | 'refund' | 'void' | 'posting'
export type Severity = 'low' | 'medium' | 'high'
export type AnomalyStatus = 'open' | 'dismissed' | 'case' | 'resolved'

export interface SourceRef {
  kind: 'reservation' | 'room' | 'pos-sale' | 'pos-order' | 'approval' | 'journal' | 'charge' | 'stock'
  id: string
  label: string
  /** A page in the app that shows the record. */
  link?: string
}

/** anomalies */
export interface Anomaly {
  id: string
  propertyId: string
  key: string
  kind: AnomalyKind
  title: string
  severity: Severity
  /** 0 to 100. */
  score: number
  amount?: number
  /** The member of staff the records point at, where they do. */
  user?: string
  drivers: Driver[]
  sources: SourceRef[]
  detectedAt: string
  status: AnomalyStatus
  /** Front desk task opened for the case. */
  caseRef?: string
  lastActionBy?: Actor
  lastActionAt?: string
}

export type AnomalyActionKind = 'dismiss' | 'open-case' | 'notify' | 'resolve' | 'reopen'

/** anomaly_actions */
export interface AnomalyAction {
  id: string
  propertyId: string
  anomalyId: string
  action: AnomalyActionKind
  note: string
  by: Actor
  at: string
}

// ---- Guests ----

export type SegmentCode = 'business' | 'leisure' | 'family' | 'vip' | 'lapsed' | 'high-value'

/** guest_segments */
export interface GuestSegment {
  id: string
  propertyId: string
  code: SegmentCode
  name: string
  /** The rule in plain words. */
  rule: string
  memberCount: number
  generatedAt: string
}

/** segment_members */
export interface SegmentMember {
  id: string
  propertyId: string
  segmentId: string
  segmentCode: SegmentCode
  guestId: string
  guestName: string
  reason: string
  addedAt: string
}

export type NbaKind = 'upsell' | 'recognition' | 'service' | 'retention' | 'payment'

/** next_best_actions */
export interface NextBestAction extends Decision {
  id: string
  propertyId: string
  key: string
  reservationId?: string
  guestId?: string
  guestName: string
  room?: string
  stayStatus: 'in-house' | 'arriving' | 'past'
  arrival?: string
  kind: NbaKind
  title: string
  detail: string
  /** What it is worth, where it is money. */
  value?: number
  score: number
  drivers: Driver[]
  generatedAt: string
}

// ---- Operations ----

/** priority_scores: one room to clean or one repair, in the order to do them. */
export interface PriorityScore extends Decision {
  id: string
  propertyId: string
  key: string
  area: 'housekeeping' | 'maintenance'
  subject: string
  /** Room number, plus the task or defect id. */
  room: string
  subjectId: string
  score: number
  rank: number
  reasons: string[]
  /** Housekeeping: the task type. Maintenance: the priority. */
  label: string
  /** Maintenance: the defect status, so the page can offer the next step. */
  state?: string
  generatedAt: string
}

export type Department = 'Housekeeping' | 'Front desk' | 'Food and drink' | 'Maintenance'

/** staffing_forecasts */
export interface StaffingForecast extends Decision {
  id: string
  propertyId: string
  key: string
  date: string
  department: Department
  forecastRooms: number
  occupancyPct: number
  arrivals: number
  departures: number
  staffNeeded: number
  hoursNeeded: number
  drivers: Driver[]
  generatedAt: string
}

// ---- Workflows ----

export type TriggerType = 'refund-above' | 'vip-arrival' | 'room-out-of-order' | 'low-stock' | 'escalation-open' | 'anomaly-high'

export interface WorkflowTrigger {
  type: TriggerType
  /** Refund amount, hours out of order. Unused by the others. */
  threshold?: number
}

export type ConditionOp = 'gt' | 'gte' | 'lt' | 'eq' | 'neq' | 'contains'
export interface WorkflowCondition {
  id: string
  field: string
  op: ConditionOp
  value: string
}

export type StepKind = 'approval' | 'action' | 'notification'
export type StepAction = 'create-task' | 'send-message' | 'add-note'

/** workflow_steps */
export interface WorkflowStep {
  id: string
  workflowId: string
  position: number
  kind: StepKind
  /** Approval: who must approve. Notification: who is told. */
  role?: RoleId
  action?: StepAction
  /** Text with {placeholders} from the event. */
  text: string
}

/** workflows */
export interface Workflow {
  id: string
  propertyId: string
  name: string
  description: string
  trigger: WorkflowTrigger
  conditions: WorkflowCondition[]
  steps: WorkflowStep[]
  enabled: boolean
  templateId?: string
  createdBy: Actor
  createdAt: string
  updatedBy: Actor
  updatedAt: string
}

export type WorkflowInput = Pick<Workflow, 'name' | 'description' | 'trigger' | 'conditions' | 'enabled'> & {
  id?: string
  steps: Omit<WorkflowStep, 'workflowId' | 'position'>[]
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  conditions: Omit<WorkflowCondition, 'id'>[]
  steps: Omit<WorkflowStep, 'id' | 'workflowId' | 'position'>[]
}

/** The thing that happened, as a flat record the conditions and {placeholders} read. */
export interface WorkflowEvent {
  /** One per real-world event, so a live run never runs twice for it. */
  key: string
  type: TriggerType
  summary: string
  data: Record<string, string | number>
}

export type RunStatus = 'awaiting-approval' | 'completed' | 'rejected' | 'skipped'

/** workflow_runs */
export interface WorkflowRun {
  id: string
  propertyId: string
  workflowId: string
  workflowName: string
  mode: 'test' | 'live'
  event: WorkflowEvent
  status: RunStatus
  /** The step waiting, while awaiting approval. */
  currentStep?: number
  startedAt: string
  startedBy: Actor
  finishedAt?: string
}

export type RunEventKind =
  | 'trigger'
  | 'condition'
  | 'approval-requested'
  | 'approved'
  | 'rejected'
  | 'action'
  | 'notification'
  | 'skipped'
  | 'completed'

/** workflow_run_events: the audit log of a run. */
export interface WorkflowRunEvent {
  id: string
  propertyId: string
  runId: string
  at: string
  kind: RunEventKind
  detail: string
  by?: Actor
  ok: boolean
}

// ---- Inputs ----

/**
 * Entries from the outlet and folio journal: who posted, voided, discounted or refunded what, and when.
 * The point-of-sale screen does not keep a user per sale yet, so the mock seeds this journal for the
 * demo hotels. A backend reads the real one.
 */
export interface JournalEntry {
  id: string
  at: string
  outlet: string
  kind: 'void' | 'discount' | 'refund' | 'adjustment' | 'open-check'
  user: string
  amount: number
  /** Discount as a share of the bill. */
  percent?: number
  reference: string
  note: string
}
