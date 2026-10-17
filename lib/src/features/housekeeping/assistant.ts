import type { Reservation } from '../../types'
import { ugx } from '../../lib/format'
import { attendants, estimateReady, isActive, priorityRank } from './hkModel'
import type { HkRoom, HkTask } from './hkModel'

// Rule-based answers for the housekeeping search bar. Each answer is worked out from the live data.
// Later a real model can replace this one function; the screen does not change.
export type HkAnswer = { text: string; actions: { label: string; run: () => void }[] }

type Ctx = {
  rooms: HkRoom[]
  tasks: HkTask[]
  leaving: Reservation[]
  assign: (taskId: number, attendant: string) => void
  go: (to: string) => void
}

export function isQuestion(text: string) {
  const t = text.trim()
  if (!t) return false
  return /\?$/.test(t) || /^(who|which|what|when|how|where|show|list|is|are|can)\b/i.test(t) || t.split(/\s+/).length >= 4
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const pad = (n: number) => String(n).padStart(2, '0')

// "3pm", "3 pm", "15:00" or "3:30pm" becomes "15:00". Plain numbers are ignored, so room numbers are safe.
function parseTime(q: string): string | null {
  const m = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ?? q.match(/\b(\d{1,2}):(\d{2})()\b/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const suffix = m[3]?.toLowerCase()
  if (suffix === 'pm' && h < 12) h += 12
  if (suffix === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

// Spread the open tasks across the attendants, lightest load first, most urgent task first.
export function planAssignments(tasks: HkTask[]) {
  const staff = attendants.filter((a) => a !== 'Unassigned')
  const load = new Map(staff.map((a) => [a, 0]))
  for (const t of tasks) if (isActive(t) && load.has(t.attendant)) load.set(t.attendant, (load.get(t.attendant) ?? 0) + 1)
  const open = tasks
    .filter((t) => t.status === 'Unassigned')
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.room.localeCompare(b.room))
  return open.map((task) => {
    const [name] = [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
    load.set(name, (load.get(name) ?? 0) + 1)
    return { task, attendant: name }
  })
}

export function answerHousekeeping(question: string, ctx: Ctx): HkAnswer {
  const q = question.toLowerCase()
  const { rooms, tasks } = ctx

  if (/leav|depart|check.?out/.test(q)) {
    if (ctx.leaving.length === 0) return { text: 'No one is due to leave today.', actions: [] }
    const owing = ctx.leaving.filter((r) => r.total > r.paid)
    return {
      text:
        `${ctx.leaving.length} leaving today: ${ctx.leaving.map((r) => `${r.guest} (room ${r.room})`).join(', ')}. ` +
        (owing.length
          ? `Still owing: ${owing.map((r) => `${r.guest} ${ugx(r.total - r.paid)}`).join(', ')}. `
          : 'All balances are settled. ') +
        'Each room needs cleaning after check-out.',
      actions: [{ label: 'Open departures', run: () => ctx.go('/desk/folios?view=leaving') }],
    }
  }

  if (/ready|available|can be sold/.test(q)) {
    const target = parseTime(q)
    const now = rooms.filter((r) => r.status === 'Clean' || r.status === 'Inspected')
    const waiting = rooms
      .filter((r) => r.status === 'Dirty' || r.status === 'Being Cleaned')
      .map((r) => ({ room: r, time: r.readyBy ?? estimateReady(r) }))
      .filter((x) => !target || x.time <= target)
      .sort((a, b) => a.time.localeCompare(b.time))
    const nowText = now.length ? `${plural(now.length, 'room')} ready now: ${now.map((r) => r.room).join(', ')}.` : 'No room is ready right now.'
    const laterText = waiting.length
      ? ` ${target ? `By ${target}` : 'Still being prepared'}: ${waiting.map((x) => `${x.room.room} (about ${x.time})`).join(', ')}.`
      : target
        ? ` Nothing else is expected to be ready by ${target}.`
        : ''
    return {
      text: nowText + laterText + ' Times are estimates from average clean times.',
      actions: [{ label: 'Open Today', run: () => ctx.go('/desk') }],
    }
  }

  if (/unassigned|assign|attendant|no one|nobody|busy|free staff/.test(q)) {
    const plan = planAssignments(tasks)
    if (plan.length === 0) return { text: 'Every open task has an attendant.', actions: [] }
    return {
      text: `${plural(plan.length, 'task')} ${plan.length === 1 ? 'has' : 'have'} no attendant. Fair split: ${plan
        .map((p) => `room ${p.task.room} to ${p.attendant}`)
        .join(', ')}.`,
      actions: [
        {
          label: `Assign ${plural(plan.length, 'task')} fairly`,
          run: () => plan.forEach((p) => ctx.assign(p.task.id, p.attendant)),
        },
      ],
    }
  }

  if (/urgent|high|rush|priority/.test(q)) {
    const hot = tasks.filter((t) => isActive(t) && (t.priority === 'Urgent' || t.priority === 'High'))
    if (hot.length === 0) return { text: 'No urgent or high priority tasks right now.', actions: [] }
    return {
      text: `${plural(hot.length, 'priority task')}: ${hot.map((t) => `room ${t.room} (${t.priority})`).join(', ')}.`,
      actions: [{ label: 'Open tasks', run: () => ctx.go('/housekeeping/tasks') }],
    }
  }

  if (/out of (service|order)|issue|blocked|maintenance|broken/.test(q)) {
    const bad = rooms.filter((r) => r.status === 'Out of Service' || r.status === 'Out of Order' || r.status === 'Discrepancy')
    if (bad.length === 0) return { text: 'No room has an issue right now.', actions: [] }
    return {
      text: `${plural(bad.length, 'room')} with an issue: ${bad.map((r) => `${r.room} (${r.status}${r.reason ? `: ${r.reason}` : ''})`).join(', ')}.`,
      actions: [{ label: 'Open issues', run: () => ctx.go('/housekeeping/issues') }],
    }
  }

  if (/dirty|clean/.test(q)) {
    const dirty = rooms.filter((r) => r.status === 'Dirty')
    const busy = rooms.filter((r) => r.status === 'Being Cleaned')
    return {
      text: `${dirty.length} dirty${dirty.length ? ` (${dirty.map((r) => r.room).join(', ')})` : ''}, ${busy.length} being cleaned${busy.length ? ` (${busy.map((r) => r.room).join(', ')})` : ''}.`,
      actions: [],
    }
  }

  return {
    text: 'Sample mode: I answer a few questions so far. Try "which rooms will be ready by 3pm?", "who is leaving today?" or "which tasks have no attendant?"',
    actions: [],
  }
}