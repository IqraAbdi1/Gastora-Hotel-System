import { useState } from 'react'
import { Button, ConfirmDialog, Field, Input, Modal, Select } from '../../components/ui'
import { paymentMethods } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { ErrorNote } from './ErrorNote'
import { num } from './eventsUi'
import { useEvents, useRun } from './useEvents'

const METHODS = ['Bank transfer', ...paymentMethods]

// Money received against an event, optionally against one row of its deposit schedule.
export default function PaymentDialog({
  eventBookingId,
  depositScheduleId,
  label,
  amount,
  onClose,
}: {
  eventBookingId: string
  depositScheduleId?: string
  label: string
  amount: number
  onClose: () => void
}) {
  const { service, actor } = useEvents()
  const { busy, error, run, setError } = useRun()
  const [value, setValue] = useState(amount > 0 ? String(amount) : '')
  const [method, setMethod] = useState(METHODS[0])
  const [reference, setReference] = useState('')
  const [confirming, setConfirming] = useState(false)

  const ask = () => {
    if (!(num(value) > 0)) return setError('The amount must be more than 0.')
    if (method !== 'Cash' && !reference.trim()) return setError('Add the transaction reference.')
    setError(null)
    setConfirming(true)
  }
  const save = async () => {
    setConfirming(false)
    if (await run(() => service.recordPayment(eventBookingId, { amount: num(value), method, reference, depositScheduleId }, actor))) onClose()
  }

  return (
    <Modal
      title="Record payment"
      description={label}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={ask} disabled={busy}>
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Amount (UGX)" required hint={amount > 0 ? `Outstanding ${ugx(amount)}` : undefined}>
          {(id) => <Input id={id} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reference" required={method !== 'Cash'}>
            {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="EFT or MoMo ID" />}
          </Field>
        </div>
        <ErrorNote error={error} />
      </div>
      {confirming && (
        <ConfirmDialog
          title="Record this payment?"
          message={`${ugx(num(value))} by ${method}${reference ? ` (${reference})` : ''}, received by ${actor.name}.`}
          confirmLabel="Record payment"
          onCancel={() => setConfirming(false)}
          onConfirm={save}
        />
      )}
    </Modal>
  )
}
