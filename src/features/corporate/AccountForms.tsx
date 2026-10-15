import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Field, Input, Select, Textarea } from '../../components/ui'
import { BILL_TO_LABEL, canSetCredit, canSignStep, missingSteps, offersCredit, STEP_LABEL, TERMS_LABEL } from '../../lib/corporate'
import { ugx } from '../../lib/format'
import type { RoleId } from '../../lib/roles'
import type {
  AccountStatus,
  BillingInstructions,
  CorporateAccount,
  PaymentTerms,
} from '../../services/corporate/corporateTypes'
import type { BillTo } from '../../types'
import { useCorporate } from './corporateContext'
import { BILL_TOS, parseAmount, TERMS } from './corporateUi'
import type { ContactDraft } from './corporateUi'
import { useAction } from './useAction'

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>
}

function Box({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-lg border border-ink/10 bg-canvas/60 p-3">{children}</div>
}

// ---------- Approval of a new account ----------

export function ApprovalBox({ a, role, userId }: { a: CorporateAccount; role: RoleId; userId: string }) {
  const { approveAccount, declineAccount, policy } = useCorporate()
  const { run, busy, error } = useAction()
  const missing = missingSteps(a)
  const already = a.approvals.some((x) => x.by.id === userId)
  const mine = missing.find((s) => canSignStep(role, s))
  const credit = canSetCredit(role, policy)
  const [note, setNote] = useState('')
  const [limit, setLimit] = useState(String(a.requestedCreditLimit ?? 0))
  const [terms, setTerms] = useState<PaymentTerms>(a.requestedCreditLimit ? 'net-30' : 'on-departure')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <Box>
      <div>
        <p className="text-sm font-semibold text-ink">Approval needed before this account can be used</p>
        <ul className="mt-2 space-y-1 text-sm">
          {a.requiredSteps.map((s) => {
            const done = a.approvals.find((x) => x.step === s)
            return (
              <li key={s} className="flex justify-between gap-3">
                <span>{STEP_LABEL[s]}</span>
                <span className={done ? 'font-medium text-good' : 'text-ink/55'}>
                  {done ? `Approved by ${done.by.name}, ${done.at}` : 'Waiting'}
                </span>
              </li>
            )
          })}
        </ul>
        {a.requestedCreditLimit ? (
          <p className="mt-2 text-xs text-ink/60">Requested credit: {ugx(a.requestedCreditLimit)}. Not granted until an approver sets it.</p>
        ) : null}
      </div>

      {!mine ? (
        <p className="text-xs text-ink/60">
          {missing.map((s) => STEP_LABEL[s]).join(' and ')} must approve. You cannot give {missing.length === 1 ? 'this approval' : 'these approvals'}.
        </p>
      ) : already ? (
        <p className="text-xs text-ink/60">You have already approved this account. Another person must give the next approval.</p>
      ) : declining ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => declineAccount(a.id, reason))
          }}
        >
          <Field label="Reason for declining" required>
            {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <FormError error={error} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={busy || !reason.trim()}>
              Decline account
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() =>
              approveAccount(
                a.id,
                mine,
                credit ? { note, creditLimit: parseAmount(limit), paymentTerms: terms } : { note },
                policy,
              ),
            )
          }}
        >
          {credit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment terms to grant">
                {(id) => (
                  <Select id={id} value={terms} onChange={(e) => setTerms(e.target.value as PaymentTerms)}>
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {TERMS_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Credit limit to grant (UGX)" hint={offersCredit(terms) ? undefined : 'No credit on these terms.'}>
                {(id) => <Input id={id} inputMode="numeric" value={offersCredit(terms) ? limit : '0'} disabled={!offersCredit(terms)} onChange={(e) => setLimit(e.target.value)} />}
              </Field>
            </div>
          ) : (
            <p className="text-xs text-ink/60">
              You approve the account itself. Credit stays at none until {STEP_LABEL[policy.creditApprover].toLowerCase()} sets it.
            </p>
          )}
          <Field label="Note (optional)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <FormError error={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              Approve as {STEP_LABEL[mine].toLowerCase()}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
        </form>
      )}
    </Box>
  )
}

// ---------- Credit ----------

export function CreditForm({ a, onDone }: { a: CorporateAccount; onDone: () => void }) {
  const { setCredit, policy } = useCorporate()
  const { run, busy, error } = useAction()
  const [terms, setTerms] = useState<PaymentTerms>(a.paymentTerms)
  const [limit, setLimit] = useState(String(a.creditLimit))
  const [reason, setReason] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(() => setCredit(a.id, offersCredit(terms) ? parseAmount(limit) : 0, terms, reason, policy), onDone)
  }

  return (
    <form onSubmit={submit}>
      <Box>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment terms">
            {(id) => (
              <Select id={id} value={terms} onChange={(e) => setTerms(e.target.value as PaymentTerms)}>
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    {TERMS_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Credit limit (UGX)" hint={offersCredit(terms) ? undefined : 'No credit on these terms.'}>
            {(id) => <Input id={id} inputMode="numeric" value={offersCredit(terms) ? limit : '0'} disabled={!offersCredit(terms)} onChange={(e) => setLimit(e.target.value)} />}
          </Field>
        </div>
        <Field label="Reason for the change" required hint="Kept in the account history.">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <FormError error={error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !reason.trim()}>
            Save credit
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </Box>
    </form>
  )
}

// ---------- Status ----------

const STATUS_ACTIONS: { to: Exclude<AccountStatus, 'pending' | 'declined'>; label: string; danger?: boolean }[] = [
  { to: 'active', label: 'Reactivate' },
  { to: 'on-hold', label: 'Put on hold', danger: true },
  { to: 'suspended', label: 'Suspend', danger: true },
  { to: 'closed', label: 'Close account', danger: true },
]

export function StatusForm({ a }: { a: CorporateAccount }) {
  const { setStatus } = useCorporate()
  const { run, busy, error } = useAction()
  const [to, setTo] = useState<(typeof STATUS_ACTIONS)[number] | null>(null)
  const [reason, setReason] = useState('')
  const options = STATUS_ACTIONS.filter((s) => s.to !== a.status)

  if (!to) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <Button key={s.to} size="sm" variant={s.danger ? 'ghost' : 'secondary'} onClick={() => setTo(s)}>
            {s.label}
          </Button>
        ))}
      </div>
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => setStatus(a.id, to.to, reason), () => {
          setTo(null)
          setReason('')
        })
      }}
    >
      <Box>
        <p className="text-sm font-semibold">{to.label}</p>
        {to.to !== 'active' && (
          <p className="text-xs text-ink/60">New bookings cannot be billed to the company while it is not active. Existing bookings are not changed.</p>
        )}
        <Field label="Reason" required={to.to !== 'active'}>
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <FormError error={error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant={to.danger ? 'danger' : 'primary'} disabled={busy || (to.to !== 'active' && !reason.trim())}>
            {to.label}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTo(null)}>
            Cancel
          </Button>
        </div>
      </Box>
    </form>
  )
}

// ---------- Billing instructions ----------

export function BillingForm({ a, onDone }: { a: CorporateAccount; onDone: () => void }) {
  const { updateBilling } = useCorporate()
  const { run, busy, error } = useAction()
  const [b, setB] = useState<BillingInstructions>(a.billing)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => updateBilling(a.id, b), onDone)
      }}
    >
      <Box>
        <BillingFields value={b} onChange={setB} />
        <FormError error={error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            Save billing
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </Box>
    </form>
  )
}

export function BillingFields({ value: b, onChange }: { value: BillingInstructions; onChange: (b: BillingInstructions) => void }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Usually billed">
          {(id) => (
            <Select id={id} value={b.defaultBillTo} onChange={(e) => onChange({ ...b, defaultBillTo: e.target.value as BillTo })}>
              {BILL_TOS.map((t) => (
                <option key={t} value={t}>
                  {BILL_TO_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Send invoices to">
          {(id) => <Input id={id} type="email" value={b.invoiceEmail} onChange={(e) => onChange({ ...b, invoiceEmail: e.target.value })} />}
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={b.poRequired} onChange={(e) => onChange({ ...b, poRequired: e.target.checked })} />
        The company's purchase order (LPO) number is needed on each booking
      </label>
      <Field label="Billing instructions">
        {(id) => <Textarea id={id} rows={2} value={b.instructions} onChange={(e) => onChange({ ...b, instructions: e.target.value })} />}
      </Field>
    </>
  )
}

// ---------- Contacts ----------

export function ContactFields({ value: c, onChange }: { value: ContactDraft; onChange: (c: ContactDraft) => void }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          {(id) => <Input id={id} value={c.name} onChange={(e) => onChange({ ...c, name: e.target.value })} />}
        </Field>
        <Field label="Job title">{(id) => <Input id={id} value={c.jobTitle} onChange={(e) => onChange({ ...c, jobTitle: e.target.value })} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={c.phone} onChange={(e) => onChange({ ...c, phone: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={c.email} onChange={(e) => onChange({ ...c, email: e.target.value })} />}</Field>
      </div>
      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={c.canBook} onChange={(e) => onChange({ ...c, canBook: e.target.checked })} />
          Can make bookings for the company
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={c.canApproveCharges} onChange={(e) => onChange({ ...c, canApproveCharges: e.target.checked })} />
          Can approve charges to the company
        </label>
        {c.id && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={c.active} onChange={(e) => onChange({ ...c, active: e.target.checked })} />
            Still works for the company (untick to remove their rights)
          </label>
        )}
      </div>
    </>
  )
}

export function ContactForm({ a, contact, onDone }: { a: CorporateAccount; contact: ContactDraft; onDone: () => void }) {
  const { saveContact } = useCorporate()
  const { run, busy, error } = useAction()
  const [c, setC] = useState<ContactDraft>(contact)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => saveContact(a.id, c), onDone)
      }}
    >
      <Box>
        <p className="text-sm font-semibold">{c.id ? `Edit ${contact.name}` : 'New contact'}</p>
        <p className="text-xs text-ink/60">Only add rights the company has confirmed in writing. Keep the confirmation on file.</p>
        <ContactFields value={c} onChange={setC} />
        <FormError error={error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !c.name.trim()}>
            Save contact
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </Box>
    </form>
  )
}
