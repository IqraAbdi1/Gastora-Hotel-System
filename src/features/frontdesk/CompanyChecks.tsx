import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Field, Input, Select } from '../../components/ui'
import type { Tone } from '../../components/ui'
import {
  BILL_TO_LABEL,
  bookingChecks,
  canChangePricing,
  canSetCredit,
  creditPosition,
  offersCredit,
  STATUS_LABEL,
  STEP_LABEL,
  stampNow,
} from '../../lib/corporate'
import type { CheckState } from '../../lib/corporate'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { BillingCheckMethod, BookerCheckMethod, CorporateBooking, Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'

const STATE: Record<CheckState, { label: string; tone: Tone }> = {
  ok: { label: 'Done', tone: 'good' },
  pending: { label: 'To do', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
  'not-required': { label: 'Not needed', tone: 'neutral' },
}

const BOOKER_METHOD: Record<BookerCheckMethod, string> = {
  'authorised-list': "On the company's authorised list",
  callback: 'Called the company on its known number',
  'written-authorisation': 'Written authorisation from a company approver',
}

const BILLING_METHOD: Record<BillingCheckMethod, string> = {
  email: 'Approval email',
  'signed-form': 'Signed authorisation form',
  'purchase-order': 'Purchase order (LPO)',
  'phone-callback': 'Phone call to the approver',
}

function Check({ n, title, state, children }: { n: number; title: string; state: CheckState; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-ink/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          <span className="text-ink/45">{n}.</span> {title}
        </p>
        <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
      </div>
      {children && <div className="mt-1.5 space-y-2 text-sm text-ink/75">{children}</div>}
    </li>
  )
}

// The company side of a booking, as four separate checks plus the agreed price.
// Each check records who did it and how, so it can be traced later.
export default function CompanyChecks({ r }: { r: Reservation }) {
  const c = r.corporate as CorporateBooking
  const { byId, policy } = useCorporate()
  const { reservations, setCorporate } = useHotel()
  const { user, role } = useAuth()
  const account = byId(c.accountId)
  const checks = bookingChecks(r, account)
  const open = r.status === 'booked' || r.status === 'in-house'
  const staff = user?.name ?? 'Front desk'
  const roleId = role?.id

  const [form, setForm] = useState<'booker' | 'billing' | null>(null)
  const [method, setMethod] = useState<string>('')
  const [reference, setReference] = useState('')
  const [approverId, setApproverId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function save(next: CorporateBooking, action: string, patch: Partial<Pick<Reservation, 'total' | 'guarantee'>> = {}) {
    setCorporate(r.id, { ...next, log: [...c.log, { at: stampNow(), by: staff, action }] }, patch)
    setForm(null)
    setMethod('')
    setReference('')
    setApproverId('')
    setReason('')
    setError(null)
  }

  // ---- Booker ----
  function verifyBooker() {
    if (!method) return setError('Choose how the booker was verified.')
    if (!reference.trim()) return setError('Record a reference: who you spoke to, or the document number.')
    save(
      { ...c, booker: { ...c.booker, status: 'verified', method: method as BookerCheckMethod, reference: reference.trim(), by: staff, at: stampNow() } },
      `Booker verified: ${BOOKER_METHOD[method as BookerCheckMethod]} (${reference.trim()})`,
    )
  }
  function failBooker() {
    save(
      {
        ...c,
        booker: { ...c.booker, status: 'failed', by: staff, at: stampNow() },
        billTo: 'guest',
        billing: { status: 'declined', by: staff, at: stampNow(), note: 'Booker could not be verified' },
      },
      'Booker could not be verified. Billing moved to the guest.',
      { guarantee: r.guarantee === 'company' ? 'none' : r.guarantee },
    )
  }

  // ---- Billing ----
  const approvers = account?.contacts.filter((x) => x.active && x.canApproveCharges) ?? []
  const credit = account ? creditPosition(account, reservations, r.id) : null
  const usesCredit = !!account && offersCredit(account.paymentTerms)
  const overBy = usesCredit && credit ? r.total - credit.available : 0
  const needRef = policy.referenceRequired || !!account?.billing.poRequired
  const canOverride = !!roleId && canSetCredit(roleId, policy)

  function approveBilling() {
    if (!account || account.status !== 'active') return setError('The company account is not active.')
    if (c.booker.status !== 'verified') return setError('Verify the booker first.')
    const approver = approvers.find((x) => x.id === approverId)
    if (!approver) return setError('Choose the company contact who approved the charges.')
    if (!method) return setError('Choose how they approved it.')
    if (needRef && !reference.trim()) return setError(account.billing.poRequired ? 'Enter the LPO number.' : 'Enter the approval reference.')
    if (overBy > 0 && !canOverride) {
      return setError(`This stay is ${ugx(overBy)} over the company's available credit. ${STEP_LABEL[policy.creditApprover]} must approve it.`)
    }
    if (overBy > 0 && !reason.trim()) return setError('Give the reason for going over the credit limit.')
    save(
      {
        ...c,
        billing: {
          status: 'approved',
          approverContactId: approver.id,
          approverName: approver.name,
          method: method as BillingCheckMethod,
          reference: reference.trim() || undefined,
          overCreditApprovedBy: overBy > 0 ? staff : undefined,
          overCreditReason: overBy > 0 ? reason.trim() : undefined,
          by: staff,
          at: stampNow(),
        },
      },
      `Billing approved by ${approver.name} (${BILLING_METHOD[method as BillingCheckMethod]}${reference.trim() ? `, ${reference.trim()}` : ''})${overBy > 0 ? `. Over credit by ${ugx(overBy)}, approved by ${staff}: ${reason.trim()}` : ''}`,
      { guarantee: 'company' },
    )
  }
  function declineBilling() {
    save(
      { ...c, billTo: 'guest', billing: { status: 'declined', by: staff, at: stampNow(), note: 'Company did not approve' } },
      'Company billing declined. The guest pays.',
      { guarantee: r.guarantee === 'company' ? 'none' : r.guarantee },
    )
  }

  // ---- Price ----
  const p = c.pricing
  function decidePrice(approve: boolean) {
    if (!p) return
    save(
      { ...c, pricing: { ...p, status: approve ? 'approved' : 'declined', decidedBy: staff, at: stampNow() } },
      approve ? `Company price approved: ${p.labels.join(' + ')}` : 'Company price declined. Normal price stays.',
      approve ? { total: r.total - p.originalTotal + p.finalTotal } : {},
    )
  }

  const methodSelect = (options: Record<string, string>) => (
    <Field label="How">
      {(id) => (
        <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Choose…</option>
          {Object.entries(options)
            .filter(([k]) => k !== 'authorised-list')
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      )}
    </Field>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{c.accountName}</p>
          <p className="text-xs text-ink/60">{BILL_TO_LABEL[c.billTo]}</p>
        </div>
        {account && <Badge tone={account.status === 'active' ? 'good' : 'bad'}>{STATUS_LABEL[account.status]}</Badge>}
      </div>

      <ol className="space-y-2">
        <Check n={1} title="Company account" state={checks.account}>
          {checks.account !== 'ok' && <p>The account is {account ? STATUS_LABEL[account.status].toLowerCase() : 'missing'}. Do not bill the company until it is active.</p>}
        </Check>

        <Check n={2} title="Booker is allowed to book" state={checks.booker}>
          <p>
            {c.booker.name}
            {c.booker.phone ? ` · ${c.booker.phone}` : ''}
            {c.booker.method && ` · ${BOOKER_METHOD[c.booker.method]}`}
            {c.booker.reference && ` · ref ${c.booker.reference}`}
            {c.booker.by && <span className="block text-xs text-ink/55">By {c.booker.by}, {c.booker.at}</span>}
          </p>
          {open && c.booker.status === 'pending' && form !== 'booker' && (
            <div className="flex flex-wrap gap-2">
              {!policy.bookerMustBeListed && (
                <Button size="sm" onClick={() => setForm('booker')}>
                  Verify booker
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={failBooker}>
                Could not verify
              </Button>
            </div>
          )}
          {policy.bookerMustBeListed && c.booker.status === 'pending' && (
            <p className="text-xs text-ink/60">Hotel rule: only people on the company's list can book. Ask the company to add this person.</p>
          )}
          {form === 'booker' && (
            <div className="space-y-2 rounded-lg bg-canvas p-3">
              {methodSelect(BOOKER_METHOD)}
              <Field label="Reference" hint="Who confirmed it at the company, or the document number.">
                {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={verifyBooker}>
                  Mark verified
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Check>

        <Check n={3} title="Guest's identity" state={checks.guestId}>
          <p>
            {r.details
              ? `${r.details.idType} ending ${r.details.idNumber.slice(-4)}, recorded at check-in.`
              : 'Checked and recorded at check-in, like every guest.'}
          </p>
        </Check>

        <Check n={4} title="Approved for company billing" state={checks.billing}>
          {c.billing.status === 'approved' && (
            <p>
              {c.billing.approverName ? `${c.billing.approverName} · ${c.billing.method ? BILLING_METHOD[c.billing.method] : ''}` : c.billing.note}
              {c.billing.reference && ` · ref ${c.billing.reference}`}
              {c.billing.overCreditApprovedBy && (
                <span className="block text-xs text-warn">
                  Over credit, approved by {c.billing.overCreditApprovedBy}: {c.billing.overCreditReason}
                </span>
              )}
              <span className="block text-xs text-ink/55">
                Recorded by {c.billing.by}, {c.billing.at}
              </span>
            </p>
          )}
          {c.billing.status === 'declined' && <p>{c.billing.note}. The guest pays.</p>}
          {c.billing.status === 'not-required' && <p>The guest pays. Nothing goes to the company.</p>}
          {open && c.billing.status === 'pending' && (
            <>
              <p>A company contact who can approve charges must confirm this stay.</p>
              {overBy > 0 && (
                <p className="text-xs font-medium text-bad">
                  {ugx(overBy)} over the available credit. {STEP_LABEL[policy.creditApprover]} must also approve.
                </p>
              )}
              {form !== 'billing' ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setForm('billing')} disabled={c.booker.status !== 'verified'}>
                    Record company approval
                  </Button>
                  <Button size="sm" variant="ghost" onClick={declineBilling}>
                    Company declined
                  </Button>
                  {c.booker.status !== 'verified' && <p className="w-full text-xs text-ink/60">Verify the booker first.</p>}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg bg-canvas p-3">
                  <Field label="Approved by">
                    {(id) => (
                      <Select id={id} value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                        <option value="">Choose…</option>
                        {approvers.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · {x.jobTitle}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  {approvers.length === 0 && <p className="text-xs text-bad">Nobody at this company is allowed to approve charges.</p>}
                  {methodSelect(BILLING_METHOD)}
                  <Field label={account?.billing.poRequired ? 'LPO number' : 'Reference'} required={needRef}>
                    {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}
                  </Field>
                  {overBy > 0 && canOverride && (
                    <Field label="Reason for going over the credit limit" required>
                      {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
                    </Field>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={approveBilling}>
                      Approve billing
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Check>

        {p && (
          <Check n={5} title="Company price" state={checks.pricing}>
            <p>
              {p.labels.join(' + ')} · {ugx(p.perNightFinal)} instead of {ugx(p.perNightOriginal)} per night
              <span className="block text-xs text-ink/55">
                {p.status === 'declined'
                  ? `Declined by ${p.decidedBy}. Normal price charged.`
                  : p.status === 'pending'
                    ? `Saving of ${ugx(p.originalTotal - p.finalTotal)} not applied until a manager approves.`
                    : `Saving of ${ugx(p.originalTotal - p.finalTotal)} applied${p.decidedBy ? `, approved by ${p.decidedBy}` : ''}.`}
              </span>
            </p>
            {open && p.status === 'pending' &&
              (roleId && canChangePricing(roleId) ? (
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
          </Check>
        )}
      </ol>

      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}

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
