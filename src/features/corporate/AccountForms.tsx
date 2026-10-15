import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Field, Input, Select, Textarea } from '../../components/ui'
import { BILL_TO_LABEL, canSignStep, offersCredit, STEP_LABEL, TERMS_LABEL } from '../../lib/corporate'
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
// One manager signs off. The person who asked for the account cannot approve it themselves.

export function ApprovalBox({ a, role, userId }: { a: CorporateAccount; role: RoleId; userId: string }) {
  const { approveAccount, declineAccount, policy } = useCorporate()
  const { run, busy, error } = useAction()
  const [note, setNote] = useState('')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const isManager = canSignStep(role, 'manager')
  const isRequester = a.createdBy.id === userId

  return (
    <Box>
      <div>
        <p className="text-sm font-semibold">Waiting for a manager's approval</p>
        <p className="mt-1 text-xs text-ink/60">
          Requested by {a.createdBy.name}, {a.createdAt}. Once approved the account can be billed.
        </p>
        {a.requestedCreditLimit ? (
          <p className="mt-2 text-sm">
            Credit asked for: {ugx(a.requestedCreditLimit)}. Approving the account does not give credit. {STEP_LABEL[policy.creditApprover]} sets it
            afterwards.
          </p>
        ) : null}
      </div>

      {!isManager ? (
        <p className="text-xs text-ink/60">Only a manager can approve this account.</p>
      ) : isRequester ? (
        <p className="text-xs text-ink/60">You asked for this account, so another manager must approve it.</p>
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
            void run(() => approveAccount(a.id, note))
          }}
        >
          <Field label="Note (optional)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <FormError error={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              Approve account
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

const ROLES = [
  { key: 'booker', label: 'Books stays for the company', canBook: true, canApproveCharges: false },
  { key: 'approver', label: 'Approves charges to the company', canBook: false, canApproveCharges: true },
] as const

export function ContactFields({
  value: c,
  onChange,
  fixedRole = false,
}: {
  value: ContactDraft
  onChange: (c: ContactDraft) => void
  /** The role is set by where the form is used, so it is not offered as a choice. */
  fixedRole?: boolean
}) {
  const both = c.canBook && c.canApproveCharges
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
        {!fixedRole && (
          <fieldset className="space-y-1">
            <legend className="mb-1 font-medium text-ink/80">Role at the company</legend>
            {ROLES.map((r) => (
              <label key={r.key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`role-${c.id ?? 'new'}`}
                  checked={!both && c.canBook === r.canBook && c.canApproveCharges === r.canApproveCharges}
                  onChange={() => onChange({ ...c, canBook: r.canBook, canApproveCharges: r.canApproveCharges })}
                />
                {r.label}
              </label>
            ))}
            <p className="text-xs text-ink/55">
              One person holds one role. Whoever books a stay cannot also approve the company paying for it.
            </p>
            {both && <p className="text-xs font-medium text-bad">This contact has both rights. Choose one before saving.</p>}
          </fieldset>
        )}
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
          <Button type="submit" size="sm" disabled={busy || !c.name.trim() || (c.canBook && c.canApproveCharges)}>
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
