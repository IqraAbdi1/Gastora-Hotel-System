import { useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { CALL_OUTCOMES, CALL_STATE_LABEL, toConfirm } from '../../lib/confirmCalls'
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
  const { reservations, recordConfirmCall } = useHotel()
  const { options } = useFeatures()
  const { user } = useAuth()
  const [open, setOpen] = useState<string | null>(null)

  const releaseTime = options.rates.releaseTime
  const now = nowTime()
  const list = toConfirm(reservations, TODAY, releaseTime, now)
  const left = list.filter((x) => x.state === 'to call' || x.state === 'chase' || x.state === 'overdue').length

  if (list.length === 0) return null

  function record(id: string, outcome: CallOutcome) {
    recordConfirmCall(id, outcome, user?.name ?? 'Front desk')
    setOpen(null)
  }

  return (
    <Card
      icon="alert"
      title="Call to confirm"
      count={left}
      description={`Nothing is holding these bookings. Rooms not confirmed by ${releaseTime} can go back on sale.`}
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
                    Past {releaseTime}. This room can be sold to someone else.
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
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}>
                  {r.confirmCall ? 'Called again' : 'I called them'}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink/55">
        The release time is set in Rates and policies. Recording the call is what lets the desk know, at{' '}
        {releaseTime}, which rooms it can honestly resell.
      </p>
    </Card>
  )
}
