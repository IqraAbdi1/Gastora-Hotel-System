import { useMemo, useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { REFUSAL_NOTE, expressCheck, expressState } from '../../lib/expressCheckout'
import { useAuth } from '../auth/authContext'
import { tokenFor } from '../../lib/preRegistration'
import { useCorporate } from '../corporate/corporateContext'
import { useMessages } from '../messages/messagesContext'
import { useFeatures } from '../platform/featuresContext'
import type { Reservation } from '../../types'

// The morning queue that does not happen. Everyone leaving today who asked to go straight out, with the
// check made again now rather than trusted from last night.
export default function ExpressCheckoutCard() {
  const { reservations, runExpress, cancelExpress } = useHotel()
  const { byId } = useCorporate()
  const { options, features } = useFeatures()
  const { queue } = useMessages()
  const { user } = useAuth()
  const [done, setDone] = useState<string[]>([])

  const accountNameOf = useMemo(
    () => (r: Reservation) => (r.corporate ? byId(r.corporate.accountId)?.name : undefined),
    [byId],
  )

  const agreed = reservations.filter((r) => r.status === 'in-house' && r.departure === TODAY && expressState(r) === 'agreed')
  const checked = agreed.map((r) => ({ r, check: expressCheck(r, accountNameOf(r), options.expressMax) }))
  const ready = checked.filter((x) => x.check.ok)
  const stuck = checked.filter((x) => !x.check.ok)

  if (!features.expressCheckout || agreed.length === 0) return null

  function go(r: Reservation, amount: number, chargeTo: string) {
    runExpress(r.id, amount, r.guarantee === 'card' ? 'Card' : 'Company account')
    queue({ kind: 'bill sent', reservationId: r.id, vars: { balance: ugx(amount), link: `${window.location.origin}/bill/${tokenFor(r.id, r.arrival)}` } })
    setDone((list) => [...list, `${r.guest} — ${amount > 0 ? `${ugx(amount)} to ${chargeTo}` : 'nothing to collect'}`])
  }

  return (
    <Card
      title="Leaving without stopping at the desk"
      description="Checked again now. What the hotel can charge may have changed since they agreed."
      icon="money"
      count={agreed.length}
      padded
    >
      {ready.length > 0 && (
        <>
          <ul className="space-y-2">
            {ready.map(({ r, check }) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-good/[0.07] p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {r.guest} <span className="font-normal text-ink/60">· Room {r.room}</span>
                  </p>
                  <p className="text-xs text-ink/65">
                    {check.guestOwed > 0 ? `${ugx(check.guestOwed)} to ${check.chargeTo}` : 'Nothing to collect'}
                    {check.companyOwed > 0 && ` · ${ugx(check.companyOwed)} to the company account`}
                  </p>
                </div>
                <Button size="sm" onClick={() => go(r, check.guestOwed, check.chargeTo)}>
                  Settle and check out
                </Button>
              </li>
            ))}
          </ul>
          {ready.length > 1 && (
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={() => {
                  for (const { r, check } of ready) go(r, check.guestOwed, check.chargeTo)
                }}
              >
                Settle all {ready.length}
              </Button>
            </div>
          )}
        </>
      )}

      {stuck.length > 0 && (
        <div className={ready.length > 0 ? 'mt-4' : ''}>
          <p className="text-sm font-semibold text-bad">These cannot go by themselves</p>
          <ul className="mt-2 space-y-2">
            {stuck.map(({ r, check }) => (
              <li key={r.id} className="rounded-xl bg-bad/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {r.guest} <span className="font-normal text-ink/60">· Room {r.room}</span>
                    </p>
                    <p className="text-xs text-ink/70">{check.why && REFUSAL_NOTE[check.why]}</p>
                    {check.guestOwed > 0 && <p className="text-xs text-ink/60">{ugx(check.guestOwed)} owed by the guest.</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => cancelExpress(r.id)}>
                    Settle at the desk
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-4 rounded-xl bg-ink/[0.04] p-3">
          <p className="text-xs font-semibold text-ink/70">Gone, by {user?.staffName ?? user?.name ?? 'the front desk'}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink/65">
            {done.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-ink/55">
        The money is taken first and the guest is checked out second, so a card that fails never lets anybody leave unpaid.
      </p>
      <div className="mt-2">
        <Badge tone="neutral">
          Ceiling {options.expressMax > 0 ? ugx(options.expressMax) : 'none'}
        </Badge>
      </div>
    </Card>
  )
}
