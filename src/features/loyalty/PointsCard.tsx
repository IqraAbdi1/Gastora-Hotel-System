import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { stamp } from '../../lib/folio'
import { dayMonthYear, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { accountOf, expired, newVoucherId, voucherProblem, voucherWorth } from '../../lib/points'
import type { Guest } from '../../types'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useVouchers } from './usePoints'

/**
 * What the hotel owes this guest.
 *
 * The balance is never stored. It is worked out from the stays that earned it every time this is
 * opened, so a guest who argues about their points can be shown the stays rather than a number.
 */
export default function PointsCard({ guest }: { guest: Guest }) {
  const { reservations } = useHotel()
  const { options } = useFeatures()
  const { vouchers, issue, update } = useVouchers()
  const { user } = useAuth()
  const [spend, setSpend] = useState('')

  const settings = options.points
  const account = useMemo(() => accountOf(guest, reservations, vouchers, settings), [guest, reservations, vouchers, settings])
  const theirs = vouchers.filter((v) => v.guestId === guest.id)

  if (!settings.on) return null

  const points = Number(spend.replace(/\D/g, '')) || 0
  const why = voucherProblem(account, points, settings, TODAY)
  const gone = expired(account, TODAY)

  function make() {
    issue({
      id: newVoucherId(vouchers),
      guestId: guest.id,
      guestName: guest.name,
      points,
      amount: voucherWorth(points, settings),
      issuedAt: stamp(),
      issuedBy: user?.name ?? 'Front desk',
      state: 'open',
    })
    setSpend('')
  }

  return (
    <Card
      title="Points"
      icon="money"
      padded
      description={`${settings.perThousand} point for every 1,000 on the room. One point is worth ${ugx(settings.worth)}.`}
    >
      {guest.loyaltyConsent !== true ? (
        <p className="text-sm text-ink/70">
          Not opted in, so nothing is earned.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Earned', value: String(account.earned), hint: 'On finished stays' },
              { label: 'Spent', value: String(account.spent), hint: `${theirs.length} voucher${theirs.length === 1 ? '' : 's'}` },
              { label: 'Left', value: String(account.balance), hint: `Worth ${ugx(account.worth)}` },
            ].map((cell) => (
              <div key={cell.label} className="rounded-xl bg-linear-to-br from-brand/[0.06] to-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{cell.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{cell.value}</p>
                <p className="text-xs text-ink/55">{cell.hint}</p>
              </div>
            ))}
          </div>

          {account.expiring && (
            <p className={`mt-2 text-sm ${gone ? 'text-bad' : 'text-ink/65'}`}>
              {gone
                ? `These expired on ${dayMonthYear(account.expiring.on)}.`
                : `They expire on ${dayMonthYear(account.expiring.on)} unless the guest returns.`}
            </p>
          )}

          {account.balance >= settings.leastToSpend && !gone && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-40">
                <Field label="Turn into a voucher" hint={`At least ${settings.leastToSpend}`}>
                  {(id) => (
                    <Input id={id} inputMode="numeric" className="tabular-nums" value={spend} onChange={(e) => setSpend(e.target.value)} />
                  )}
                </Field>
              </div>
              <Button size="sm" disabled={!!why} onClick={make}>
                {points > 0 ? `Make a ${ugx(voucherWorth(points, settings))} voucher` : 'Make a voucher'}
              </Button>
              {why && points > 0 && <span className="pb-2 text-xs text-bad">{why}</span>}
            </div>
          )}

          {theirs.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {theirs.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2">
                  <span>
                    <span className="font-mono text-xs text-ink/55">{v.id}</span>
                    <span className="ml-2 font-semibold tabular-nums text-ink">{ugx(v.amount)}</span>
                    <span className="ml-2 text-xs text-ink/55">
                      {v.points} points · {v.issuedBy}, {v.issuedAt}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={v.state === 'open' ? 'good' : v.state === 'spent' ? 'neutral' : 'bad'} dot={v.state === 'open'}>
                      {v.state === 'open' ? 'Not used' : v.state}
                    </Badge>
                    {v.state === 'open' && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand"
                        onClick={() => update(v.id, { state: 'spent', usedAt: stamp() })}
                      >
                        Mark used
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-ink/55">
            Earned on the room for finished stays. Use vouchers on the folio.
          </p>
        </>
      )}
    </Card>
  )
}
