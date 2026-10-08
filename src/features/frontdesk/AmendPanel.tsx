import { useMemo, useState } from 'react'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { checkAmend, FEE_WINDOW_DAYS, reasons } from '../../lib/amend'
import { nightsOf } from '../../lib/booking'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation } from '../../types'

type Props = { reservation: Reservation; onClose: () => void; onDone: () => void }

const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

export default function AmendPanel({ reservation: r, onClose, onDone }: Props) {
  const { rooms, reservations, amendReservation } = useHotel()
  const inHouse = r.status === 'in-house'

  const [arrival, setArrival] = useState(r.arrival)
  const [departure, setDeparture] = useState(r.departure)
  const [reason, setReason] = useState(reasons[0])
  const [waive, setWaive] = useState(false)
  const [override, setOverride] = useState(false)
  const [managerReason, setManagerReason] = useState('')
  const [done, setDone] = useState(false)

  const check = useMemo(
    () => checkAmend(r, arrival, departure, rooms, reservations),
    [r, arrival, departure, rooms, reservations],
  )

  const feeCharged = check.feeApplies && !waive ? check.fee : 0
  const newTotal = check.newTotal + feeCharged
  const needsManager = (check.feeApplies && waive) || (check.needsOverride && override)
  const managerOk = !needsManager || managerReason.trim().length >= 5
  const valid =
    !check.error && !check.blockedByRoom && (!check.needsOverride || override) && managerOk

  // Postpone: move both dates, keep the length of stay
  function shift(days: number) {
    const len = nightsOf(r.arrival, r.departure)
    const a = addDays(r.arrival, days)
    setArrival(a)
    setDeparture(addDays(a, len))
  }

  function confirm() {
    const why = needsManager ? `${reason}. Manager: ${managerReason.trim()}` : reason
    amendReservation(
      r.id,
      { arrival, departure, total: newTotal, room: check.roomLost ? null : r.room },
      {
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        fromArrival: r.arrival,
        fromDeparture: r.departure,
        toArrival: arrival,
        toDeparture: departure,
        reason: why,
        fee: feeCharged,
        waived: check.feeApplies && waive,
      },
    )
    setDone(true)
  }

  const balanceAfter = newTotal - r.paid

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Change stay</h2>
          <p className="text-sm text-ink/60">
            {r.guest} · {r.id} · {r.roomType}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      {done ? (
        <div className="flex-1 space-y-4 p-4">
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            Stay changed to {dayMonth(arrival)} to {dayMonth(departure)}. The change is logged on the booking.
            {check.roomLost && ' Room was released and will be assigned at check-in.'}
          </p>
          <button type="button" onClick={onDone} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {!inHouse && (
              <div>
                <p className={`${heading} mb-1`}>Postpone</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Tomorrow', 1],
                    ['+2 days', 2],
                    ['+1 week', 7],
                  ].map(([label, d]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => shift(Number(d))}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold hover:border-brand"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Arrival
                <input
                  type="date"
                  value={arrival}
                  min={TODAY}
                  disabled={inHouse}
                  onChange={(e) => setArrival(e.target.value)}
                  className={`${field} mt-1 disabled:opacity-50`}
                />
              </label>
              <label className="block text-sm font-medium">
                Departure
                <input
                  type="date"
                  value={departure}
                  min={addDays(inHouse ? TODAY : arrival, 1)}
                  onChange={(e) => setDeparture(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
            </div>
            {inHouse && <p className="text-xs text-ink/60">The guest is in the house, so only the departure can change (extend or shorten).</p>}

            <label className="block text-sm font-medium">
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1`}>
                {reasons.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            {check.error ? (
              <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">{check.error}</p>
            ) : (
              <>
                <p className={heading}>What changes</p>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Was', `${dayMonth(r.arrival)} to ${dayMonth(r.departure)}`],
                    ['Now', `${dayMonth(arrival)} to ${dayMonth(departure)} (${check.nights} night${check.nights === 1 ? '' : 's'})`],
                    ['Nightly rate kept', ugx(check.perNight)],
                    ['Change fee', check.feeApplies ? (waive ? `${ugx(check.fee)} waived` : ugx(check.fee)) : 'None'],
                    ['New total', ugx(newTotal)],
                    ['Paid', ugx(r.paid)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-ink/60">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                    <dt className="font-semibold">Balance after</dt>
                    <dd className={`font-bold ${balanceAfter > 0 ? 'text-bad' : 'text-good'}`}>{ugx(balanceAfter)}</dd>
                  </div>
                </dl>

                {check.blockedByRoom && (
                  <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">
                    Room {r.room} is booked by another guest on those nights, so the stay cannot be extended in this room.
                  </p>
                )}
                {check.roomLost && (
                  <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">
                    Room {r.room} is taken on the new dates. It will be released and a room assigned at check-in.
                  </p>
                )}
                {!inHouse && (
                  <p className={`text-sm ${check.typeFree < 1 ? 'text-warn' : 'text-good'}`}>
                    {check.typeFree < 1
                      ? `No ${r.roomType} room is free on the new dates.`
                      : `${check.typeFree} ${r.roomType} room${check.typeFree === 1 ? '' : 's'} free on the new dates.`}
                  </p>
                )}

                {check.feeApplies && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="mt-1" />
                    <span>Manager waives the one-night fee (needs a reason).</span>
                  </label>
                )}
                {check.needsOverride && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-1" />
                    <span>Manager override: overbook this room type (needs a reason).</span>
                  </label>
                )}
                {needsManager && (
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
              </>
            )}

            <p className="text-xs text-ink/60">
              Sample policy: free to change {FEE_WINDOW_DAYS} or more days before arrival. Closer than that, moving or shortening a booking costs one night. Extending is always free. The nightly rate and the deposit stay with the booking.
            </p>
          </div>

          <div className="border-t border-ink/10 p-4">
            <button
              type="button"
              onClick={confirm}
              disabled={!valid}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm change
            </button>
          </div>
        </>
      )}
    </div>
  )
}