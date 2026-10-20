import { useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { KEY_RETURN_LABEL } from '../../lib/onlineCheckout'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useOnlineCheckouts } from '../portal/useOnlineCheckouts'

/**
 * Guests who checked out from their own page and are waiting for the desk to finish it. One click
 * checks them out; the rule is checked again at that moment, because a bar bill may have landed since.
 */
export default function OnlineCheckoutCard() {
  const { checkouts, update, complete } = useOnlineCheckouts()
  const { features } = useFeatures()
  const { user } = useAuth()
  const [stuck, setStuck] = useState<Record<string, string>>({})

  const waiting = checkouts.filter((x) => x.state === 'requested')
  const doneToday = checkouts.filter((x) => x.state === 'done' && x.doneAt?.startsWith(TODAY))
  if (!features.guestPortal || (waiting.length === 0 && doneToday.length === 0)) return null

  const by = user?.staffName ?? user?.name ?? 'Front desk'

  function finish(id: string) {
    const x = checkouts.find((y) => y.id === id)
    if (!x) return
    const why = complete(x, by, 'desk')
    if (why) {
      setStuck((m) => ({ ...m, [id]: why }))
    }
  }

  return (
    <Card
      icon="departure"
      title="Checking out online"
      count={waiting.length}
      description="Guests who checked out from their own page. Finish it with one click."
      padded
    >
      {waiting.length > 0 ? (
        <ul className="space-y-2">
          {waiting.map((x) => {
            const tomorrow = x.departure > TODAY
            return (
              <li key={x.id} className="rounded-xl border border-ink/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {x.guest} {x.room && <span className="font-normal text-ink/60">· Room {x.room}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/65">
                      {x.owed > 0 ? `${ugx(x.owed)} to ${x.chargeTo}` : 'Nothing to collect'} · {KEY_RETURN_LABEL[x.keys]}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {x.reservationId} · asked {x.at}
                    </p>
                  </div>
                  {tomorrow ? (
                    <Badge tone="neutral">Leaves {dayMonth(x.departure)}</Badge>
                  ) : (
                    <Button size="sm" onClick={() => finish(x.id)}>
                      Check out
                    </Button>
                  )}
                </div>
                {stuck[x.id] && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bad/[0.06] p-2.5">
                    <p className="text-xs text-bad">{stuck[x.id]}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update(x.id, { state: 'cancelled', note: 'Please stop at the desk to settle your bill.' })}
                    >
                      Settle at the desk
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink/60">Nobody waiting.</p>
      )}

      {doneToday.length > 0 && (
        <div className="mt-3 border-t border-ink/10 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Gone today</p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink/65">
            {doneToday.map((x) => (
              <li key={x.id}>
                {x.guest} {x.room ? `· Room ${x.room}` : ''} · {KEY_RETURN_LABEL[x.keys]} ·{' '}
                {x.doneVia === 'guest' ? 'by themselves' : `by ${x.doneBy}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-ink/55">
        Only stays with nothing owed, or a card or company to charge.
      </p>
    </Card>
  )
}
