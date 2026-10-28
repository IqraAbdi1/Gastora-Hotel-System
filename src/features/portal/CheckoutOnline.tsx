import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { folioOf, stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { checkoutFor, finishesItself, inCheckoutWindow, KEY_RETURN_LABEL, newCheckoutId } from '../../lib/onlineCheckout'
import type { KeyReturn } from '../../lib/onlineCheckout'
import type { Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import { useOnlineCheckouts } from './useOnlineCheckouts'

/**
 * "Check out online" on the guest's page, for a guest leaving today or tomorrow. Shows the final bill,
 * asks for it to be paid or covered first, asks where the key will be, and then either checks the
 * guest out at once or hands it to the desk. See onlineCheckout.ts for the rule.
 */
export default function CheckoutOnline({ stay, token, onPay }: { stay: Reservation; token: string; onPay: () => void }) {
  const { features, options } = useFeatures()
  const { checkouts, add, update, complete, checkOf } = useOnlineCheckouts()
  const [open, setOpen] = useState(false)
  const [keys, setKeys] = useState<KeyReturn | ''>('')
  const [problem, setProblem] = useState('')

  const mine = checkoutFor(checkouts, stay.id)

  if (mine?.state === 'done') {
    return (
      <section className="mt-5 rounded-xl border border-good/30 bg-good/[0.06] p-4">
        <p className="text-sm font-semibold text-good">You have checked out. Thank you.</p>
        <p className="mt-1 text-sm text-ink/75">
          {mine.owed > 0 ? `${ugx(mine.owed)} went to ${mine.chargeTo}. ` : 'There was nothing left to pay. '}
          {KEY_RETURN_LABEL[mine.keys]}. Your final bill has been sent to you.
        </p>
        <Link to={`/bill/${token}`} className="mt-2 inline-block text-sm font-semibold text-brand">
          See the final bill
        </Link>
      </section>
    )
  }

  if (stay.status !== 'in-house' || !inCheckoutWindow(stay, TODAY) || !features.guestPortal) return null

  if (mine?.state === 'requested') {
    return (
      <section className="mt-5 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          Your check-out is with the desk <Badge tone="warn" dot>Waiting</Badge>
        </p>
        <p className="mt-1 text-sm text-ink/75">
          {stay.departure > TODAY
            ? `They will check you out on the morning of ${dayMonth(stay.departure)}.`
            : 'They will finish it in a moment.'}{' '}
          {KEY_RETURN_LABEL[mine.keys]}.
        </p>
        {mine.note && <p className="mt-2 rounded-lg bg-bad/10 p-2.5 text-sm text-bad">{mine.note}</p>}
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-ink/60"
          onClick={() => update(mine.id, { state: 'cancelled' })}
        >
          I will check out at the desk instead
        </button>
      </section>
    )
  }

  const f = folioOf(stay)
  const check = checkOf(stay)
  const owed = check.express.guestOwed
  const self = finishesItself(stay, TODAY, features.expressCheckout, options.guestFinishesCheckout, check)
  const tomorrow = stay.departure > TODAY

  function go() {
    if (!keys) {
      setProblem('Say where you will leave the key.')
      return
    }
    if (!check.ok) return
    const record = {
      id: newCheckoutId(checkouts),
      at: stamp(),
      reservationId: stay.id,
      guest: stay.guest,
      room: stay.room ?? undefined,
      departure: stay.departure,
      keys,
      state: 'requested' as const,
      owed,
      chargeTo: owed > 0 ? check.express.chargeTo : 'nothing to collect',
    }
    if (self) {
      const why = complete(record, stay.guest, 'guest')
      add(why ? { ...record, note: why } : { ...record, state: 'done', doneVia: 'guest', doneBy: stay.guest, doneAt: stamp() })
    } else {
      add(record)
    }
  }

  if (!open) {
    return (
      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/[0.06] p-4">
        <div>
          <p className="text-sm font-semibold text-ink">{tomorrow ? 'Leaving tomorrow?' : 'Leaving today?'}</p>
          <p className="text-xs text-ink/65">Check out from here and skip the queue at the desk.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Check out online
        </Button>
      </section>
    )
  }

  const charges = (stay.charges ?? []).filter((c) => !c.reversedBy && !c.reverses)

  return (
    <section className="mt-5 rounded-xl border border-ink/10 bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Check out online</h2>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">1. Your final bill</p>
      <dl className="mt-1.5 space-y-1 text-sm">
        <Line k="Room" v={ugx(f.roomCharge)} />
        {charges.map((c) => (
          <Line key={c.id} k={c.description} v={ugx(c.amount)} />
        ))}
        <Line k="Total" v={ugx(f.total)} strong />
        <Line k="Paid" v={`− ${ugx(f.paid)}`} />
        <Line k="Left to pay" v={f.balance > 0 ? ugx(f.balance) : 'Nothing'} strong />
      </dl>
      {check.express.companyOwed > 0 && (
        <p className="mt-1 text-xs text-ink/60">{ugx(check.express.companyOwed)} goes to your company's account.</p>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/50">2. Paying it</p>
      {check.ok ? (
        <p className="mt-1.5 rounded-lg bg-good/[0.08] p-2.5 text-sm text-ink/80">
          {owed > 0 ? `${ugx(owed)} will be charged to ${check.express.chargeTo} when you check out.` : 'Nothing for you to pay.'}
        </p>
      ) : (
        <div className="mt-1.5 rounded-lg bg-warn/[0.1] p-2.5 text-sm text-ink/80">
          <p>{check.why}</p>
          {f.balance > 0 && (
            <div className="mt-2">
              <Button size="sm" onClick={onPay}>
                Pay {ugx(f.balance)} now
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/50">3. Your key</p>
      <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-ink/80">
        {(['room', 'desk'] as KeyReturn[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="radio"
              name="key-return"
              checked={keys === k}
              onChange={() => {
                setKeys(k)
                setProblem('')
              }}
            />
            {k === 'room' ? 'I will leave the key in the room' : 'I will leave the key at the desk'}
          </label>
        ))}
      </div>

      {problem && <p className="mt-2 text-sm font-medium text-bad">{problem}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button disabled={!check.ok} onClick={go}>
          {self ? 'Check out now' : tomorrow ? 'Check me out tomorrow morning' : 'Ask the desk to check me out'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink/55">
        {self
          ? 'You will be checked out straight away and your final bill sent to you.'
          : tomorrow
            ? `The desk checks you out on the morning of ${dayMonth(stay.departure)}. You keep the room until then.`
            : 'The desk will finish it and send your final bill.'}
      </p>
    </section>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-ink/10 pt-1 font-semibold text-ink' : 'text-ink/75'}`}>
      <dt className="min-w-0">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  )
}
