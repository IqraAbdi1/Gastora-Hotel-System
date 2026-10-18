import { useMemo } from 'react'
import { TODAY } from '../../data/sample'
import { useNow } from '../../lib/useNow'
import { auditReport } from '../../lib/nightAudit'
import { auditDue, noShowsAtClose, ran, timeNow, toRelease } from '../../lib/dayRun'
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
  const { reservations, rooms, releaseRoom, auditRuns, closeDay } = useHotel()
  const { options } = useFeatures()
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
