import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'

const REASONS = ['Staff meal', 'Loyal guest', 'Complaint recovery', 'Manager comp', 'Promotion', 'Other']

// A discount always carries a reason. Above the outlet's limit it needs a manager.
export default function DiscountDialog({
  target,
  percent: initialPercent,
  reason: initialReason,
  limit,
  isManager,
  onSave,
  onClose,
}: {
  target: string
  percent: number
  reason: string
  limit: number
  isManager: boolean
  onSave: (percent: number, reason: string) => void
  onClose: () => void
}) {
  const preset = REASONS.includes(initialReason) ? initialReason : initialReason ? 'Other' : REASONS[0]
  const [percent, setPercent] = useState(String(initialPercent || ''))
  const [choice, setChoice] = useState(preset)
  const [other, setOther] = useState(preset === 'Other' ? initialReason : '')
  const [error, setError] = useState('')
  const value = Number(percent) || 0
  const over = value > limit

  function save() {
    if (!(value >= 0 && value <= 100)) return setError('Between 0 and 100%.')
    const reason = choice === 'Other' ? other.trim() : choice
    if (value > 0 && !reason) return setError('Give a reason.')
    onSave(value, value > 0 ? reason : '')
  }

  return (
    <Modal
      title={`Discount · ${target}`}
      onClose={onClose}
      footer={
        <>
          {initialPercent > 0 && <Button variant="ghost" onClick={() => onSave(0, '')}>Remove</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Apply</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Discount %" error={error} hint={over ? (isManager ? `Above ${limit}%: approved by you.` : `Above ${limit}%: a manager must approve before payment.`) : `Up to ${limit}% without approval.`}>
          {(id) => <Input id={id} type="number" min={0} max={100} value={percent} onChange={(e) => { setPercent(e.target.value); setError('') }} />}
        </Field>
        <Field label="Reason">
          {(id) => (
            <Select id={id} value={choice} onChange={(e) => setChoice(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          )}
        </Field>
        {choice === 'Other' && (
          <Field label="Other reason">
            {(id) => <Input id={id} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Why" />}
          </Field>
        )}
      </div>
    </Modal>
  )
}
