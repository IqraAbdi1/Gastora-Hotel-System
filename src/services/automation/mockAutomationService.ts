import { roleById } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'
import type { NotificationService } from '../notifications/notificationService'
import type { TaskService } from '../tasks/taskService'
import type { TaskCategory } from '../tasks/taskTypes'
import type { Actor } from '../types'
import type { AutomationSnapshot } from './automationModels'
import type { AutomationService } from './automationService'
import type {
  Anomaly,
  AnomalyAction,
  AskResult,
  ConciergeContext,
  ConciergeConversation,
  ConciergeMessage,
  Escalation,
  Forecast,
  GuestSegment,
  JournalEntry,
  KbArticle,
  NbaKind,
  NextBestAction,
  PriorityScore,
  Recommendation,
  SegmentMember,
  StaffingForecast,
  Workflow,
  WorkflowEvent,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowStep,
} from './automationTypes'
import { anomalyRules } from './engines/anomalies'
import { conciergeRules } from './engines/concierge'
import { forecastRules } from './engines/forecast'
import { nextBestActionRules, segmentRules } from './engines/guests'
import { priorityRules, staffingRules } from './engines/operations'
import { TEMPLATES, conditionHolds, describeCondition, fillTemplate, triggerMatches, workflowEvents } from './engines/workflows'
import { sampleJournal, sampleKb } from './sampleAutomation'

// In-memory automation data for the prototype, kept in this browser's storage so the guest's page and
// the staff screens (often different tabs) see the same conversations. The rules in ./engines stand
// in for a model; a backend replaces this file with calls to the server.

const KEY = 'gastora:automation:state:v1'

interface State {
  counter: number
  seeded: string[]
  kb: KbArticle[]
  conversations: ConciergeConversation[]
  messages: ConciergeMessage[]
  escalations: Escalation[]
  forecasts: Forecast[]
  recommendations: Recommendation[]
  anomalies: Anomaly[]
  anomalyActions: AnomalyAction[]
  segments: GuestSegment[]
  members: SegmentMember[]
  nbas: NextBestAction[]
  priorities: PriorityScore[]
  staffing: StaffingForecast[]
  workflows: Workflow[]
  runs: WorkflowRun[]
  runEvents: WorkflowRunEvent[]
}

const empty = (): State => ({
  counter: 0,
  seeded: [],
  kb: [],
  conversations: [],
  messages: [],
  escalations: [],
  forecasts: [],
  recommendations: [],
  anomalies: [],
  anomalyActions: [],
  segments: [],
  members: [],
  nbas: [],
  priorities: [],
  staffing: [],
  workflows: [],
  runs: [],
  runEvents: [],
})

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<State>) } : empty()
  } catch {
    return empty()
  }
}

const AUTOMATION: Actor = { id: 'automation', name: 'Automation' }
const nowIso = () => new Date().toISOString()
/** Compare lists without the time they were worked out, so an unchanged refresh changes nothing. */
const sig = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'generatedAt' || k === 'detectedAt' ? undefined : v))

type Decidable = { id: string; key: string; propertyId: string } & {
  status: string
  decidedBy?: Actor
  decidedAt?: string
  decisionNote?: string
  resultRef?: string
}

export function createMockAutomationService(deps: { tasks: TaskService; notifications: NotificationService }): AutomationService {
  let state = load()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const save = () => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* Keep working in memory when storage is full or blocked. */
    }
  }
  const commit = () => {
    save()
    emit()
  }
  const deny = (why: string) => Promise.reject(new Error(why))
  const nextId = (prefix: string) => {
    state.counter += 1
    return `${prefix}-${String(state.counter).padStart(4, '0')}`
  }
  const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY && e.key !== null) return
      state = load()
      emit()
    })
  }

  const journals = new Map<string, JournalEntry[]>()
  const journalOf = (propertyId: string) => {
    if (!journals.has(propertyId)) journals.set(propertyId, sampleJournal(propertyId))
    return journals.get(propertyId) ?? []
  }

  // ---- Merging fresh suggestions with decisions already made ----

  function merge<T extends Decidable>(old: T[], fresh: Omit<T, 'id' | 'status'>[], prefix: string, keepDecided = true): T[] {
    const byKey = new Map(old.map((o) => [o.key, o]))
    const out: T[] = fresh.map((f) => {
      const was = byKey.get(f.key)
      if (was) return { ...f, id: was.id, status: was.status, decidedBy: was.decidedBy, decidedAt: was.decidedAt, decisionNote: was.decisionNote, resultRef: was.resultRef } as unknown as T
      return { ...f, id: nextId(prefix), status: 'open' } as unknown as T
    })
    const freshKeys = new Set(fresh.map((f) => f.key))
    if (keepDecided) for (const o of old) if (!freshKeys.has(o.key) && o.status !== 'open') out.push(o)
    return out
  }

  function replaceFor<T extends { propertyId: string }>(list: T[], propertyId: string, next: T[]): { list: T[]; changed: boolean } {
    const before = list.filter((x) => x.propertyId === propertyId)
    if (sig(before) === sig(next)) return { list, changed: false }
    return { list: [...list.filter((x) => x.propertyId !== propertyId), ...next], changed: true }
  }

  // ---- Seeding ----

  function ensureSeeded(propertyId: string) {
    if (state.seeded.includes(propertyId)) return
    state.seeded = [...state.seeded, propertyId]
    const at = nowIso()
    state.kb = [...state.kb, ...sampleKb(propertyId, at)]
    if (propertyId === 't2') return save()

    const ctx: ConciergeContext = { hotelName: 'the hotel', checkInTime: '14:00', checkOutTime: '11:00', lateFreeUntil: '14:00' }
    const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
    const talk = (stay: { reservationId: string; guestId: string; guestName: string; room: string }, lines: { text: string; h: number }[]) => {
      for (const l of lines) askNow(propertyId, { ...stay, text: l.text }, ctx, ago(l.h))
    }
    talk({ reservationId: 'R-1043', guestId: 'G-4', guestName: 'David Okello', room: '102' }, [
      { text: 'What time is breakfast?', h: 14 },
      { text: 'Can I get extra towels please', h: 13.8 },
      { text: 'What is the wifi password?', h: 3 },
    ])
    talk({ reservationId: 'R-1052', guestId: 'G-10', guestName: 'Ruth Nabirye', room: '204' }, [
      { text: 'What time is check-out?', h: 5 },
      { text: 'The shower in my room is not working', h: 1.5 },
    ])
    talk({ reservationId: 'R-1041', guestId: 'G-5', guestName: 'Peter Mugisha', room: '203' }, [
      { text: 'Do you have an airport transfer?', h: 2.5 },
      { text: 'Please book me an airport transfer for 7am tomorrow', h: 2.4 },
      { text: 'Do you allow pets?', h: 0.6 },
    ])

    const actor: Actor = { id: 'u-owner', name: 'Patricia Owor' }
    const pick = propertyId === 't1' ? ['tpl-refund', 'tpl-vip', 'tpl-ooo', 'tpl-stock', 'tpl-escalation'] : ['tpl-refund', 'tpl-escalation']
    for (const id of pick) {
      const w = fromTemplate(propertyId, id, actor, ago(72))
      if (w && id === 'tpl-stock') w.enabled = false
    }
    const refund = state.workflows.find((w) => w.propertyId === propertyId && w.templateId === 'tpl-refund')
    if (refund) {
      startRun(refund, { key: 'seed:refund', type: 'refund-above', summary: 'Refund of UGX 420,000 at the front desk', data: { amount: 420000, user: 'Rita Auma', outlet: 'Front desk', reference: 'FD-RF-027', reason: 'Guest left a night early' } }, 'test', actor, ago(20))
    }
    const vip = state.workflows.find((w) => w.propertyId === propertyId && w.templateId === 'tpl-vip')
    if (vip) startRun(vip, { ...TEMPLATE_SAMPLE_VIP }, 'test', actor, ago(30))
    save()
  }

  const TEMPLATE_SAMPLE_VIP: WorkflowEvent = {
    key: 'seed:vip',
    type: 'vip-arrival',
    summary: 'Grace Namukasa arrives today',
    data: { guestName: 'Grace Namukasa', room: '301', roomType: 'Suite', reservationId: 'R-1044', nights: 1 },
  }

  // ---- Concierge ----

  function askNow(propertyId: string, input: { reservationId: string; guestId?: string; guestName: string; room?: string; text: string }, ctx: ConciergeContext, at: string): AskResult {
    const kb = state.kb.filter((a) => a.propertyId === propertyId)
    const reply = conciergeRules.reply(input.text, kb, ctx)
    let conv = state.conversations.find((c) => c.propertyId === propertyId && c.reservationId === input.reservationId)
    if (!conv) {
      conv = {
        id: nextId('CV'),
        propertyId,
        reservationId: input.reservationId,
        guestId: input.guestId,
        guestName: input.guestName,
        room: input.room,
        channel: 'guest-page',
        status: 'open',
        startedAt: at,
        lastMessageAt: at,
        messageCount: 0,
        answeredCount: 0,
      }
      state.conversations = [conv, ...state.conversations]
    }
    const guestMessage: ConciergeMessage = { id: nextId('CM'), propertyId, conversationId: conv.id, sender: 'guest', body: input.text.trim(), at }
    const answer: ConciergeMessage = {
      id: nextId('CM'),
      propertyId,
      conversationId: conv.id,
      sender: 'assistant',
      body: reply.body,
      at,
      intent: reply.intent,
      confidence: Math.round(reply.confidence * 100) / 100,
      kbArticleId: reply.kbArticleId,
      drivers: reply.drivers,
    }
    state.messages = [...state.messages, guestMessage, answer]
    let escalation: Escalation | undefined
    if (reply.escalate) {
      escalation = {
        id: nextId('ES'),
        propertyId,
        conversationId: conv.id,
        reservationId: input.reservationId,
        guestName: input.guestName,
        room: input.room,
        question: input.text.trim(),
        reason: reply.escalate.reason,
        status: 'open',
        createdAt: at,
      }
      state.escalations = [escalation, ...state.escalations]
      void deps.notifications.publish({
        key: `escalation:${escalation.id}`,
        type: 'automation-alert',
        severity: reply.escalate.reason === 'Complaint or urgent' ? 'bad' : 'warn',
        audience: 'frontdesk',
        title: `Guest question for staff: ${input.guestName}`,
        body: input.text.trim().slice(0, 120),
        link: '/automation/concierge',
      })
    }
    const next: ConciergeConversation = {
      ...conv,
      status: escalation ? 'escalated' : conv.status === 'closed' ? 'open' : conv.status,
      lastMessageAt: at,
      messageCount: conv.messageCount + 2,
      answeredCount: conv.answeredCount + (reply.intent === 'faq' || reply.intent === 'request' || reply.intent === 'greeting' ? 1 : 0),
      room: input.room ?? conv.room,
    }
    state.conversations = state.conversations.map((c) => (c.id === conv.id ? next : c))
    return { conversation: next, guestMessage, reply: answer, escalation, request: reply.request }
  }

  function updateEscalation(id: string, change: (e: Escalation) => Escalation | string) {
    const found = state.escalations.find((e) => e.id === id)
    if (!found) return deny('Escalation not found')
    const next = change(found)
    if (typeof next === 'string') return deny(next)
    state.escalations = state.escalations.map((e) => (e.id === id ? next : e))
    commit()
    return Promise.resolve(copy(next))
  }

  function postStaff(conversationId: string, body: string, actor: Actor, at = nowIso()): ConciergeMessage {
    const conv = state.conversations.find((c) => c.id === conversationId)
    const msg: ConciergeMessage = { id: nextId('CM'), propertyId: conv?.propertyId ?? '', conversationId, sender: 'staff', body, at, staffName: actor.name }
    state.messages = [...state.messages, msg]
    state.conversations = state.conversations.map((c) => (c.id === conversationId ? { ...c, lastMessageAt: at, messageCount: c.messageCount + 1 } : c))
    return msg
  }

  // ---- Workflows ----

  function fromTemplate(propertyId: string, templateId: string, actor: Actor, at = nowIso()): Workflow | null {
    const t = TEMPLATES.find((x) => x.id === templateId)
    if (!t) return null
    const id = nextId('WF')
    const w: Workflow = {
      id,
      propertyId,
      name: t.name,
      description: t.description,
      trigger: { ...t.trigger },
      conditions: t.conditions.map((c) => ({ ...c, id: nextId('WC') })),
      steps: t.steps.map((s, i) => ({ ...s, id: nextId('WS'), workflowId: id, position: i + 1 })),
      enabled: true,
      templateId,
      createdBy: actor,
      createdAt: at,
      updatedBy: actor,
      updatedAt: at,
    }
    state.workflows = [...state.workflows, w]
    return w
  }

  function log(run: WorkflowRun, kind: WorkflowRunEvent['kind'], detail: string, ok = true, by?: Actor, at = nowIso()) {
    state.runEvents = [...state.runEvents, { id: nextId('RE'), propertyId: run.propertyId, runId: run.id, at, kind, detail, by, ok }]
  }

  const roleLabel = (r?: RoleId) => (r ? roleById(r)?.label ?? r : 'someone')

  function setRun(run: WorkflowRun) {
    state.runs = state.runs.map((r) => (r.id === run.id ? run : r))
  }

  function doStep(run: WorkflowRun, step: WorkflowStep, actor: Actor, at: string) {
    const text = fillTemplate(step.text, run.event)
    const test = run.mode === 'test'
    if (step.kind === 'notification') {
      if (test) return log(run, 'notification', `Test: would tell ${roleLabel(step.role)}: ${text}`, true, undefined, at)
      void deps.notifications.publish({
        key: `wf:${run.id}:${step.id}`,
        type: 'automation-alert',
        severity: 'info',
        audience: 'frontdesk',
        title: `${run.workflowName}`,
        body: `For ${roleLabel(step.role)}: ${text}`,
        link: '/automation/workflows',
      })
      return log(run, 'notification', `Told ${roleLabel(step.role)}: ${text}`, true, undefined, at)
    }
    if (step.action === 'create-task') {
      if (test) return log(run, 'action', `Test: would create task "${text}"`, true, undefined, at)
      void deps.tasks
        .create(
          {
            title: text.slice(0, 120),
            description: `Raised by workflow "${run.workflowName}" for: ${run.event.summary}`,
            category: 'other',
            priority: 'high',
            dueAt: new Date(Date.parse(at) + 2 * 3600000).toISOString(),
            reservationId: typeof run.event.data.reservationId === 'string' ? run.event.data.reservationId : undefined,
          },
          actor,
        )
        .then((t) => {
          log(run, 'action', `Task ${t.id} created: ${t.title}`)
          commit()
        })
        .catch((e: Error) => {
          log(run, 'action', `Task not created: ${e.message}`, false)
          commit()
        })
      return
    }
    if (step.action === 'send-message') {
      const reservationId = run.event.data.reservationId
      const conv = state.conversations.find((c) => c.propertyId === run.propertyId && c.reservationId === reservationId)
      if (test) return log(run, 'action', `Test: would message the guest: ${text}`, true, undefined, at)
      if (conv) {
        postStaff(conv.id, text, AUTOMATION, at)
        return log(run, 'action', `Message sent on the guest page: ${text}`, true, undefined, at)
      }
      return log(run, 'action', `Message written for the desk to send: ${text}`, true, undefined, at)
    }
    return log(run, 'action', `Note: ${text}`, true, undefined, at)
  }

  function continueRun(run: WorkflowRun, from: number, actor: Actor, at: string): WorkflowRun {
    const w = state.workflows.find((x) => x.id === run.workflowId)
    const steps = [...(w?.steps ?? [])].sort((a, b) => a.position - b.position)
    for (let i = from; i < steps.length; i++) {
      const step = steps[i]
      if (step.kind === 'approval') {
        log(run, 'approval-requested', `Waiting for ${roleLabel(step.role)}: ${fillTemplate(step.text, run.event)}`, true, undefined, at)
        const waiting = { ...run, status: 'awaiting-approval' as const, currentStep: i }
        setRun(waiting)
        return waiting
      }
      doStep(run, step, actor, at)
    }
    log(run, 'completed', run.mode === 'test' ? 'Test run finished. Nothing was changed.' : 'Finished.', true, undefined, at)
    const done = { ...run, status: 'completed' as const, currentStep: undefined, finishedAt: at }
    setRun(done)
    return done
  }

  function startRun(w: Workflow, event: WorkflowEvent, mode: WorkflowRun['mode'], actor: Actor, at = nowIso()): WorkflowRun {
    const run: WorkflowRun = { id: nextId('RUN'), propertyId: w.propertyId, workflowId: w.id, workflowName: w.name, mode, event, status: 'completed', startedAt: at, startedBy: actor }
    state.runs = [run, ...state.runs]
    const match = triggerMatches(w.trigger, event)
    log(run, 'trigger', `${event.summary}. ${match.why}`, match.ok, actor, at)
    if (!match.ok) {
      const skipped = { ...run, status: 'skipped' as const, finishedAt: at }
      log(run, 'skipped', 'Trigger not met, nothing done.', false, undefined, at)
      setRun(skipped)
      return skipped
    }
    for (const c of w.conditions) {
      const ok = conditionHolds(c, event)
      log(run, 'condition', `${describeCondition(c)}: ${ok ? 'yes' : 'no'}`, ok, undefined, at)
      if (!ok) {
        const skipped = { ...run, status: 'skipped' as const, finishedAt: at }
        log(run, 'skipped', 'A condition was not met, nothing done.', false, undefined, at)
        setRun(skipped)
        return skipped
      }
    }
    return continueRun(run, 0, actor, at)
  }

  function eventsFor(s: AutomationSnapshot) {
    const openEscalations = state.escalations
      .filter((e) => e.propertyId === s.propertyId && (e.status === 'open' || e.status === 'taken'))
      .map((e) => ({ id: e.id, guestName: e.guestName, question: e.question, room: e.room }))
    const highAnomalies = state.anomalies.filter((a) => a.propertyId === s.propertyId && a.status === 'open' && a.severity === 'high')
    return workflowEvents.events(s, journalOf(s.propertyId), { openEscalations, highAnomalies })
  }

  function pending(s: AutomationSnapshot) {
    const out: { workflowId: string; event: WorkflowEvent }[] = []
    const events = eventsFor(s)
    for (const w of state.workflows.filter((x) => x.propertyId === s.propertyId && x.enabled)) {
      for (const e of events) {
        if (!triggerMatches(w.trigger, e).ok) continue
        if (state.runs.some((r) => r.workflowId === w.id && r.mode === 'live' && r.event.key === e.key)) continue
        out.push({ workflowId: w.id, event: e })
      }
    }
    return out
  }

  // ---- Decisions ----

  function decide<T extends Decidable>(list: T[], id: string, accept: boolean, note: string, actor: Actor, resultRef?: string): { next: T; list: T[] } | string {
    const found = list.find((x) => x.id === id)
    if (!found) return 'Suggestion not found'
    if (found.status !== 'open') return 'This suggestion has already been decided.'
    if (!accept && note.trim().length < 3) return 'Give a reason for dismissing it.'
    const next = { ...found, status: accept ? 'accepted' : 'dismissed', decidedBy: actor, decidedAt: nowIso(), decisionNote: note.trim() || undefined, resultRef: resultRef ?? found.resultRef }
    return { next, list: list.map((x) => (x.id === id ? next : x)) }
  }

  const NBA_CATEGORY: Record<NbaKind, TaskCategory> = {
    upsell: 'guest-request',
    recognition: 'arrival-prep',
    service: 'guest-request',
    payment: 'reservation-follow-up',
    retention: 'reservation-follow-up',
  }

  return {
    // ---- Concierge ----
    listKb(propertyId) {
      ensureSeeded(propertyId)
      return Promise.resolve(copy(state.kb.filter((a) => a.propertyId === propertyId)))
    },

    saveKb(propertyId, input, actor) {
      ensureSeeded(propertyId)
      const topic = input.topic.trim()
      if (topic.length < 2) return deny('Give the article a topic.')
      if (input.answer.trim().length < 5) return deny('Write the answer the guest will read.')
      const keywords = input.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
      if (keywords.length === 0) return deny('Add at least one keyword the guest might use.')
      if (input.category === 'request' && !input.requestTitle?.trim()) return deny('A request needs the title the desk will see.')
      const clash = state.kb.find((a) => a.propertyId === propertyId && a.id !== input.id && a.topic.toLowerCase() === topic.toLowerCase())
      if (clash) return deny('Another article already has this topic.')
      const base = {
        topic,
        question: input.question.trim() || topic,
        answer: input.answer.trim(),
        keywords,
        category: input.category,
        requestTitle: input.category === 'request' ? input.requestTitle?.trim() : undefined,
        active: input.active,
        updatedAt: nowIso(),
        updatedBy: actor,
      }
      let saved: KbArticle
      if (input.id) {
        const found = state.kb.find((a) => a.id === input.id)
        if (!found) return deny('Article not found')
        saved = { ...found, ...base }
        state.kb = state.kb.map((a) => (a.id === input.id ? saved : a))
      } else {
        saved = { ...base, id: nextId('KB'), propertyId }
        state.kb = [...state.kb, saved]
      }
      commit()
      return Promise.resolve(copy(saved))
    },

    preview(propertyId, text, ctx) {
      ensureSeeded(propertyId)
      if (!text.trim()) return deny('Type a question to try.')
      return Promise.resolve(conciergeRules.reply(text, state.kb.filter((a) => a.propertyId === propertyId), ctx))
    },

    ask(propertyId, input, ctx) {
      ensureSeeded(propertyId)
      const text = input.text.trim()
      if (!text) return deny('Type your question first.')
      if (text.length > 500) return deny('Please keep it under 500 characters.')
      const result = askNow(propertyId, { ...input, text }, ctx, nowIso())
      commit()
      return Promise.resolve(copy(result))
    },

    linkRequest(messageId, guestRequestId) {
      state.messages = state.messages.map((m) => (m.id === messageId ? { ...m, guestRequestId } : m))
      commit()
      return Promise.resolve()
    },

    listConversations(propertyId) {
      ensureSeeded(propertyId)
      return Promise.resolve(copy(state.conversations.filter((c) => c.propertyId === propertyId).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))))
    },

    conversationFor(propertyId, reservationId) {
      ensureSeeded(propertyId)
      return Promise.resolve(copy(state.conversations.find((c) => c.propertyId === propertyId && c.reservationId === reservationId) ?? null))
    },

    listMessages(conversationId) {
      return Promise.resolve(copy(state.messages.filter((m) => m.conversationId === conversationId)))
    },

    staffReply(conversationId, body, actor) {
      if (!state.conversations.some((c) => c.id === conversationId)) return deny('Conversation not found')
      if (body.trim().length < 2) return deny('Write a reply first.')
      const msg = postStaff(conversationId, body.trim(), actor)
      commit()
      return Promise.resolve(copy(msg))
    },

    listEscalations(propertyId) {
      ensureSeeded(propertyId)
      return Promise.resolve(copy(state.escalations.filter((e) => e.propertyId === propertyId)))
    },

    takeEscalation: (id, actor) =>
      updateEscalation(id, (e) => (e.status !== 'open' ? 'Somebody has already taken this.' : { ...e, status: 'taken', takenBy: actor, takenAt: nowIso() })),

    answerEscalation(id, answer, actor) {
      if (answer.trim().length < 2) return deny('Write the answer the guest will read.')
      return updateEscalation(id, (e) => {
        if (e.status === 'closed') return 'This escalation is closed.'
        postStaff(e.conversationId, answer.trim(), actor)
        state.conversations = state.conversations.map((c) => (c.id === e.conversationId ? { ...c, status: 'open' } : c))
        return { ...e, status: 'answered', answer: answer.trim(), answeredBy: actor, answeredAt: nowIso(), takenBy: e.takenBy ?? actor, takenAt: e.takenAt ?? nowIso() }
      })
    },

    closeEscalation(id, note, actor) {
      return updateEscalation(id, (e) => {
        if (e.status === 'closed') return 'Already closed.'
        if (e.status !== 'answered' && note.trim().length < 3) return 'Say why it is closed without an answer.'
        const others = state.escalations.some((x) => x.conversationId === e.conversationId && x.id !== e.id && x.status !== 'closed' && x.status !== 'answered')
        if (!others) state.conversations = state.conversations.map((c) => (c.id === e.conversationId && c.status === 'escalated' ? { ...c, status: 'open' } : c))
        return { ...e, status: 'closed', closedBy: actor, closedAt: nowIso(), closeNote: note.trim() || undefined }
      })
    },

    // ---- Insights ----
    refreshInsights(s) {
      ensureSeeded(s.propertyId)
      const generatedAt = s.now
      const forecasts = forecastRules.forecast(s, 30, { generatedAt }).map((f) => ({ ...f, id: `FC-${s.propertyId}-${f.date}` }))
      const recs = merge(state.recommendations.filter((r) => r.propertyId === s.propertyId), forecastRules.recommend(s, { generatedAt }), 'RC')
      const oldAnoms = state.anomalies.filter((a) => a.propertyId === s.propertyId)
      const byKey = new Map(oldAnoms.map((a) => [a.key, a]))
      const found = anomalyRules.detect(s, journalOf(s.propertyId), generatedAt)
      const anomalies: Anomaly[] = found.map((f) => {
        const was = byKey.get(f.key)
        return was
          ? { ...f, id: was.id, status: was.status, caseRef: was.caseRef, lastActionBy: was.lastActionBy, lastActionAt: was.lastActionAt, detectedAt: was.detectedAt }
          : { ...f, id: nextId('AN'), status: 'open' }
      })
      const freshKeys = new Set(found.map((f) => f.key))
      // Something no longer seen is kept once a person has acted on it, for the record.
      for (const o of oldAnoms) if (!freshKeys.has(o.key) && o.status !== 'open') anomalies.push(o)
      let changed = false
      const a = replaceFor(state.forecasts, s.propertyId, forecasts)
      const b = replaceFor(state.recommendations, s.propertyId, recs)
      const c = replaceFor(state.anomalies, s.propertyId, anomalies)
      if (a.changed || b.changed || c.changed) {
        state.forecasts = a.list
        state.recommendations = b.list
        state.anomalies = c.list
        changed = true
      }
      if (changed) commit()
      return Promise.resolve()
    },

    listForecasts: (propertyId) => Promise.resolve(copy(state.forecasts.filter((f) => f.propertyId === propertyId).sort((a, b) => a.date.localeCompare(b.date)))),
    listRecommendations: (propertyId) => Promise.resolve(copy(state.recommendations.filter((r) => r.propertyId === propertyId))),

    decideRecommendation(id, accept, note, actor, resultRef) {
      const r = decide(state.recommendations, id, accept, note, actor, resultRef)
      if (typeof r === 'string') return deny(r)
      state.recommendations = r.list
      commit()
      return Promise.resolve(copy(r.next))
    },

    listAnomalies: (propertyId) => Promise.resolve(copy(state.anomalies.filter((a) => a.propertyId === propertyId).sort((a, b) => b.score - a.score))),
    listAnomalyActions: (propertyId) => Promise.resolve(copy(state.anomalyActions.filter((a) => a.propertyId === propertyId).sort((a, b) => b.at.localeCompare(a.at)))),

    async actOnAnomaly(id, action, note, actor) {
      const found = state.anomalies.find((a) => a.id === id)
      if (!found) throw new Error('Anomaly not found')
      const text = note.trim()
      if (action === 'dismiss' && text.length < 3) throw new Error('Give a reason for dismissing it.')
      if (action === 'dismiss' && found.status !== 'open') throw new Error('Only an open anomaly can be dismissed.')
      if (action === 'open-case' && found.status === 'case') throw new Error('A case is already open.')
      if (action === 'resolve' && found.status !== 'case') throw new Error('Only an open case can be resolved.')
      if (action === 'resolve' && text.length < 3) throw new Error('Say what was found.')
      let next: Anomaly = { ...found, lastActionBy: actor, lastActionAt: nowIso() }
      let detail = text
      if (action === 'dismiss') next.status = 'dismissed'
      if (action === 'reopen') next.status = 'open'
      if (action === 'resolve') next.status = 'resolved'
      if (action === 'open-case') {
        const task = await deps.tasks.create(
          {
            title: `Investigate: ${found.title}`.slice(0, 120),
            description: `${found.drivers.map((d) => d.text).join(' ')} Records: ${found.sources.map((s) => s.label).join(', ')}.${text ? ` Note: ${text}` : ''}`,
            category: 'other',
            priority: found.severity === 'high' ? 'urgent' : 'high',
            dueAt: new Date(Date.now() + 24 * 3600000).toISOString(),
            reservationId: found.sources.find((s) => s.kind === 'reservation')?.id,
          },
          actor,
        )
        next = { ...next, status: 'case', caseRef: task.id }
        detail = `Case task ${task.id} opened.${text ? ` ${text}` : ''}`
      }
      if (action === 'notify') {
        await deps.notifications.publish({
          key: `anomaly:${found.id}:${Date.now()}`,
          type: 'automation-alert',
          severity: found.severity === 'high' ? 'bad' : 'warn',
          audience: 'frontdesk',
          title: found.title,
          body: text || found.drivers[0]?.text || '',
          link: '/automation/insights',
        })
        detail = `Front desk told.${text ? ` ${text}` : ''}`
      }
      state.anomalies = state.anomalies.map((a) => (a.id === id ? next : a))
      state.anomalyActions = [{ id: nextId('AA'), propertyId: found.propertyId, anomalyId: id, action, note: detail, by: actor, at: nowIso() }, ...state.anomalyActions]
      commit()
      return copy(next)
    },

    // ---- Guests ----
    refreshGuests(s) {
      ensureSeeded(s.propertyId)
      const generatedAt = s.now
      const { segments, members } = segmentRules.segment(s, { generatedAt })
      const segs = segments.map((x) => ({ ...x, id: `SG-${s.propertyId}-${x.code}` }))
      const mems = members.map((m) => ({ ...m, id: `SM-${s.propertyId}-${m.segmentCode}-${m.guestId}`, segmentId: `SG-${s.propertyId}-${m.segmentCode}` }))
      const nbas = merge(state.nbas.filter((n) => n.propertyId === s.propertyId), nextBestActionRules.suggest(s, members, { generatedAt }), 'NBA')
      const a = replaceFor(state.segments, s.propertyId, segs)
      const b = replaceFor(state.members, s.propertyId, mems)
      const c = replaceFor(state.nbas, s.propertyId, nbas)
      if (a.changed || b.changed || c.changed) {
        state.segments = a.list
        state.members = b.list
        state.nbas = c.list
        commit()
      }
      return Promise.resolve()
    },

    listSegments: (propertyId) => Promise.resolve(copy(state.segments.filter((x) => x.propertyId === propertyId))),
    listSegmentMembers: (propertyId) => Promise.resolve(copy(state.members.filter((x) => x.propertyId === propertyId))),
    listNextBestActions: (propertyId) => Promise.resolve(copy(state.nbas.filter((x) => x.propertyId === propertyId).sort((a, b) => b.score - a.score))),

    async decideNextBestAction(id, accept, note, actor) {
      const found = state.nbas.find((x) => x.id === id)
      if (!found) throw new Error('Suggestion not found')
      if (found.status !== 'open') throw new Error('This suggestion has already been decided.')
      let ref: string | undefined
      if (accept) {
        const task = await deps.tasks.create(
          {
            title: `${found.title}: ${found.guestName}${found.room ? `, room ${found.room}` : ''}`.slice(0, 120),
            description: `${found.detail} Why: ${found.drivers.map((d) => d.text).join(' ')}${note.trim() ? ` Note: ${note.trim()}` : ''}`,
            category: NBA_CATEGORY[found.kind],
            priority: found.score >= 70 ? 'high' : 'normal',
            dueAt: new Date(Date.now() + 3 * 3600000).toISOString(),
            reservationId: found.reservationId,
          },
          actor,
        )
        ref = task.id
      }
      const r = decide(state.nbas, id, accept, note, actor, ref)
      if (typeof r === 'string') throw new Error(r)
      state.nbas = r.list
      commit()
      return copy(r.next)
    },

    // ---- Operations ----
    refreshOperations(s) {
      ensureSeeded(s.propertyId)
      const generatedAt = s.now
      const fresh = [...priorityRules.housekeeping(s, { generatedAt }), ...priorityRules.maintenance(s, { generatedAt })]
      const old = state.priorities.filter((p) => p.propertyId === s.propertyId)
      // Only today's list is kept open; decisions stay for the record.
      const prios = merge(old, fresh, 'PS').filter((p) => p.status !== 'open' || fresh.some((f) => f.key === p.key))
      const forecasts = forecastRules.forecast(s, 14, { generatedAt })
      const staff = merge(state.staffing.filter((x) => x.propertyId === s.propertyId), staffingRules.staffing(s, forecasts, 14, { generatedAt }), 'SF')
        .filter((x) => x.date >= s.today)
      const a = replaceFor(state.priorities, s.propertyId, prios)
      const b = replaceFor(state.staffing, s.propertyId, staff)
      if (a.changed || b.changed) {
        state.priorities = a.list
        state.staffing = b.list
        commit()
      }
      return Promise.resolve()
    },

    listPriorityScores: (propertyId) => Promise.resolve(copy(state.priorities.filter((p) => p.propertyId === propertyId).sort((a, b) => a.rank - b.rank))),

    decidePriority(id, accept, note, actor, resultRef) {
      const r = decide(state.priorities, id, accept, note, actor, resultRef)
      if (typeof r === 'string') return deny(r)
      state.priorities = r.list
      commit()
      return Promise.resolve(copy(r.next))
    },

    listStaffing: (propertyId) => Promise.resolve(copy(state.staffing.filter((x) => x.propertyId === propertyId).sort((a, b) => a.date.localeCompare(b.date)))),

    decideStaffing(id, accept, note, actor) {
      const r = decide(state.staffing, id, accept, note, actor)
      if (typeof r === 'string') return deny(r)
      state.staffing = r.list
      commit()
      return Promise.resolve(copy(r.next))
    },

    // ---- Workflows ----
    listTemplates: () => Promise.resolve(copy(TEMPLATES)),

    listWorkflows(propertyId) {
      ensureSeeded(propertyId)
      return Promise.resolve(copy(state.workflows.filter((w) => w.propertyId === propertyId)))
    },

    saveWorkflow(propertyId, input, actor) {
      ensureSeeded(propertyId)
      const name = input.name.trim()
      if (name.length < 3) return deny('Give the workflow a name.')
      if (input.steps.length === 0) return deny('Add at least one step.')
      if ((input.trigger.type === 'refund-above' || input.trigger.type === 'room-out-of-order') && !(Number(input.trigger.threshold) > 0)) {
        return deny(input.trigger.type === 'refund-above' ? 'Set the refund amount that starts it.' : 'Set how many hours out of order.')
      }
      for (const c of input.conditions) if (!c.field || !c.value.trim()) return deny('Every condition needs a field and a value.')
      for (const s of input.steps) {
        if (s.kind === 'approval' && !s.role) return deny('An approval step needs the role that approves.')
        if (s.kind === 'notification' && !s.role) return deny('A notification needs the role to tell.')
        if (s.kind === 'action' && !s.action) return deny('An action step needs an action.')
        if (s.text.trim().length < 3) return deny('Every step needs its text.')
      }
      if (state.workflows.some((w) => w.propertyId === propertyId && w.id !== input.id && w.name.toLowerCase() === name.toLowerCase())) {
        return deny('Another workflow has this name.')
      }
      const at = nowIso()
      const found = input.id ? state.workflows.find((w) => w.id === input.id) : undefined
      if (input.id && !found) return deny('Workflow not found')
      const id = found?.id ?? nextId('WF')
      const w: Workflow = {
        id,
        propertyId,
        name,
        description: input.description.trim(),
        trigger: { type: input.trigger.type, threshold: input.trigger.threshold ? Number(input.trigger.threshold) : undefined },
        conditions: input.conditions.map((c) => ({ ...c, id: c.id || nextId('WC'), value: c.value.trim() })),
        steps: input.steps.map((s, i) => ({ ...s, id: s.id || nextId('WS'), workflowId: id, position: i + 1, text: s.text.trim() })),
        enabled: input.enabled,
        templateId: found?.templateId,
        createdBy: found?.createdBy ?? actor,
        createdAt: found?.createdAt ?? at,
        updatedBy: actor,
        updatedAt: at,
      }
      state.workflows = found ? state.workflows.map((x) => (x.id === id ? w : x)) : [...state.workflows, w]
      commit()
      return Promise.resolve(copy(w))
    },

    createFromTemplate(propertyId, templateId, actor) {
      ensureSeeded(propertyId)
      const t = TEMPLATES.find((x) => x.id === templateId)
      if (!t) return deny('Template not found')
      const w = fromTemplate(propertyId, templateId, actor)
      if (!w) return deny('Template not found')
      const taken = state.workflows.filter((x) => x.propertyId === propertyId && x.id !== w.id && x.name.startsWith(t.name)).length
      if (taken) state.workflows = state.workflows.map((x) => (x.id === w.id ? { ...x, name: `${t.name} (${taken + 1})`, enabled: false } : x))
      commit()
      return Promise.resolve(copy(state.workflows.find((x) => x.id === w.id) as Workflow))
    },

    setEnabled(id, enabled, actor) {
      const found = state.workflows.find((w) => w.id === id)
      if (!found) return deny('Workflow not found')
      const next = { ...found, enabled, updatedBy: actor, updatedAt: nowIso() }
      state.workflows = state.workflows.map((w) => (w.id === id ? next : w))
      commit()
      return Promise.resolve(copy(next))
    },

    deleteWorkflow(id) {
      const found = state.workflows.find((w) => w.id === id)
      if (!found) return deny('Workflow not found')
      if (state.runs.some((r) => r.workflowId === id && r.status === 'awaiting-approval')) return deny('A run is waiting for approval. Decide it first.')
      // Runs and their log are kept: the audit outlives the workflow.
      state.workflows = state.workflows.filter((w) => w.id !== id)
      commit()
      return Promise.resolve()
    },

    testRun(id, event, actor) {
      const w = state.workflows.find((x) => x.id === id)
      if (!w) return deny('Workflow not found')
      if (event.type !== w.trigger.type) return deny('The sample event is for a different trigger.')
      const run = startRun(w, { ...event, key: `test:${Date.now()}` }, 'test', actor)
      commit()
      return Promise.resolve(copy(run))
    },

    pendingEvents(s) {
      ensureSeeded(s.propertyId)
      return Promise.resolve(copy(pending(s)))
    },

    runLive(s, actor) {
      ensureSeeded(s.propertyId)
      const out: WorkflowRun[] = []
      for (const p of pending(s)) {
        const w = state.workflows.find((x) => x.id === p.workflowId)
        if (w) out.push(startRun(w, p.event, 'live', actor))
      }
      commit()
      return Promise.resolve(copy(out))
    },

    decideApproval(runId, approve, note, actor) {
      const run = state.runs.find((r) => r.id === runId)
      if (!run) return deny('Run not found')
      if (run.status !== 'awaiting-approval' || run.currentStep === undefined) return deny('This run is not waiting for approval.')
      const w = state.workflows.find((x) => x.id === run.workflowId)
      const step = [...(w?.steps ?? [])].sort((a, b) => a.position - b.position)[run.currentStep]
      if (!w || !step) return deny('The workflow for this run has been removed.')
      if (step.role && actor.role !== step.role && actor.role !== 'owner') return deny(`Only ${roleLabel(step.role)} (or the owner) can decide this step.`)
      if (!approve && note.trim().length < 3) return deny('Give a reason for rejecting it.')
      const at = nowIso()
      const who: Actor = { id: actor.id, name: actor.name }
      if (!approve) {
        log(run, 'rejected', `Rejected: ${note.trim()}`, false, who, at)
        const done = { ...run, status: 'rejected' as const, currentStep: undefined, finishedAt: at }
        setRun(done)
        commit()
        return Promise.resolve(copy(done))
      }
      log(run, 'approved', `Approved by ${actor.name}${note.trim() ? `: ${note.trim()}` : ''}`, true, who, at)
      const next = continueRun({ ...run, status: 'completed' }, run.currentStep + 1, who, at)
      commit()
      return Promise.resolve(copy(next))
    },

    listRuns: (propertyId) => Promise.resolve(copy(state.runs.filter((r) => r.propertyId === propertyId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)))),
    listRunEvents: (runId) => Promise.resolve(copy(state.runEvents.filter((e) => e.runId === runId))),

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
