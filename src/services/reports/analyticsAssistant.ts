import type { Action } from '../../lib/roles'
import type { FeatureMap } from '../../lib/features'
import type { ReportFacts } from './facts'
import type { CostProfile } from './reportsTypes'

// The analytics assistant. Today a rule-based parser answers from the hotel's records in the browser.
// A language-model backend replaces it by implementing the same interface: it receives the question and
// the signed-in person's permissions, answers from server data, and must return the source rows it used.

/** What the person asking may see. The assistant never answers from a module outside this. */
export interface AssistantPermissions {
  canOpen: (pathname: string) => boolean
  can: (action: Action) => boolean
  features: FeatureMap
}

export interface AssistantContext {
  facts: ReportFacts
  permissions: AssistantPermissions
  /** Sample cost profile, for profit questions. */
  cost: CostProfile | null
}

export interface AnswerTable {
  columns: { key: string; label: string; align?: 'left' | 'right' }[]
  rows: Record<string, string>[]
}

/** One record the answer was worked out from. `to` is set only when the person may open that page. */
export interface AnswerSource {
  id: string
  kind: string
  label: string
  detail: string
  to?: string
}

export interface AssistantAnswer {
  intent: string
  understood: boolean
  /** Set when the question was understood but the person may not see the data it needs. */
  refusal?: string
  periodLabel?: string
  /** The figure itself, such as "64%" or "UGX 4,200,000". */
  value?: string
  text: string
  table?: AnswerTable
  sources: AnswerSource[]
  /** True when part of the answer rests on sample data rather than the hotel's records. */
  usesSample?: boolean
}

export interface AnalyticsAssistant {
  ask(question: string, ctx: AssistantContext): Promise<AssistantAnswer>
  /** Questions worth offering this person, given what they may see. */
  suggestions(ctx: AssistantContext): string[]
}
