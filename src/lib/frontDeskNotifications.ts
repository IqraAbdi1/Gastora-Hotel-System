import type { NotificationInput } from '../services/notifications/notificationTypes'
import type { FrontDeskTask } from '../services/tasks/taskTypes'
import type { Reservation, Room } from '../types'
import { addDays } from './availability'
import { dateTime, dayMonth, ugx } from './format'
import { reservationsNeedingAttention } from './frontdesk'
import { taskState } from './tasks'

// Turns the current state of the hotel into the notifications the front desk should have.
// It is safe to run as often as you like: every notification has a key that names the event, and
// the notification service ignores a key it has already seen.
//
// Prototype only. With a backend, the server raises these when the event happens and this file goes.
export function frontDeskNotifications(
  reservations: Reservation[],
  rooms: Room[],
  tasks: FrontDeskTask[],
  today: string,
  now: number,
): NotificationInput[] {
  const out: NotificationInput[] = []
  const base = { audience: 'frontdesk' as const }
  const ref = (r: Reservation) => ({ kind: 'reservation' as const, id: r.id })

  for (const a of reservationsNeedingAttention(reservations, rooms, today)) {
    const r = a.reservation
    if (a.kind === 'no-guarantee') {
      out.push({
        ...base,
        key: `no-guarantee:${r.id}:${r.arrival}`,
        type: 'reservation-verification',
        severity: 'warn',
        title: `${r.guest} arrives today with no deposit`,
        body: `${r.id}, ${r.roomType}. No deposit or guarantee is recorded. Confirm payment before check-in.`,
        link: '/desk/reservations?view=arrivals',
        entity: ref(r),
      })
    } else if (a.kind === 'missed-arrival') {
      out.push({
        ...base,
        key: `missed-arrival:${r.id}:${r.arrival}`,
        type: 'arrival-attention',
        severity: 'bad',
        title: `${r.guest} has not arrived`,
        body: `${r.id} was due on ${dayMonth(r.arrival)} and is still booked. Check in or record a no-show.`,
        link: '/desk/reservations',
        entity: ref(r),
      })
    } else if (a.kind === 'no-ready-room') {
      out.push({
        ...base,
        key: `no-ready-room:${r.id}:${today}`,
        type: 'arrival-attention',
        severity: 'warn',
        title: `${a.title} for ${r.guest}`,
        body: `${r.id} arrives today. ${a.detail}`,
        link: '/housekeeping',
        entity: ref(r),
      })
    } else if (a.kind === 'overdue-departure') {
      out.push({
        ...base,
        key: `overdue-departure:${r.id}:${r.departure}`,
        type: 'departure-attention',
        severity: 'bad',
        title: `${r.guest} is past their departure date`,
        body: `Room ${r.room ?? '?'} was due out on ${dayMonth(r.departure)}. Extend the stay or check out.`,
        link: '/desk/folios?view=leaving',
        entity: ref(r),
      })
    }
  }

  const tomorrow = addDays(today, 1)
  for (const r of reservations) {
    // Arrives tomorrow with nothing paid and no guarantee: a day's notice to ask for a deposit.
    if (r.status === 'booked' && r.arrival === tomorrow && r.paid === 0 && r.guarantee !== 'card' && r.guarantee !== 'company') {
      out.push({
        ...base,
        key: `unguaranteed-tomorrow:${r.id}:${r.arrival}`,
        type: 'reservation-verification',
        severity: 'info',
        title: `${r.guest} arrives tomorrow with no deposit`,
        body: `${r.id}, ${r.roomType}. Contact the guest to secure the booking.`,
        link: '/desk/reservations',
        entity: ref(r),
      })
    }
    if (r.cancellation) {
      const c = r.cancellation
      out.push({
        ...base,
        key: `cancelled:${r.id}`,
        type: 'reservation-cancelled',
        severity: 'info',
        title: `${r.guest}: ${c.kind === 'no-show' ? 'recorded as no-show' : 'reservation cancelled'}`,
        body: `${r.id}. ${c.reason ? `Reason: ${c.reason}. ` : ''}${c.charge > 0 && !c.waived ? `Charge ${ugx(c.charge)}.` : 'No charge.'}`,
        link: '/desk/reservations',
        entity: ref(r),
      })
    }
    for (const ch of r.changes ?? []) {
      out.push({
        ...base,
        key: `changed:${r.id}:${ch.at}`,
        type: 'reservation-change',
        severity: 'info',
        title: `${r.guest}: stay dates changed`,
        body: `${r.id} moved from ${dayMonth(ch.fromArrival)}–${dayMonth(ch.fromDeparture)} to ${dayMonth(ch.toArrival)}–${dayMonth(ch.toDeparture)}.${ch.reason ? ` Reason: ${ch.reason}.` : ''}`,
        link: '/desk/reservations',
        entity: ref(r),
      })
    }
  }

  for (const t of tasks) {
    if (taskState(t, now) !== 'overdue') continue
    out.push({
      ...base,
      // The due time is in the key, so a task moved to a new time can fall overdue again.
      key: `task-overdue:${t.id}:${t.dueAt}`,
      type: 'task-overdue',
      severity: t.priority === 'urgent' || t.priority === 'high' ? 'bad' : 'warn',
      title: `Overdue: ${t.title}`,
      body: `Was due ${dateTime(t.dueAt)}. ${t.assignee ? `Assigned to ${t.assignee.name}.` : 'Not assigned to anyone.'}`,
      link: '/desk#tasks',
      entity: { kind: 'task', id: t.id },
    })
  }

  return out
}
