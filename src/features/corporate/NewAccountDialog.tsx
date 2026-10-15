import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { TERMS_LABEL, offersCredit } from '../../lib/corporate'
import type { BillingInstructions, PaymentTerms } from '../../services/corporate/corporateTypes'
import { BillingFields, ContactFields, FormError } from './AccountForms'
import { useCorporate } from './corporateContext'
import { emptyContact, parseAmount, TERMS } from './corporateUi'
import type { ContactDraft } from './corporateUi'
import { useAction } from './useAction'

// Ask for a new company account. It starts "Awaiting approval" with no credit, whoever asks.
export default function NewAccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { requestAccount } = useCorporate()
  const { run, busy, error } = useAction()
  const [name, setName] = useState('')
  const [tin, setTin] = useState('')
  const [industry, setIndustry] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [terms, setTerms] = useState<PaymentTerms>('on-departure')
  const [credit, setCredit] = useState('')
  const [billing, setBilling] = useState<BillingInstructions>({ defaultBillTo: 'company-room', invoiceEmail: '', poRequired: false, instructions: '' })
  // Two different people: one books stays, the other approves the company paying for them.
  const [booker, setBooker] = useState<ContactDraft>({ ...emptyContact, canBook: true, canApproveCharges: false })
  const [approver, setApprover] = useState<ContactDraft>({ ...emptyContact, canBook: false, canApproveCharges: true })

  const hasApprover = approver.name.trim().length > 0
  const samePerson = hasApprover && approver.name.trim().toLowerCase() === booker.name.trim().toLowerCase()
  const valid = name.trim().length >= 2 && booker.name.trim().length >= 2 && !samePerson

  function submit() {
    void run(async () => {
      const created = await requestAccount(
        {
          name,
          tin,
          industry,
          address,
          phone,
          email,
          paymentTerms: terms,
          requestedCreditLimit: offersCredit(terms) ? parseAmount(credit) : 0,
          billing,
          contacts: hasApprover ? [booker, approver] : [booker],
        },
      )
      onCreated(created.id)
    })
  }

  return (
    <Modal
      wide
      title="New company account"
      description="A manager approves it before any stay can be billed to the company. It starts with no credit."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? 'Sending…' : 'Send for approval'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Company</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
            <Field label="TIN" hint="Uganda Revenue Authority tax number.">{(id) => <Input id={id} value={tin} onChange={(e) => setTin(e.target.value)} />}</Field>
            <Field label="Industry">{(id) => <Input id={id} value={industry} onChange={(e) => setIndustry(e.target.value)} />}</Field>
            <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
            <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <Field label="Address">{(id) => <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">What the company is asking for</h3>
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
            <Field label="Credit limit asked for (UGX)" hint="A request only. An approver decides.">
              {(id) => (
                <Input id={id} inputMode="numeric" disabled={!offersCredit(terms)} value={offersCredit(terms) ? credit : ''} onChange={(e) => setCredit(e.target.value)} />
              )}
            </Field>
          </div>
          <BillingFields value={billing} onChange={setBilling} />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Booking contact</h3>
          <p className="text-xs text-ink/60">Makes bookings for the company. Cannot approve the charges.</p>
          <ContactFields value={booker} onChange={setBooker} fixedRole />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Charge approver</h3>
          <p className="text-xs text-ink/60">
            A different person who approves the company paying, for example their finance or admin manager. Can be added later, but
            no stay can be billed to the company until there is one.
          </p>
          <ContactFields value={approver} onChange={setApprover} fixedRole />
          {samePerson && (
            <p className="text-sm font-medium text-bad">The booker and the charge approver must be different people.</p>
          )}
        </section>

        <FormError error={error} />
      </div>
    </Modal>
  )
}
