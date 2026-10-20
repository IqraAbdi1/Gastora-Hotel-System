import { useEffect, useMemo } from 'react'
import { TODAY } from '../../data/sample'
import { useNow } from '../../lib/useNow'
import { auditReport } from '../../lib/nightAudit'
import { auditDue, noShowsAtClose, ran, reached, timeNow, toRelease } from '../../lib/dayRun'
import { proposeRooms, unassignedArrivals } from '../../lib/roomAssign'
import { useHotel } from '../../lib/hotelContext'
import { useFeatures } from '../platform/featuresContext'
import { useMessages } from '../messages/messagesContext'

// The clock doing what nobody remembers to. It draws nothing: it sits inside the app and acts when the
// hotel's own times are reached, which is the whole point of calling it automation.
//
// Honest about where it runs. This is a prototype with no server, so the clock only turns while the app
// is open: close every browser at five and nothing is released at six. A real build runs it on the
// server, which is the same rules in a place that never sleeps.
export default function DayRunner() {
  const { reservations, rooms, guests, releaseRoom, auditRuns, closeDay, assignRooms } = useHotel()
  const { options, features, setOptions } = useFeatures()
  const { queue } = useMessages()
  const now = useNow(30000)
  const clock = useMemo(() => timeNow(new Date(now)), [now])

  const policy = options.rates
  const due = policy.autoRelease ? toRelease(reservations, TODAY, policy.releaseTime, clock) : []

  if (due.length > 0) {
    for (const r of due) {
      releaseRoom(r.id, 'The system', true, `Nobody confirmed and ${policy.releaseTime} passed`)
      queue({
        kind: 'room released',
        reservationId: r.id,
        once: true,
        sendNow: true,
        by: 'The system',
        vars: { time: policy.releaseTime },
      })
    }
  }

  // The morning room assignment, once a day at the hotel's hour, when the hotel has switched it on.
  // It fills empty room slots only; anything the desk chose by hand is left alone. Run from an effect
  // rather than while drawing, because it changes the settings as well as the bookings.
  const auto = options.autoAssign
  const assignDue = features.roomAutoAssign && auto.on && auto.lastRun !== TODAY && reached(clock, auto.at)
  useEffect(() => {
    if (!assignDue) return
    setOptions({ autoAssign: { ...auto, lastRun: TODAY } })
    const plan = proposeRooms({ reservations, rooms, guests, today: TODAY, targets: unassignedArrivals(reservations, TODAY) })
    assignRooms(
      plan.filter((p) => p.room).map((p) => ({ reservationId: p.reservationId, room: p.room as string, reason: p.reason })),
      'The system',
      true,
    )
  }, [assignDue, auto, reservations, rooms, guests, setOptions, assignRooms])

  const auditOn = options.nightAudit
  if (auditDue(auditRuns, TODAY, clock, options.nightAuditAt, auditOn)) {
    const report = auditReport(reservations, rooms, TODAY)
    closeDay({
      date: TODAY,
      at: clock,
      by: 'The system',
      auto: true,
      inHouse: report.inHouse,
      arrivals: report.arrivals,
      departures: report.departures,
      owed: report.owed,
      noShows: noShowsAtClose(reservations, TODAY).map((r) => r.id),
      open: report.items.filter((i) => i.kind !== 'not-arrived').length,
    })
  }

  // Nothing of this is drawn. What it did shows on the front desk and on the night audit page.
  void ran
  return null
}
