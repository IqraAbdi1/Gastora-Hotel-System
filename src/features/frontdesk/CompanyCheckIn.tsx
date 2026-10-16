import { useState } from 'react'
import { Badge, Button, Field, Input, Select } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { approverProblem, BILL_TO_LABEL, creditPosition, needsLpo, offersCredit, stampNow, STATUS_LABEL } from '../../lib/corporate'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { BillingCheckMethod, BookerCheckMethod, CorporateBooking, Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { statusTone } from '../corporate/corporateUi'

type LinkMethod = 'listed' | 'callback' | 'written'
type LpoVia = 'email' | 'hard-copy' | 'phone-callback'

const LINK_LABEL: Record<LinkMethod, string> = {
  listed: "Named on the company's list of bookers",
  callback: 'We called the company on the number we have on file',
  written: 'Written authorisation from the company',
}

const LPO_LABEL: Record<LpoVia, string> = {
  email: 'Emailed to us by the approver',
  'hard-copy': 'Original presented by the guest',
  'phone-callback': 'Confirmed by phone with the approver',
}

const VIA_TO_METHOD: Record<LpoVia, BillingCheckMethod> = {
  email: 'email',
  'hard-copy': 'signed-form',
  'phone-callback': 'phone-callback',
}

const LINK_TO_METHOD: Record<LinkMethod, BookerCheckMethod> = {
  listed: 'authorised-list',
  callback: 'callback',
  written: 'written-authorisation',
}

const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

// The company part of check-in. Shown before the ID steps for any stay billed to a company.
// Nothing here happens at booking: the front desk confirms it with the guest in front of them.
export default function CompanyCheckIn({ reservation: r }: { reservation: Reservation }) {
  const { reservations, setCorporate } = useHotel()
  const { byId, policy } = useCorporate()
  const { user } = useAuth()
  const c = r.corporate as CorporateBooking
  const account = byId(c.accountId)
  const staff = user?.name ?? 'Front desk'
  const lpoRequired = account ? needsLpo(account, policy) : false

  const listed = account?.contacts.filter((x) => x.active && x.canBook) ?? []
  const approvers = account?.contacts.filter((x) => x.active && x.canApproveCharges) ?? []
  const credit = account ? creditPosition(account, reservations, r.id) : null
  const overBy = account && credit && offersCredit(account.paymentTerms) ? Math.max(0, r.total - credit.available) : 0
  const overApproved = !!c.billing.overCreditApprovedBy

  const methods: LinkMethod[] = policy.callbackRequired ? ['callback', 'written'] : ['listed', 'callback', 'written']

  const [link, setLink] = useState<LinkMethod | ''>('')
  const [listedId, setListedId] = useState('')
  const [linkRef, setLinkRef] = useState('')
  const [lpoNumber, setLpoNumber] = useState(c.billing.claimedLpo ?? '')
  const [lpoAmount, setLpoAmount] = useState(String(Math.round(r.total)))
  const [lpoDate, setLpoDate] = useState(TODAY)
  const [via, setVia] = useState<LpoVia>('email')
  const [approverId, setApproverId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!account || account.status !== 'active') {
    return (
      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-bad/30 bg-bad/10 p-4 text-sm">
          <p className="font-semibold text-bad">{c.accountName} cannot be billed right now</p>
          <p className="mt-1 text-ink/80">
            The company account is {account ? STATUS_LABEL[account.status].toLowerCase() : 'missing'}. Choose "Guest pays instead" to take
            payment from the guest.
          </p>
        </div>
        <Button variant="ghost" onClick={() => payGuest()}>
          Guest pays instead
        </Button>
      </div>
    )
  }

  const approver = approvers.find((x) => x.id === approverId)
  const guestAs = link === 'listed' ? listed.find((x) => x.id === listedId) : undefined
  // Whoever is at the desk is the guest. The approver must not be that person, nor the booker.
  const guestIdentity = { contactId: guestAs?.id, name: guestAs?.name ?? r.guest }

  const problems: string[] = []
  if (!link) problems.push(`Choose how you confirmed that ${r.guest} works for ${c.accountName}.`)
  if (link === 'listed' && !listedId) problems.push('Choose which person on the company list this guest is.')
  if (link && !linkRef.trim()) problems.push('Record a reference: who you spoke to, or the document or email reference.')
  if (approvers.length === 0) problems.push(`${c.accountName} has no contact who can approve charges. Add one under Companies.`)
  if (!approver) problems.push('Choose the company contact who approved the charges.')
  if (approver) {
    const same = approverProblem(approver, guestIdentity) ?? approverProblem(approver, c.booker)
    if (same) problems.push(same)
  }
  if (lpoRequired) {
    if (!lpoNumber.trim()) problems.push('Enter the LPO number exactly as it is on the document.')
    if (c.billing.claimedLpo && lpoNumber.trim() && lpoNumber.trim() !== c.billing.claimedLpo) {
      problems.push(`The booking has LPO ${c.billing.claimedLpo}, but this one is ${lpoNumber.trim()}. Check which is correct with the company.`)
    }
    const amount = Number(lpoAmount.replace(/[,\s]/g, '')) || 0
    if (amount < Math.round(r.total)) problems.push(`The LPO covers ${ugx(amount)}, but the stay is ${ugx(r.total)}.`)
    if (lpoDate > TODAY) problems.push('The date received cannot be in the future.')
  }
  if (overBy > 0 && !overApproved) {
    problems.push(
      `This stay is ${ugx(overBy)} over the company's credit. ${policy.creditApprover === 'finance' ? 'Finance' : 'A manager'} must approve it under Companies first.`,
    )
  }

  function payGuest() {
    setCorporate(
      r.id,
      {
        ...c,
        billTo: 'guest',
        billing: { ...c.billing, status: 'not-required', by: staff, at: stampNow(), note: 'Guest pays instead, decided at check-in' },
        log: [...c.log, { at: stampNow(), by: staff, action: 'Guest pays instead, decided at check-in' }],
      },
      { guarantee: r.guarantee === 'company' ? 'none' : r.guarantee },
    )
  }

  function confirm() {
    if (problems.length > 0 || !approver || !link) return setError(problems[0] ?? 'Check the details above.')
    const now = stampNow()
    const amount = Number(lpoAmount.replace(/[,\s]/g, '')) || 0
    const booker: CorporateBooking['booker'] = {
      ...c.booker,
      contactId: guestAs?.id ?? c.booker.contactId,
      name: guestIdentity.name,
      status: 'verified',
      method: LINK_TO_METHOD[link],
      reference: linkRef.trim(),
      by: staff,
      at: now,
    }
    const lpo = lpoRequired
      ? { number: lpoNumber.trim(), amount, receivedOn: lpoDate, recordedBy: staff, recordedAt: now }
      : c.billing.lpo
    const next: CorporateBooking = {
      ...c,
      booker,
      billing: {
        status: 'approved',
        approverContactId: approver.id,
        approverName: approver.name,
        method: VIA_TO_METHOD[via],
        reference: lpoRequired ? lpoNumber.trim() : linkRef.trim() || undefined,
        lpo,
        overCreditApprovedBy: c.billing.overCreditApprovedBy,
        overCreditReason: c.billing.overCreditReason,
        by: staff,
        at: now,
      },
      log: [
        ...c.log,
        { at: now, by: staff, action: `Guest confirmed for ${c.accountName}: ${LINK_LABEL[link]} (${linkRef.trim()})` },
        {
          at: now,
          by: staff,
          action: `Charges approved by ${approver.name} (${LPO_LABEL[via].toLowerCase()}${lpoRequired ? `, LPO ${lpoNumber.trim()}` : ''})`,
        },
      ],
    }
    setCorporate(r.id, next, { guarantee: 'company' })
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{account.name}</p>
          <p className="text-xs text-ink/60">{BILL_TO_LABEL[c.billTo]}</p>
        </div>
        <Badge tone={statusTone[account.status]} dot>
          {STATUS_LABEL[account.status]}
        </Badge>
      </div>

      <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink/75">
        This stay is on the company's account. Confirm the company side with the guest here, then continue to ID. A check made at
        booking does not count.
      </p>

      <section className="space-y-3">
        <p className={heading}>1. Is the guest from {account.name}?</p>
        {policy.callbackRequired && (
          <p className="text-xs text-warn">Large hotel rule: call the company on the number in our records, not one the guest gives.</p>
        )}
        <Field label="How did you confirm it?" required>
          {(id) => (
            <Select
              id={id}
              value={link}
              onChange={(e) => {
                setLink(e.target.value as LinkMethod)
                setError(null)
              }}
            >
              <option value="">Choose…</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {LINK_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {link === 'listed' && (
          <Field label="Which person on the company list?" required>
            {(id) => (
              <Select id={id} value={listedId} onChange={(e) => setListedId(e.target.value)}>
                <option value="">Choose…</option>
                {listed.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.jobTitle}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {link && (
          <Field
            label={link === 'callback' ? 'Who did you speak to, and when?' : link === 'written' ? 'Document or email reference' : 'How did you check the ID against the list?'}
            required
          >
            {(id) => <Input id={id} value={linkRef} onChange={(e) => setLinkRef(e.target.value)} />}
          </Field>
        )}
      </section>

      <section className="space-y-3">
        <p className={heading}>
          {lpoRequired ? "2. The company's authority to charge" : '2. Who approves the charges, and how?'}
        </p>
        {lpoRequired && (
          <p className="text-xs text-ink/60">
            {c.billing.claimedLpo
              ? `The booking has LPO ${c.billing.claimedLpo}. Check it matches the document in front of you.`
              : 'No LPO number was given at booking. Take it from the document in front of you.'}{' '}
            The LPO is the company's commitment; the name is who to call about it.
          </p>
        )}
        <div className={lpoRequired ? 'space-y-3 rounded-lg border border-ink/10 bg-canvas/60 p-3' : 'space-y-3'}>
          {lpoRequired && (
            <div className="grid gap-3 sm:grid-cols-3">
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
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={lpoRequired ? 'Who signed it for the company' : 'Approved by'}
              required
              hint="A company contact who can approve charges. Not the person who booked, and not the guest."
            >
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
            <Field label={lpoRequired ? 'How it reached us' : 'How the company confirmed it'}>
              {(id) => (
                <Select id={id} value={via} onChange={(e) => setVia(e.target.value as LpoVia)}>
                  {(Object.keys(LPO_LABEL) as LpoVia[]).map((k) => (
                    <option key={k} value={k}>
                      {LPO_LABEL[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </section>

      {overBy > 0 && (
        <section className={`rounded-lg p-3 text-sm ${overApproved ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'}`}>
          {overApproved ? (
            <>
              Over the credit limit by {ugx(overBy)}, approved by {c.billing.overCreditApprovedBy}.
            </>
          ) : (
            <>
              Over the credit limit by {ugx(overBy)}. {policy.creditApprover === 'finance' ? 'Finance' : 'A manager'} must approve it
              under Companies before this stay can be billed.
            </>
          )}
        </section>
      )}

      {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      {problems.length > 0 && (
        <ul className="space-y-1 text-xs text-ink/60">
          {problems.map((p) => (
            <li key={p}>· {p}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        <Button onClick={confirm} disabled={problems.length > 0}>
          Confirm company and continue to ID
        </Button>
        <Button variant="ghost" onClick={payGuest}>
          Guest pays instead
        </Button>
      </div>
    </div>
  )
}
