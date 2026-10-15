import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal, Select } from '../../components/ui'
import { POLICY_PRESETS, STEP_LABEL } from '../../lib/corporate'
import type { ApprovalStep, CorporatePolicy } from '../../services/corporate/corporateTypes'
import { FormError } from './AccountForms'
import { useCorporate } from './corporateContext'
import { useAction } from './useAction'

const SIZE_LABEL: Record<CorporatePolicy['size'], string> = {
  small: 'Small hotel: light checks',
  medium: 'Medium hotel: company confirms each booking',
  large: 'Large hotel: manager and finance, strict booking checks',
}

const APPROVAL_OPTIONS: { key: string; steps: ApprovalStep[]; label: string }[] = [
  { key: 'manager', steps: ['manager'], label: 'Manager' },
  { key: 'finance', steps: ['finance'], label: 'Finance' },
  { key: 'both', steps: ['manager', 'finance'], label: 'Manager and finance (two different people)' },
]

// How strict the hotel is with company accounts. Everyone can read it; the owner or hotel admin can change it.
export default function PolicyDialog({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const { policy, policyIsDefault, setPolicy } = useCorporate()
  const { run, busy, error } = useAction()
  const [p, setP] = useState<CorporatePolicy>(policy)
  const approvalKey = APPROVAL_OPTIONS.find((o) => o.steps.join() === p.accountApproval.join())?.key ?? 'manager'

  const row = (label: string, hint: string, control: ReactNode) => (
    <div className="grid gap-2 border-b border-ink/8 py-3 last:border-0 sm:grid-cols-[1fr_240px] sm:items-center">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink/60">{hint}</p>
      </div>
      {control}
    </div>
  )

  return (
    <Modal
      wide
      title="Company account rules"
      description={
        policyIsDefault
          ? "Using the default for this hotel's plan. Changes apply to new requests and bookings."
          : 'Set for this hotel. Changes apply to new requests and bookings.'
      }
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void run(() => setPolicy(p), onClose)}>
              Save rules
            </Button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="space-y-1">
        {row(
          'Start from',
          'Fills in the settings below. You can then change any of them.',
          <Select value={p.size} onChange={(e) => setP(POLICY_PRESETS[e.target.value as CorporatePolicy['size']])}>
            {Object.entries(SIZE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>,
        )}
        {row(
          'Who approves a new account',
          'Accounts never open by themselves.',
          <Select value={approvalKey} onChange={(e) => setP({ ...p, accountApproval: APPROVAL_OPTIONS.find((o) => o.key === e.target.value)?.steps ?? ['manager'] })}>
            {APPROVAL_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>,
        )}
        {row(
          'Who controls credit',
          'Sets credit limits and approves bookings that go over the limit.',
          <Select value={p.creditApprover} onChange={(e) => setP({ ...p, creditApprover: e.target.value as ApprovalStep })}>
            {(['manager', 'finance'] as ApprovalStep[]).map((s) => (
              <option key={s} value={s}>
                {STEP_LABEL[s]}
              </option>
            ))}
          </Select>,
        )}
        {row(
          'When the company must approve a booking for billing',
          'Approval comes from a company contact who can approve charges.',
          <Select value={p.bookingApproval} onChange={(e) => setP({ ...p, bookingApproval: e.target.value as CorporatePolicy['bookingApproval'] })}>
            <option value="over-credit">Only without credit or over the limit</option>
            <option value="always">Every booking</option>
          </Select>,
        )}
        {row(
          'Who can book for a company',
          'If anyone may book, staff verify a new booker by calling the company or with written authorisation.',
          <Select value={p.bookerMustBeListed ? 'listed' : 'verified'} onChange={(e) => setP({ ...p, bookerMustBeListed: e.target.value === 'listed' })}>
            <option value="listed">Only people on the company's list</option>
            <option value="verified">Others, once verified</option>
          </Select>,
        )}
        {row(
          'Reference needed to approve billing',
          'A purchase order (LPO), approval email or signed form number.',
          <Select value={p.referenceRequired ? 'yes' : 'no'} onChange={(e) => setP({ ...p, referenceRequired: e.target.value === 'yes' })}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>,
        )}
      </fieldset>
      {!canEdit && <p className="mt-3 text-xs text-ink/60">Only the owner or hotel admin can change these rules.</p>}
      <div className="mt-3">
        <FormError error={error} />
      </div>
    </Modal>
  )
}
