import type { Actor, Unsubscribe } from '../types'
import type { AutomationSnapshot } from './automationModels'
import type {
  Anomaly,
  AnomalyAction,
  AnomalyActionKind,
  AskInput,
  AskResult,
  ConciergeContext,
  ConciergeConversation,
  ConciergeMessage,
  ConciergeReply,
  Escalation,
  Forecast,
  GuestSegment,
  KbArticle,
  KbArticleInput,
  NextBestAction,
  PriorityScore,
  Recommendation,
  SegmentMember,
  StaffingForecast,
  Workflow,
  WorkflowEvent,
  WorkflowInput,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowTemplate,
} from './automationTypes'
import type { RoleId } from '../../lib/roles'

/** Someone deciding, with the role the backend checks approvals against. */
export type AutomationActor = Actor & { role: RoleId }

// One interface per capability. Each is async so an API version can call the server, which would
// read its own tables and ignore the snapshot the browser mock is handed.

export interface ConciergeService {
  listKb(propertyId: string): Promise<KbArticle[]>
  saveKb(propertyId: string, input: KbArticleInput, actor: Actor): Promise<KbArticle>
  /** What the assistant would say, without starting a conversation. For trying out the knowledge base. */
  preview(propertyId: string, text: string, ctx: ConciergeContext): Promise<ConciergeReply>
  /** A guest asks from their own page. Requests and anything unanswered are handed on. */
  ask(propertyId: string, input: AskInput, ctx: ConciergeContext): Promise<AskResult>
  /** The page wrote the guest request the assistant raised; keep the link. */
  linkRequest(messageId: string, guestRequestId: string): Promise<void>
  listConversations(propertyId: string): Promise<ConciergeConversation[]>
  conversationFor(propertyId: string, reservationId: string): Promise<ConciergeConversation | null>
  listMessages(conversationId: string): Promise<ConciergeMessage[]>
  /** Staff writing into a conversation. */
  staffReply(conversationId: string, body: string, actor: Actor): Promise<ConciergeMessage>
  listEscalations(propertyId: string): Promise<Escalation[]>
  takeEscalation(id: string, actor: Actor): Promise<Escalation>
  answerEscalation(id: string, answer: string, actor: Actor): Promise<Escalation>
  closeEscalation(id: string, note: string, actor: Actor): Promise<Escalation>
}

export interface InsightsService {
  /** Work the forecast, rate suggestions and anomalies out again. Decisions already made are kept. */
  refreshInsights(snapshot: AutomationSnapshot): Promise<void>
  listForecasts(propertyId: string): Promise<Forecast[]>
  listRecommendations(propertyId: string): Promise<Recommendation[]>
  decideRecommendation(id: string, accept: boolean, note: string, actor: Actor, resultRef?: string): Promise<Recommendation>
  listAnomalies(propertyId: string): Promise<Anomaly[]>
  listAnomalyActions(propertyId: string): Promise<AnomalyAction[]>
  /** Dismiss needs a reason. Open case raises a front desk task. Notify tells the desk's bell. */
  actOnAnomaly(id: string, action: AnomalyActionKind, note: string, actor: Actor): Promise<Anomaly>
}

export interface GuestIntelligenceService {
  refreshGuests(snapshot: AutomationSnapshot): Promise<void>
  listSegments(propertyId: string): Promise<GuestSegment[]>
  listSegmentMembers(propertyId: string): Promise<SegmentMember[]>
  listNextBestActions(propertyId: string): Promise<NextBestAction[]>
  /** Accepting raises a front desk task for the action. */
  decideNextBestAction(id: string, accept: boolean, note: string, actor: Actor): Promise<NextBestAction>
}

export interface OperationsService {
  refreshOperations(snapshot: AutomationSnapshot): Promise<void>
  listPriorityScores(propertyId: string): Promise<PriorityScore[]>
  decidePriority(id: string, accept: boolean, note: string, actor: Actor, resultRef?: string): Promise<PriorityScore>
  listStaffing(propertyId: string): Promise<StaffingForecast[]>
  decideStaffing(id: string, accept: boolean, note: string, actor: Actor): Promise<StaffingForecast>
}

export interface WorkflowService {
  listTemplates(): Promise<WorkflowTemplate[]>
  listWorkflows(propertyId: string): Promise<Workflow[]>
  saveWorkflow(propertyId: string, input: WorkflowInput, actor: Actor): Promise<Workflow>
  createFromTemplate(propertyId: string, templateId: string, actor: Actor): Promise<Workflow>
  setEnabled(id: string, enabled: boolean, actor: Actor): Promise<Workflow>
  deleteWorkflow(id: string, actor: Actor): Promise<void>
  /** A dry run with a sample event: approvals still wait for a person, actions are only described. */
  testRun(id: string, event: WorkflowEvent, actor: Actor): Promise<WorkflowRun>
  /** Events in the hotel's records right now that switched-on workflows listen for, not yet run. */
  pendingEvents(snapshot: AutomationSnapshot): Promise<{ workflowId: string; event: WorkflowEvent }[]>
  /** Run every switched-on workflow on the events waiting. Actions are real. */
  runLive(snapshot: AutomationSnapshot, actor: Actor): Promise<WorkflowRun[]>
  decideApproval(runId: string, approve: boolean, note: string, actor: AutomationActor): Promise<WorkflowRun>
  listRuns(propertyId: string): Promise<WorkflowRun[]>
  listRunEvents(runId: string): Promise<WorkflowRunEvent[]>
}

export interface AutomationService
  extends ConciergeService,
    InsightsService,
    GuestIntelligenceService,
    OperationsService,
    WorkflowService {
  /** Tell the caller when anything changes, including in another tab. */
  subscribe(listener: () => void): Unsubscribe
}
