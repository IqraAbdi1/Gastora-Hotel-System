import { useMemo, useState } from 'react'
import { cancelReasons, checkCancel } from '../../lib/cancel'
import type { CancelMode } from '../../lib/cancel'
import { dayMonth, ugx } from '../../lib/format'
import { useFeatures } from '../platform/featuresContext'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation } from '../../types'

type Props = { reservation: Reservation; mode: CancelMode; onClose: () => void; onDone: () => void }

const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'

export default function CancelPanel({ reservation: r, mode, onClose, onDone }: Props) {
  const { cancelReservation } = useHotel()
  const isNoShow = mode === 'no-show'

  const [reason, setReason] = useState(cancelReasons[0])
  const [waive, setWaive] = useState(false)
  const [managerReason, setManagerReason] = useState('')
  const [done, setDone] = useState(false)

  const { options } = useFeatures()
  const rates = options.rates
  const check = useMemo(() => checkCancel(r, mode, waive, rates), [r, mode, waive, rates])
  const managerOk = !waive || managerReason.trim().length >= 5
  const valid = !check.error && managerOk

  function confirm() {
    const why = isNoShow ? 'Guest did not arrive' : waive ? `${reason}. Manager: ${managerReason.trim()}` : reason
    cancelReservation(
      r.id,
      { status: isNoShow ? 'no-show' : 'cancelled', total: check.charge, paid: r.paid - check.refund },
      {
        kind: isNoShow ? 'no-show' : 'cancelled',
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        reason: why,
        charge: check.charge,
        refund: check.refund,
        owed: check.owed,
        waived: waive && check.chargeApplies,
      },
    )
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">{isNoShow ? 'Mark no-show' : 'Cancel booking'}</h2>
          <p className="text-sm text-ink/60">
            {r.guest} · {r.id} · {dayMonth(r.arrival)} to {dayMonth(r.departure)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      {done ? (
        <div className="flex-1 space-y-4 p-4">
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            {isNoShow ? 'Marked as no-show.' : 'Booking cancelled.'} The room is back on sale.
            {check.refund > 0 && ` Refund of ${ugx(check.refund)} recorded (simulated).`}
            {check.owed > 0 && ` The guest still owes ${ugx(check.owed)}.`}
          </p>
          <button type="button" onClick={onDone} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {check.error ? (
              <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">{check.error}</p>
            ) : (
              <>
                {!isNoShow && (
                  <label className="block text-sm font-medium">
                    Reason
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1`}>
                      {cancelReasons.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                )}

                <dl className="space-y-2 text-sm">
                  {[
                    ['Total of the stay', ugx(r.total)],
                    ['Paid so far', ugx(r.paid)],
                    [isNoShow ? 'No-show charge' : 'Cancellation charge', check.chargeApplies ? (waive ? `${ugx(check.fullCharge)} waived` : ugx(check.charge)) : 'None'],
                    ['Refund to the guest', ugx(check.refund)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-ink/60">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                  {check.owed > 0 && (
                    <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                      <dt className="font-semibold">Still owed</dt>
                      <dd className="font-bold text-bad">{ugx(check.owed)}</dd>
                    </div>
                  )}
                </dl>

                {check.chargeApplies && !isNoShow && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="mt-1" />
                    <span>Manager waives the charge (needs a reason).</span>
                  </label>
                )}
                {waive && (
                  <label className="block text-sm font-medium">
                    Manager reason
                    <input
                      value={managerReason}
                      onChange={(e) => setManagerReason(e.target.value)}
                      placeholder="At least 5 characters"
                      className={`${field} mt-1`}
                    />
                    <span className="mt-1 block text-xs font-normal text-ink/60">
                      Manager approval is simulated here. The real system asks a manager to approve and logs who did.
                    </span>
                  </label>
                )}

                <p className="text-xs text-ink/60">
                  {isNoShow
                    ? 'Sample policy: the no-show charge follows the booking guarantee. Deposit kept, one night for card or company, nothing if there was no guarantee. In the real system this is allowed after the hotel release time (18:00 for bookings with no guarantee).'
                    : 'Sample policy: free to cancel 2 or more days before arrival. Closer than that, one night is kept from what the guest paid and the rest is refunded. Refunds are simulated here. Real mobile money refunds go through the payment provider.'}
                </p>
              </>
            )}
          </div>

          <div className="border-t border-ink/10 p-4">
            <button
              type="button"
              onClick={confirm}
              disabled={!valid}
              className="w-full rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isNoShow ? 'Confirm no-show' : 'Confirm cancellation'}
            </button>
          </div>
        </>
      )}
    </div>
    </div>
  )
}
