import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Field, Input, Modal, Segmented } from '../../components/ui'
import { PAY_FAILED, PAY_METHODS, PAY_PROMPT } from '../../lib/bookingEngine'
import type { PayMethod, PayState } from '../../lib/bookingEngine'
import { stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import {
  fakeProviderRef,
  isMobileMoney,
  maskPhone,
  payProblem,
  postedAsFor,
  receiptNumber,
} from '../../lib/portalPay'
import type { GuestPayment } from '../../lib/portalPay'
import type { Reservation } from '../../types'
import { usePortalPayments } from './usePortalPayments'

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0

/**
 * "Pay now" on the guest's page. The payment is simulated the same way the booking page simulates a
 * deposit: the provider takes a moment and nothing is recorded until it says yes. Add ?fail=1 to the
 * address to see a refusal.
 */
export default function PayNow({ stay, balance, onClose }: { stay: Reservation; balance: number; onClose: () => void }) {
  const { addGuestPayment } = useHotel()
  const { payments, add } = usePortalPayments()
  const [params] = useSearchParams()
  const [method, setMethod] = useState<PayMethod>('MTN MoMo')
  const [amountText, setAmountText] = useState(String(balance))
  const [phone, setPhone] = useState(stay.details?.phone ?? '')
  const [card, setCard] = useState('')
  const [pay, setPay] = useState<PayState>('idle')
  const [tried, setTried] = useState(false)
  const [receipt, setReceipt] = useState<GuestPayment | null>(null)

  const amount = digits(amountText)
  const problem = payProblem({ method, amount, phone, card }, balance)

  function send() {
    setTried(true)
    if (problem) return
    setPay('pending')
    // The provider takes a moment, and may say no. Nothing is recorded until it answers.
    window.setTimeout(() => {
      if (params.get('fail') === '1') {
        setPay('failed')
        return
      }
      const id = receiptNumber(payments)
      const ref = fakeProviderRef(method, `${id}${stay.id}${amount}`)
      const from = isMobileMoney(method) ? maskPhone(phone) : `Card ending ${card.replace(/\D/g, '').slice(-4)}`
      addGuestPayment(stay.id, { method, amount, reference: `Guest page ${id} · ${ref}` })
      const made: GuestPayment = {
        id,
        at: stamp(),
        reservationId: stay.id,
        guest: stay.guest,
        amount,
        method,
        from,
        providerRef: ref,
        postedAs: postedAsFor(stay),
        balanceBefore: balance,
        balanceAfter: balance - amount,
      }
      add(made)
      setReceipt(made)
      setPay('paid')
    }, 1600)
  }

  if (receipt) {
    return (
      <Modal title="Payment received" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <Receipt p={receipt} />
      </Modal>
    )
  }

  return (
    <Modal
      title="Pay your bill"
      description={`You owe ${ugx(balance)}. Pay all of it or part of it.`}
      onClose={() => pay !== 'pending' && onClose()}
    >
      <div className="space-y-4">
        <Segmented
          label="Pay with"
          value={method}
          onChange={(m) => {
            setMethod(m)
            setPay('idle')
          }}
          options={PAY_METHODS.map((m) => ({ key: m, label: m === 'MTN MoMo' ? 'MTN' : m === 'Airtel Money' ? 'Airtel' : 'Card' }))}
        />

        <Field label="Amount (UGX)" hint={amount < balance && amount > 0 ? `${ugx(balance - amount)} will still be owed.` : 'The whole balance.'}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              className="tabular-nums"
              value={amountText}
              disabled={pay === 'pending'}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, ''))}
            />
          )}
        </Field>

        {isMobileMoney(method) ? (
          <Field label={`${method} number`} hint="You approve the payment on this phone.">
            {(id) => (
              <Input
                id={id}
                inputMode="tel"
                value={phone}
                disabled={pay === 'pending'}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={method === 'MTN MoMo' ? '0772 123 456' : '0752 123 456'}
              />
            )}
          </Field>
        ) : (
          <Field label="Card number" hint="Only the last four digits are kept.">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-number"
                value={card}
                disabled={pay === 'pending'}
                onChange={(e) => setCard(e.target.value)}
                placeholder="4242 4242 4242 4242"
              />
            )}
          </Field>
        )}

        {tried && problem && pay !== 'pending' && <p className="text-sm font-medium text-bad">{problem}</p>}
        {pay === 'pending' && <p className="rounded-lg bg-warn/[0.1] p-3 text-sm text-ink/80">{PAY_PROMPT[method]}</p>}
        {pay === 'failed' && <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{PAY_FAILED[method]}</p>}

        <div className="flex flex-wrap gap-2">
          <Button disabled={pay === 'pending'} onClick={send}>
            {pay === 'pending' ? 'Waiting…' : pay === 'failed' ? 'Try again' : `Pay ${ugx(amount)}`}
          </Button>
          <Button variant="ghost" disabled={pay === 'pending'} onClick={onClose}>
            Not now
          </Button>
        </div>

        <p className="text-xs text-ink/50">
          <Badge tone="neutral">Simulated</Badge> No money moves in this demo.
        </p>
      </div>
    </Modal>
  )
}

/** The guest's copy of a payment. */
export function Receipt({ p }: { p: GuestPayment }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-good/[0.1] p-4">
        <p className="text-sm font-semibold text-good">Thank you. {ugx(p.amount)} received.</p>
        <p className="mt-1 text-xs text-ink/70">
          {p.postedAs === 'folio'
            ? 'It is on your bill now, and the front desk can see it.'
            : 'It is recorded against your booking and will be on your bill when you check in.'}
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        <Row k="Receipt" v={p.id} mono />
        <Row k="Date" v={`${dayMonth(p.at.slice(0, 10))}, ${p.at.slice(11)}`} />
        <Row k="Booking" v={p.reservationId} mono />
        <Row k="Guest" v={p.guest} />
        <Row k="Paid with" v={`${p.method} · ${p.from}`} />
        <Row k="Provider reference" v={p.providerRef} mono />
        <Row k="Owed before" v={ugx(p.balanceBefore)} />
        <Row k="Paid" v={ugx(p.amount)} strong />
        <Row k="Still owed" v={p.balanceAfter > 0 ? ugx(p.balanceAfter) : 'Nothing'} />
      </dl>
      <p className="text-xs text-ink/50">Simulated payment. The reference is made up.</p>
    </div>
  )
}

function Row({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/60">{k}</dt>
      <dd className={`text-right tabular-nums ${mono ? 'font-mono text-xs' : ''} ${strong ? 'font-bold' : 'font-medium'}`}>{v}</dd>
    </div>
  )
}
