import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Field, Input } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { BILL_TO_LABEL, canChangePricing, canSetCredit, creditPosition, needsLpo, offersCredit, STATUS_LABEL, STEP_LABEL, stampNow } from '../../lib/corporate'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { CorporateBooking, Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { parseAmount, statusTone } from '../corporate/corporateUi'

function Item({ title, tone, label, children }: { title: string; tone: Tone; label: string; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-ink/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {children && <div className="mt-1.5 space-y-2 text-sm text-ink/75">{children}</div>}
    </li>
  )
}

// What is known about the company side of a stay. Confirming it happens at check-in, with the guest there.
// Here staff can see the status, record an LPO that has arrived early, and give the decisions that belong to other roles.
export default function CompanyChecks({ r }: { r: Reservation }) {
  const c = r.corporate as CorporateBooking
  const { byId, policy } = useCorporate()
  const { reservations, setCorporate } = useHotel()
  const { user, role } = useAuth()
  const account = byId(c.accountId)
  const staff = user?.name ?? 'Front desk'
  const roleId = role?.id
  const open = r.status === 'booked' || r.status === 'in-house'
  const lpoNeeded = account ? needsLpo(account, policy) : false
  const credit = account ? creditPosition(account, reservations, r.id) : null
  const overBy = account && credit && offersCredit(account.paymentTerms) ? Math.max(0, r.total - credit.available) : 0
  const overApproved = !!c.billing.overCreditApprovedBy
  const canApproveCredit = !!roleId && canSetCredit(roleId, policy)
  const canApprovePrice = !!roleId && canChangePricing(roleId)
  const p = c.pricing

  const [lpoForm, setLpoForm] = useState(false)
  const [lpoNumber, setLpoNumber] = useState(c.billing.claimedLpo ?? '')
  const [lpoAmount, setLpoAmount] = useState('')
  const [lpoDate, setLpoDate] = useState(TODAY)
  const [overReason, setOverReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function saveLpo() {
    const amount = parseAmount(lpoAmount)
    if (!lpoNumber.trim()) return setError('Enter the LPO number exactly as it is on the document.')
    if (!amount) return setError('Enter the amount the LPO covers.')
    if (amount < Math.round(r.total)) return setError(`This LPO covers ${ugx(amount)} but the stay is ${ugx(r.total)}.`)
    if (!lpoDate || lpoDate > TODAY) return setError('Choose a date received, not in the future.')
    const now = stampNow()
    setCorporate(r.id, {
      ...c,
      billing: { ...c.billing, lpo: { number: lpoNumber.trim(), amount, receivedOn: lpoDate, recordedBy: staff, recordedAt: now } },
      log: [...c.log, { at: now, by: staff, action: `LPO ${lpoNumber.trim()} received (${ugx(amount)}, dated ${lpoDate})` }],
    })
    setLpoForm(false)
    setError(null)
  }

  function approveOverCredit() {
    if (!overReason.trim()) return setError('Give the reason for going over the credit limit.')
    const now = stampNow()
    setCorporate(r.id, {
      ...c,
      billing: { ...c.billing, overCreditApprovedBy: staff, overCreditReason: overReason.trim(), by: staff, at: now },
      log: [...c.log, { at: now, by: staff, action: `Over credit by ${ugx(overBy)} approved: ${overReason.trim()}` }],
    })
    setOverReason('')
    setError(null)
  }

  function decidePrice(approve: boolean) {
    if (!p) return
    const now = stampNow()
    setCorporate(
      r.id,
      {
        ...c,
        pricing: { ...p, status: approve ? 'approved' : 'declined', decidedBy: staff, at: now },
        log: [...c.log, { at: now, by: staff, action: approve ? `Company price approved: ${p.labels.join(' + ')}` : 'Company price declined' }],
      },
      approve ? { total: r.total - p.originalTotal + p.finalTotal } : {},
    )
  }

  const lpo = c.billing.lpo
  const bookerOk = c.booker.status === 'verified'
  const billOk = c.billing.status === 'approved'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{c.accountName}</p>
          <p className="text-xs text-ink/60">{BILL_TO_LABEL[c.billTo]}</p>
        </div>
        {account && (
          <Badge tone={statusTone[account.status]} dot>
            {STATUS_LABEL[account.status]}
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        <Item title="The guest works for the company" tone={bookerOk ? 'good' : 'warn'} label={bookerOk ? 'Confirmed' : 'At check-in'}>
          {bookerOk ? (
            <p>
              {c.booker.name}
              {c.booker.reference && ` · ${c.booker.reference}`}
              {c.booker.by && <span className="block text-xs text-ink/55">Confirmed by {c.booker.by}, {c.booker.at}</span>}
            </p>
          ) : (
            <p>Booked by {c.booker.name}. Confirmed with the guest at check-in.</p>
          )}
        </Item>

        {(lpoNeeded || lpo || c.billing.claimedLpo) && (
          <Item
            title="Purchase order (LPO)"
            tone={lpo ? 'good' : lpoNeeded ? 'warn' : 'neutral'}
            label={lpo ? 'Received' : lpoNeeded ? 'Not received' : 'Optional'}
          >
            {lpo ? (
              <p>
                LPO {lpo.number} covers {ugx(lpo.amount)}, received {dayMonth(lpo.receivedOn)}.
                <span className="block text-xs text-ink/55">Recorded by {lpo.recordedBy}, {lpo.recordedAt}</span>
              </p>
            ) : c.billing.claimedLpo ? (
              <p>Given at booking: {c.billing.claimedLpo}. Not received yet.</p>
            ) : (
              <p>The company needs to send one before the guest arrives.</p>
            )}
            {open && !lpo && !lpoForm && (
              <Button size="sm" variant="secondary" onClick={() => setLpoForm(true)}>
                Record LPO received
              </Button>
            )}
            {lpoForm && (
              <div className="space-y-2 rounded-lg bg-canvas p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="LPO number" required>
                    {(id) => <Input id={id} value={lpoNumber} onChange={(e) => setLpoNumber(e.target.value)} />}
                  </Field>
                  <Field label="Amount covered (UGX)" required hint={`Stay: ${ugx(r.total)}`}>
                    {(id) => <Input id={id} inputMode="numeric" value={lpoAmount} onChange={(e) => setLpoAmount(e.target.value)} />}
                  </Field>
                  <Field label="Received on" required>
                    {(id) => <Input id={id} type="date" max={TODAY} value={lpoDate} onChange={(e) => setLpoDate(e.target.value)} />}
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveLpo}>
                    Save LPO
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLpoForm(false)}>
                    Cancel
                  </Button>
                </div>
                {error && <p className="text-sm font-medium text-bad">{error}</p>}
              </div>
            )}
          </Item>
        )}

        <Item title="Charges approved by the company" tone={billOk ? 'good' : 'warn'} label={billOk ? 'Approved' : 'At check-in'}>
          {billOk ? (
            <p>
              {c.billing.approverName}
              {c.billing.by && <span className="block text-xs text-ink/55">Recorded by {c.billing.by}, {c.billing.at}</span>}
            </p>
          ) : (
            <p>A company contact who can approve charges confirms this at check-in.</p>
          )}
        </Item>

        {account && offersCredit(account.paymentTerms) && (
          <Item
            title="Within the company's credit"
            tone={overBy > 0 && !overApproved ? 'bad' : 'good'}
            label={overBy > 0 ? (overApproved ? 'Approved over limit' : `Over by ${ugx(overBy)}`) : 'Within limit'}
          >
            {overBy > 0 && (
              <p>
                This stay is {ugx(overBy)} more than the company has available.
                {overApproved && (
                  <span className="block text-xs text-ink/55">
                    Approved by {c.billing.overCreditApprovedBy}: {c.billing.overCreditReason}
                  </span>
                )}
              </p>
            )}
            {overBy > 0 && !overApproved && open &&
              (canApproveCredit ? (
                <div className="space-y-2 rounded-lg bg-canvas p-3">
                  <Field label="Reason for going over the limit" required>
                    {(id) => <Input id={id} value={overReason} onChange={(e) => setOverReason(e.target.value)} />}
                  </Field>
                  <Button size="sm" onClick={approveOverCredit}>
                    Approve over the limit
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-ink/60">{STEP_LABEL[policy.creditApprover]} must approve this before check-in.</p>
              ))}
          </Item>
        )}

        {p && (
          <Item
            title="Company price"
            tone={p.status === 'pending' ? 'warn' : p.status === 'declined' ? 'neutral' : 'good'}
            label={p.status === 'pending' ? 'Needs a manager' : p.status === 'declined' ? 'Declined' : 'Applied'}
          >
            <p>
              {p.labels.join(' + ')} · {ugx(p.perNightFinal)} instead of {ugx(p.perNightOriginal)} per night.
              {p.status === 'pending' && ' The normal price is charged until a manager approves it.'}
            </p>
            {open && p.status === 'pending' &&
              (canApprovePrice ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decidePrice(true)}>
                    Approve price
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decidePrice(false)}>
                    Decline
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-ink/60">Only a manager can approve this price.</p>
              ))}
          </Item>
        )}
      </ul>

      {error && !lpoForm && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      <p className="text-xs text-ink/55">Check-in confirms the guest, the LPO and the approver with the guest in front of you.</p>

      <details className="text-xs text-ink/60">
        <summary className="cursor-pointer font-semibold">Company history ({c.log.length})</summary>
        <ol className="mt-2 space-y-1">
          {[...c.log].reverse().map((l, i) => (
            <li key={i}>
              {l.at} · {l.by}: {l.action}
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
