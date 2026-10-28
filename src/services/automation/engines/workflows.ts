// Workflow rules: what each trigger listens for, how conditions are read, the shipped templates, and
// where live events come from. The runner itself lives in the mock service, which owns the run log.
import { ugx } from '../../../lib/format'
import { hoursOf } from '../../../lib/downtime'
import type { EventSource } from '../automationModels'
import type { ConditionOp, TriggerType, WorkflowCondition, WorkflowEvent, WorkflowTemplate, WorkflowTrigger } from '../automationTypes'

export const TRIGGERS: Record<TriggerType, { label: string; threshold?: string; fields: string[]; sample: WorkflowEvent }> = {
  'refund-above': {
    label: 'Refund above an amount',
    threshold: 'Amount (UGX)',
    fields: ['amount', 'user', 'outlet', 'reference', 'reason'],
    sample: {
      key: 'sample:refund',
      type: 'refund-above',
      summary: 'Refund of UGX 450,000 at the bar',
      data: { amount: 450000, user: 'Kevin Ocen', outlet: 'Bar', reference: 'BAR-2291', reason: 'Guest disputed bill' },
    },
  },
  'vip-arrival': {
    label: 'VIP arriving',
    fields: ['guestName', 'room', 'roomType', 'reservationId', 'nights'],
    sample: {
      key: 'sample:vip',
      type: 'vip-arrival',
      summary: 'Amina Nakato arrives today',
      data: { guestName: 'Amina Nakato', room: '201', roomType: 'Deluxe', reservationId: 'R-1042', nights: 2 },
    },
  },
  'room-out-of-order': {
    label: 'Room out of order too long',
    threshold: 'Hours',
    fields: ['room', 'hours', 'reason', 'kind'],
    sample: {
      key: 'sample:ooo',
      type: 'room-out-of-order',
      summary: 'Room 104 out of order for 30 hours',
      data: { room: '104', hours: 30, reason: 'Air conditioner not cooling', kind: 'out-of-order' },
    },
  },
  'low-stock': {
    label: 'Stock below reorder level',
    fields: ['item', 'onHand', 'reorderAt', 'unit', 'value'],
    sample: {
      key: 'sample:stock',
      type: 'low-stock',
      summary: 'Bath towels down to 12',
      data: { item: 'Bath towels', onHand: 12, reorderAt: 40, unit: 'pcs', value: 180000 },
    },
  },
  'escalation-open': {
    label: 'Guest question escalated',
    fields: ['guestName', 'room', 'question'],
    sample: {
      key: 'sample:escalation',
      type: 'escalation-open',
      summary: 'Ruth Nabirye: the shower is not working',
      data: { guestName: 'Ruth Nabirye', room: '204', question: 'The shower in my room is not working' },
    },
  },
  'anomaly-high': {
    label: 'High-severity anomaly found',
    fields: ['title', 'kind', 'amount', 'user', 'score'],
    sample: {
      key: 'sample:anomaly',
      type: 'anomaly-high',
      summary: '5 voids by Kevin Ocen',
      data: { title: '5 voids by Kevin Ocen', kind: 'void', amount: 214000, user: 'Kevin Ocen', score: 86 },
    },
  },
}

export const OP_LABEL: Record<ConditionOp, string> = {
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
}

/** {amount} and the rest, from the event. Money fields read as money. */
export function fillTemplate(text: string, e: WorkflowEvent): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = e.data[k]
    if (v === undefined) return `{${k}}`
    return typeof v === 'number' && /amount|value/i.test(k) ? ugx(v) : String(v)
  })
}

export function triggerMatches(t: WorkflowTrigger, e: WorkflowEvent): { ok: boolean; why: string } {
  if (t.type !== e.type) return { ok: false, why: 'Different kind of event.' }
  if (t.type === 'refund-above') {
    const amount = Number(e.data.amount ?? 0)
    const limit = t.threshold ?? 0
    return amount > limit
      ? { ok: true, why: `${ugx(amount)} is above ${ugx(limit)}.` }
      : { ok: false, why: `${ugx(amount)} is not above ${ugx(limit)}.` }
  }
  if (t.type === 'room-out-of-order') {
    const hours = Number(e.data.hours ?? 0)
    const limit = t.threshold ?? 24
    return hours > limit ? { ok: true, why: `${hours} h is over ${limit} h.` } : { ok: false, why: `${hours} h is not over ${limit} h.` }
  }
  return { ok: true, why: TRIGGERS[t.type].label + '.' }
}

export function conditionHolds(c: WorkflowCondition, e: WorkflowEvent): boolean {
  const raw = e.data[c.field]
  if (raw === undefined) return false
  const n = Number(raw)
  const m = Number(c.value)
  const numeric = !Number.isNaN(n) && !Number.isNaN(m) && c.value.trim() !== ''
  const a = String(raw).toLowerCase()
  const b = c.value.trim().toLowerCase()
  switch (c.op) {
    case 'gt':
      return numeric && n > m
    case 'gte':
      return numeric && n >= m
    case 'lt':
      return numeric && n < m
    case 'eq':
      return numeric ? n === m : a === b
    case 'neq':
      return numeric ? n !== m : a !== b
    case 'contains':
      return a.includes(b)
  }
}

export const describeCondition = (c: Pick<WorkflowCondition, 'field' | 'op' | 'value'>) => `${c.field} ${OP_LABEL[c.op]} ${c.value}`

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl-refund',
    name: 'Large refund needs finance',
    description: 'Refunds above UGX 300,000 wait for finance, then a check task and a note to the manager.',
    trigger: { type: 'refund-above', threshold: 300000 },
    conditions: [],
    steps: [
      { kind: 'approval', role: 'finance', text: 'Approve refund {reference} of {amount} by {user}' },
      { kind: 'action', action: 'create-task', text: 'Check refund {reference} ({amount}) against the bill' },
      { kind: 'notification', role: 'gm', text: 'Refund {reference} of {amount} approved by finance' },
    ],
  },
  {
    id: 'tpl-vip',
    name: 'VIP arrival preparation',
    description: 'A VIP arriving gets the room checked, an amenity and a welcome message.',
    trigger: { type: 'vip-arrival' },
    conditions: [],
    steps: [
      { kind: 'action', action: 'create-task', text: 'Prepare room {room} for {guestName}: inspect, amenity, welcome card' },
      { kind: 'action', action: 'send-message', text: 'Welcome {guestName}, your room will be ready for you. Reply here if you need anything.' },
      { kind: 'notification', role: 'frontdesk', text: 'VIP {guestName} arrives today, room {room}' },
    ],
  },
  {
    id: 'tpl-ooo',
    name: 'Room out of order over 24 hours',
    description: 'A room off sale over a day goes to the manager with an escalation task.',
    trigger: { type: 'room-out-of-order', threshold: 24 },
    conditions: [],
    steps: [
      { kind: 'action', action: 'create-task', text: 'Room {room} out of order {hours} h: {reason}. Agree a fix date.' },
      { kind: 'notification', role: 'gm', text: 'Room {room} has been off sale for {hours} hours' },
    ],
  },
  {
    id: 'tpl-stock',
    name: 'Low stock reorder',
    description: 'Stock under its reorder level asks the manager, then raises a purchase task.',
    trigger: { type: 'low-stock' },
    conditions: [{ field: 'reorderAt', op: 'gt', value: '0' }],
    steps: [
      { kind: 'approval', role: 'gm', text: 'Reorder {item}: {onHand} {unit} left, reorder at {reorderAt}' },
      { kind: 'action', action: 'create-task', text: 'Raise a purchase request for {item}' },
      { kind: 'notification', role: 'storekeeper', text: '{item} reorder approved' },
    ],
  },
  {
    id: 'tpl-escalation',
    name: 'Escalated guest question',
    description: 'A question the concierge could not answer becomes a desk task.',
    trigger: { type: 'escalation-open' },
    conditions: [],
    steps: [
      { kind: 'action', action: 'create-task', text: 'Reply to {guestName} (room {room}): {question}' },
      { kind: 'notification', role: 'frontdesk', text: 'Guest question waiting: {guestName}' },
    ],
  },
]

export const workflowEvents: EventSource = {
  events(s, journal, extra) {
    const out: WorkflowEvent[] = []
    for (const e of journal) {
      if (e.kind !== 'refund') continue
      out.push({
        key: `refund:${e.id}`,
        type: 'refund-above',
        summary: `${ugx(e.amount)} refund by ${e.user} (${e.reference})`,
        data: { amount: e.amount, user: e.user, outlet: e.outlet, reference: e.reference, reason: e.note },
      })
    }
    for (const a of s.approvals) {
      if (a.kind !== 'charge-reversal') continue
      out.push({
        key: `refund:${a.id}`,
        type: 'refund-above',
        summary: `${ugx(a.amount ?? 0)} reversal: ${a.what}`,
        data: { amount: a.amount ?? 0, user: a.requestedBy, outlet: 'Front desk', reference: a.id, reason: a.reason },
      })
    }
    for (const r of s.reservations) {
      if (r.status !== 'booked' || r.arrival !== s.today) continue
      const g = s.guests.find((x) => x.id === r.guestId)
      if (!g?.vip) continue
      out.push({
        key: `vip:${r.id}`,
        type: 'vip-arrival',
        summary: `${r.guest} arrives today`,
        data: { guestName: r.guest, room: r.room ?? 'not assigned', roomType: r.roomType, reservationId: r.id, nights: Math.max(1, Math.round((Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000)) },
      })
    }
    const now = Date.parse(s.now)
    for (const sp of s.spells) {
      if (sp.toIso || sp.kind !== 'out-of-order') continue
      const hours = Math.round(hoursOf(sp, now))
      out.push({
        key: `ooo:${sp.id}`,
        type: 'room-out-of-order',
        summary: `Room ${sp.room} out of order ${hours} h`,
        data: { room: sp.room, hours, reason: sp.reason ?? 'No reason given', kind: sp.kind },
      })
    }
    for (const item of s.stock) {
      if (item.onHand > item.reorderAt) continue
      out.push({
        key: `stock:${item.id}:${item.onHand}`,
        type: 'low-stock',
        summary: `${item.name} down to ${item.onHand} ${item.unit}`,
        data: { item: item.name, onHand: item.onHand, reorderAt: item.reorderAt, unit: item.unit, value: item.onHand * item.unitCost },
      })
    }
    for (const x of extra.openEscalations) {
      out.push({
        key: `esc:${x.id}`,
        type: 'escalation-open',
        summary: `${x.guestName}: ${x.question}`,
        data: { guestName: x.guestName, room: x.room ?? '—', question: x.question },
      })
    }
    for (const a of extra.highAnomalies) {
      out.push({
        key: `anomaly:${a.key}`,
        type: 'anomaly-high',
        summary: a.title,
        data: { title: a.title, kind: a.kind, amount: a.amount ?? 0, user: a.user ?? '—', score: a.score },
      })
    }
    return out
  },
}
