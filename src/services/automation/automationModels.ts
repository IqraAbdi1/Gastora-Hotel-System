// The "models": one interface per capability, so a real model or a server-side service can replace
// the deterministic rules in ./engines without any screen changing. Each takes a snapshot of the
// hotel's own records and returns suggestions with their drivers. None of them changes anything.
import type { ApprovalRecord } from '../../lib/approvals'
import type { DemandEvent } from '../../lib/demandEvents'
import type { Feedback } from '../../lib/feedback'
import type { RatesPolicy } from '../../lib/rates'
import type { AddOn } from '../../lib/addOns'
import type { UpsellSettings } from '../../lib/upsell'
import type { SlaSettings } from '../../lib/sla'
import type { Spell } from '../../lib/downtime'
import type { HkRoom, HkTask, RoomDefect } from '../../features/housekeeping/hkModel'
import type { StockItem } from '../../features/procurement/requestsModel'
import type { HeldOrder, Product, Sale } from '../../features/pos/posTypes'
import type { Guest, Reservation, Room } from '../../types'
import type {
  Anomaly,
  ConciergeContext,
  ConciergeReply,
  Forecast,
  GuestSegment,
  JournalEntry,
  KbArticle,
  NextBestAction,
  PriorityScore,
  Recommendation,
  SegmentMember,
  StaffingForecast,
  WorkflowEvent,
} from './automationTypes'

/**
 * What the screens hand the mock so it can work from the app's real data. A backend version ignores
 * it and reads its own tables.
 */
export interface AutomationSnapshot {
  propertyId: string
  plan: 'starter' | 'standard' | 'large'
  today: string
  /** ISO time the snapshot was taken. */
  now: string
  reservations: Reservation[]
  rooms: Room[]
  guests: Guest[]
  hkRooms: HkRoom[]
  hkTasks: HkTask[]
  defects: { room: string; defect: RoomDefect }[]
  spells: Spell[]
  stock: StockItem[]
  posSales: Sale[]
  posOrders: HeldOrder[]
  posProducts: Product[]
  approvals: ApprovalRecord[]
  feedback: Feedback[]
  rates: RatesPolicy
  events: DemandEvent[]
  upsell: UpsellSettings
  addOns: AddOn[]
  sla: SlaSettings
  checkInTime: string
  checkOutTime: string
  /** The money a manager may approve alone. Refunds above it are worth a look. */
  managerLimit: number
}

/** Without the journal and the time stamps a model would have to invent. */
type Stamp = { generatedAt: string }

export interface ConciergeModel {
  reply(text: string, kb: KbArticle[], ctx: ConciergeContext): ConciergeReply
}

export interface ForecastModel {
  forecast(s: AutomationSnapshot, days: number, stamp: Stamp): Omit<Forecast, 'id'>[]
  recommend(s: AutomationSnapshot, stamp: Stamp): Omit<Recommendation, 'id' | 'status'>[]
}

export interface AnomalyModel {
  detect(s: AutomationSnapshot, journal: JournalEntry[], detectedAt: string): Omit<Anomaly, 'id' | 'status'>[]
}

export interface SegmentModel {
  segment(s: AutomationSnapshot, stamp: Stamp): { segments: Omit<GuestSegment, 'id'>[]; members: Omit<SegmentMember, 'id' | 'segmentId'>[] }
}

export interface NextBestActionModel {
  suggest(s: AutomationSnapshot, members: Omit<SegmentMember, 'id' | 'segmentId'>[], stamp: Stamp): Omit<NextBestAction, 'id' | 'status'>[]
}

export interface PriorityModel {
  housekeeping(s: AutomationSnapshot, stamp: Stamp): Omit<PriorityScore, 'id' | 'status'>[]
  maintenance(s: AutomationSnapshot, stamp: Stamp): Omit<PriorityScore, 'id' | 'status'>[]
}

export interface StaffingModel {
  staffing(s: AutomationSnapshot, forecasts: Omit<Forecast, 'id'>[], days: number, stamp: Stamp): Omit<StaffingForecast, 'id' | 'status'>[]
}

/** Turns the hotel's records into the events workflows listen for. */
export interface EventSource {
  events(s: AutomationSnapshot, journal: JournalEntry[], extra: { openEscalations: { id: string; guestName: string; question: string; room?: string }[]; highAnomalies: Anomaly[] }): WorkflowEvent[]
}
