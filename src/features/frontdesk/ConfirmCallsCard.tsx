import { useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { CALL_OUTCOMES, CALL_STATE_LABEL, toConfirm } from '../../lib/confirmCalls'
import { lateButConfirmed } from '../../lib/dayRun'
import type { CallOutcome, CallState } from '../../lib/confirmCalls'
import { useHotel } from '../../lib/hotelContext'
import { nowTime } from '../../lib/stayTimes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

const tone: Record<CallState, 'bad' | 'warn' | 'good' | 'neutral'> = {
  overdue: 'bad',
  'not coming': 'bad',
  chase: 'warn',
  'to call': 'warn',
  confirmed: 'good',
}

/**
 * Bookings with no deposit and no card. Nothing can be charged if the guest never comes, so the only
 * protection is ringing them on the arrival day and freeing the room early enough to sell it again.
 */
export default function ConfirmCallsCard() {
  const { reservations, recordConfirmCall, releaseRoom } = useHotel()
  const { options } = useFeatures()
  const { user } = useAuth()
  const [open, setOpen] = useState<string | null>(null)

  const releaseTime = options.rates.releaseTime
  const now = nowTime()
  const list = toConfirm(reservations, TODAY, releaseTime, now)
  const left = list.filter((x) => x.state === 'to call' || x.state === 'chase' || x.state === 'overdue').length

  // Rooms the clock took back today, and the ones it would not: a guest who said they were coming is
  // released by a person, never by the hour, because they may simply be late.
  const releasedToday = reservations.filter((r) => r.status === 'no-show' && r.release && r.arrival === TODAY)
  const lateConfirmed = lateButConfirmed(reservations, TODAY, releaseTime, now)

  if (list.length === 0 && releasedToday.length === 0) return null

  function record(id: string, outcome: CallOutcome) {
    recordConfirmCall(id, outcome, user?.name ?? 'Front desk')
    setOpen(null)
  }

  return (
    <Card
      icon="alert"
      title="Call to confirm"
      count={left}
      description={`Unconfirmed rooms go back on sale at ${releaseTime}.`}
      padded
    >
      <ul className="space-y-2">
        {list.map(({ reservation: r, state }) => (
          <li key={r.id} className="rounded-lg border border-ink/10 bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.guest}</p>
                <p className="text-xs text-ink/60">
                  {r.id} &middot; {r.roomType}
                  {r.details?.phone ? ` · ${r.details.phone}` : ''}
                </p>
                {r.confirmCall && (
                  <p className="mt-1 text-xs text-ink/55">
                    {CALL_OUTCOMES.find((o) => o.key === r.confirmCall?.outcome)?.label} &middot; {r.confirmCall.by}{' '}
                    &middot; {r.confirmCall.at}
                  </p>
                )}
                {state === 'overdue' && (
                  <p className="mt-1 text-xs font-medium text-bad">
                    {options.rates.autoRelease
                      ? `Past ${releaseTime}. The room goes back on sale by itself.`
                      : `Past ${releaseTime}. This room can be sold to someone else.`}
                  </p>
                )}
                {lateConfirmed.some((x) => x.id === r.id) && (
                  <p className="mt-1 text-xs text-ink/70">
                    Confirmed, so it is not released automatically.
                  </p>
                )}
              </div>
              <Badge tone={tone[state]}>{CALL_STATE_LABEL[state]}</Badge>
            </div>

            {open === r.id ? (
              <div className="mt-3 space-y-2">
                {CALL_OUTCOMES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => record(r.id, o.key)}
                    className="block w-full rounded-lg bg-white px-3 py-2.5 text-left text-sm ring-1 ring-ink/15 hover:ring-brand"
                  >
                    <span className="font-semibold text-ink">{o.label}</span>
                    <span className="mt-0.5 block text-xs text-ink/60">{o.note}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="w-full px-3 py-2 text-xs font-medium text-ink/60"
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}>
                  {r.confirmCall ? 'Called again' : 'I called them'}
                </Button>
                {state === 'overdue' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => releaseRoom(r.id, user?.name ?? 'Front desk', false, `Released at the desk after ${releaseTime}`)}
                  >
                    Release the room
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {releasedToday.length > 0 && (
        <div className="mt-4 rounded-xl bg-ink/[0.04] p-3">
          <p className="text-xs font-semibold text-ink/70">Rooms back on sale today</p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink/65">
            {releasedToday.map((r) => (
              <li key={r.id}>
                {r.guest} &middot; {r.roomType} &middot; {r.release?.reason} &middot; {r.release?.by} at {r.release?.at}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
