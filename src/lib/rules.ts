import type { Answer, DraftAction, GoAction, Reservation, Room, Suggestion } from '../types'
import { TODAY } from '../data/sample'
import { dayMonth, ugx } from './format'

const goArrivals: GoAction = { kind: 'go', label: 'Open arrivals', to: '/desk/reservations?view=arrivals' }
const goHousekeeping: GoAction = { kind: 'go', label: 'Open housekeeping', to: '/housekeeping' }
const goFolios: GoAction = { kind: 'go', label: 'Open folios', to: '/desk/folios' }

const firstName = (guest: string) => guest.split(' ')[0]

function depositDraft(r: Reservation): DraftAction {
  const amount = Math.round((r.total * 0.3) / 1000) * 1000
  return {
    kind: 'draft',
    label: `Payment request: ${firstName(r.guest)}`,
    title: `Deposit request for ${r.guest}`,
    recipient: `${r.guest} (SMS)`,
    body: `Hello ${firstName(r.guest)}, thank you for booking a ${r.roomType} room at Sample Hotel from ${dayMonth(r.arrival)} to ${dayMonth(r.departure)}. To secure it, please pay a deposit of ${ugx(amount)} by MTN MoMo or Airtel Money. Reply to this message and we will send the payment prompt to your phone. Thank you.`,
  }
}

function reminderDraft(r: Reservation): DraftAction {
  return {
    kind: 'draft',
    label: `Payment reminder: ${firstName(r.guest)}`,
    title: `Balance reminder for ${r.guest}`,
    recipient: `${r.guest} (SMS)`,
    body: `Hello ${firstName(r.guest)}, thank you for staying with us. Your balance of ${ugx(r.total - r.paid)} is due at check-out today. You can pay at the front desk or by MTN MoMo or Airtel Money. We hope you enjoyed your stay.`,
  }
}

export function buildRuleSuggestions(reservations: Reservation[], rooms: Room[]): Suggestion[] {
  const out: Suggestion[] = []
  const arrivals = reservations.filter((r) => r.status === 'booked' && r.arrival === TODAY)

  for (const r of arrivals) {
    if (r.paid === 0) {
      out.push({
        source: 'rule',
        text: `${r.guest} arrives today with no deposit.`,
        actions: [depositDraft(r), goArrivals],
      })
    }
  }

  for (const room of rooms.filter((x) => x.status === 'dirty')) {
    const next = arrivals.find((r) => r.roomType === room.type)
    if (next) {
      out.push({
        source: 'rule',
        text: `Room ${room.number} is dirty and ${next.guest} (${next.roomType}) arrives today.`,
        actions: [goHousekeeping],
      })
    }
  }

  for (const r of reservations) {
    if (r.status === 'in-house' && r.departure === TODAY && r.total > r.paid) {
      out.push({
        source: 'rule',
        text: `${r.guest} departs today with ${ugx(r.total - r.paid)} unpaid.`,
        actions: [reminderDraft(r), goFolios],
      })
    }
  }

  return out
}

export function answerQuestion(question: string, reservations: Reservation[], rooms: Room[]): Answer {
  const q = question.toLowerCase()
  const arrivals = reservations.filter((r) => r.status === 'booked' && r.arrival === TODAY)

  if (q.includes('deposit')) {
    const missing = arrivals.filter((r) => r.paid === 0)
    if (missing.length === 0) return { text: 'Every arrival today has paid a deposit.', actions: [goArrivals] }
    return {
      text: `${missing.map((r) => r.guest).join(', ')} ${missing.length === 1 ? 'arrives' : 'arrive'} today with no deposit.`,
      actions: [...missing.map(depositDraft), goArrivals],
    }
  }

  if (q.includes('unpaid') || q.includes('owe') || q.includes('balance')) {
    const owing = reservations.filter((r) => r.status === 'in-house' && r.total > r.paid)
    if (owing.length === 0) return { text: 'No in-house guest has an unpaid balance.', actions: [] }
    return {
      text: 'Unpaid balances: ' + owing.map((r) => `${r.guest} (${ugx(r.total - r.paid)})`).join(', ') + '.',
      actions: [goFolios],
    }
  }

  if (q.includes('arrive')) {
    return {
      text: `${arrivals.length} arrival${arrivals.length === 1 ? '' : 's'} today: ${arrivals.map((r) => r.guest).join(', ')}.`,
      actions: [goArrivals],
    }
  }

  if (q.includes('clean') || q.includes('dirty')) {
    const dirty = rooms.filter((r) => r.status === 'dirty')
    return {
      text: dirty.length ? `Rooms to clean: ${dirty.map((r) => r.number).join(', ')}.` : 'No rooms need cleaning.',
      actions: [goHousekeeping],
    }
  }

  return {
    text: 'Sample mode: I only know a few questions so far. Try "who arrives today without a deposit?"',
    actions: [],
  }
}