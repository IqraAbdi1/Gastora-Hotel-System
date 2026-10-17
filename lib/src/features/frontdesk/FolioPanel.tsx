import { useState } from 'react'
import StatusPill from '../../components/StatusPill'
import { TODAY } from '../../data/sample'
import { chargeCategories, folioOf, paymentMethods } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation } from '../../types'

type Props = { reservation: Reservation; onClose: () => void }

const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0

export default function FolioPanel({ reservation: r, onClose }: Props) {
  const { addCharge, addPayment, checkOut } = useHotel()
  const f = folioOf(r)
  const live = r.status === 'in-house'

  const [category, setCategory] = useState(chargeCategories[0])
  const [description, setDescription] = useState('')
  const [chargeText, setChargeText] = useState('')
  const [method, setMethod] = useState(paymentMethods[0])
  const [payText, setPayText] = useState('')
  const [reference, setReference] = useState('')
  const [authorise, setAuthorise] = useState(false)
  const [authReason, setAuthReason] = useState('')

  const chargeAmount = digits(chargeText)
  const chargeValid = chargeAmount > 0 && description.trim() !== ''
  const payAmount = digits(payText)
  const payValid = payAmount > 0 && payAmount <= f.balance
  const canOut = f.balance <= 0 || (authorise && authReason.trim().length >= 5)

  function postCharge() {
    addCharge(r.id, { category, description: description.trim(), amount: chargeAmount })
    setDescription('')
    setChargeText('')
  }

  function takePayment() {
    addPayment(r.id, { method, amount: payAmount, reference: reference.trim() || undefined })
    setPayText('')
    setReference('')
  }

  function confirmCheckOut() {
    checkOut(r.id, f.balance > 0 ? authReason.trim() : undefined)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Folio · {r.guest}</h2>
          <p className="text-sm text-ink/60">
            {r.id} · Room {r.room} · {dayMonth(r.arrival)} to {dayMonth(r.departure)}
          </p>
          <div className="mt-1">
            <StatusPill status={r.status} />
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <p className={heading}>Charges</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Room charges for the stay</dt>
              <dd className="font-medium">{ugx(f.roomCharge)}</dd>
            </div>
            {(r.charges ?? []).map((c) => (
              <div key={c.id} className="flex justify-between gap-4">
                <dt className="text-ink/60">
                  {c.category}: {c.description}
                  {c.sourceReference && <span className="block text-xs">Source: {c.sourceReference}</span>}
                  <span className="block text-xs">{c.at}</span>
                </dt>
                <dd className="font-medium">{ugx(c.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{ugx(f.total)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className={heading}>Payments</p>
          <dl className="mt-2 space-y-2 text-sm">
            {f.earlier > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">Deposit and earlier payments</dt>
                <dd className="font-medium">{ugx(f.earlier)}</dd>
              </div>
            )}
            {(r.payments ?? []).map((p) => (
              <div key={p.id} className="flex justify-between gap-4">
                <dt className="text-ink/60">
                  {p.method}
                  {p.reference ? ` · ${p.reference}` : ''}
                  <span className="block text-xs">{p.at}</span>
                </dt>
                <dd className="font-medium">{ugx(p.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
              <dt className="font-semibold">Paid</dt>
              <dd className="font-bold">{ugx(f.paid)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-between gap-4 rounded-lg bg-canvas p-3 text-sm">
          <span className="font-semibold">Balance</span>
          <span className={`font-bold ${f.balance > 0 ? 'text-bad' : 'text-good'}`}>{ugx(f.balance)}</span>
        </div>

        {live && (
          <>
            <div className="space-y-3">
              <p className={heading}>Add a charge</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
                    {chargeCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Amount (UGX)
                  <input
                    inputMode="numeric"
                    value={chargeText}
                    onChange={(e) => setChargeText(e.target.value)}
                    className={`${field} mt-1`}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Description
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="For example: dinner for two"
                  className={`${field} mt-1`}
                />
              </label>
              <button
                type="button"
                onClick={postCharge}
                disabled={!chargeValid}
                className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                Post charge
              </button>
            </div>

            <div className="space-y-3">
              <p className={heading}>Take a payment</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Method
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} mt-1`}>
                    {paymentMethods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Amount (UGX)
                  <input
                    inputMode="numeric"
                    value={payText}
                    onChange={(e) => setPayText(e.target.value)}
                    className={`${field} mt-1`}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Reference (optional)
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Mobile money transaction ID or card slip"
                  className={`${field} mt-1`}
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={takePayment}
                  disabled={!payValid}
                  className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Record payment
                </button>
                {f.balance > 0 && (
                  <button type="button" onClick={() => setPayText(String(f.balance))} className="text-sm font-semibold text-brand">
                    Pay full balance
                  </button>
                )}
              </div>
              {payAmount > f.balance && <p className="text-xs text-bad">That is more than the balance.</p>}
              <p className="text-xs text-ink/60">
                Payments are simulated here. In the real system a mobile money payment is recorded only after the provider confirms it.
              </p>
            </div>

            <div className="space-y-3 border-t border-ink/10 pt-4">
              <p className={heading}>Check out</p>
              {r.departure !== TODAY && (
                <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">
                  Departure is booked for {dayMonth(r.departure)}. If the guest is leaving on a different day, use Change stay first so the room charges are right.
                </p>
              )}
              {f.balance > 0 && (
                <>
                  <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">
                    The guest still owes {ugx(f.balance)}. Take the payment, or a manager can authorise check-out with a reason.
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={authorise} onChange={(e) => setAuthorise(e.target.checked)} className="mt-1" />
                    <span>Manager authorises check-out with the balance unpaid.</span>
                  </label>
                  {authorise && (
                    <label className="block text-sm font-medium">
                      Manager reason
                      <input
                        value={authReason}
                        onChange={(e) => setAuthReason(e.target.value)}
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
              <button
                type="button"
                onClick={confirmCheckOut}
                disabled={!canOut}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Check out and issue invoice
              </button>
            </div>
          </>
        )}

        {r.invoice && (
          <div className="rounded-lg border border-good/40 bg-good/10 p-3 text-sm">
            <p className="font-semibold text-good">Checked out {r.checkedOutAt}</p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">Invoice</dt>
                <dd className="font-medium">{r.invoice.number}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">Amount</dt>
                <dd className="font-medium">{ugx(r.invoice.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">Fiscal code</dt>
                <dd className="font-medium">{r.invoice.fiscalCode}</dd>
              </div>
            </dl>
            {r.unpaidAtCheckout && (
              <p className="mt-2 text-bad">
                Left with {ugx(r.unpaidAtCheckout)} unpaid. Reason: {r.checkoutNote}
              </p>
            )}
            <p className="mt-2 text-xs text-ink/60">
              This is a simulated invoice. In the real system the URA EFRIS system returns the fiscal code. Room {r.room} is now dirty and waiting for housekeeping.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}