import { useState } from 'react'
import { Button, Field, Input, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { roomTypes } from '../../lib/booking'
import type { CorporateAccount, CorporateAgreement, PricingRule } from '../../services/corporate/corporateTypes'
import { FormError } from './AccountForms'
import { useCorporate } from './corporateContext'
import { parseAmount } from './corporateUi'
import { useAction } from './useAction'

const KIND_LABEL: Record<PricingRule['kind'], string> = {
  'negotiated-rate': 'Negotiated room rate (UGX per night)',
  percent: 'Percentage off the room rate',
  'amount-off': 'Amount off per night (UGX)',
}

function blankAgreement(a: CorporateAccount): CorporateAgreement {
  return {
    reference: `AGR-${a.id}`,
    validFrom: TODAY,
    validTo: addDays(TODAY, 364),
    rules: [],
    allowDiscountOnNegotiatedRate: false,
    notes: '',
  }
}

// Change the company's agreement: dates, price rules and whether discounts may stack.
// Managers only. Every change needs a reason and goes into the account history.
export default function AgreementEditor({ a, onDone }: { a: CorporateAccount; onDone: () => void }) {
  const { saveAgreement } = useCorporate()
  const { run, busy, error } = useAction()
  const [ag, setAg] = useState<CorporateAgreement>(() => a.agreement ?? blankAgreement(a))
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((a.agreement?.rules ?? []).map((r) => [r.id, String(r.value)])),
  )
  const [reason, setReason] = useState('')

  const setRule = (id: string, patch: Partial<PricingRule>) =>
    setAg((x) => ({ ...x, rules: x.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

  function addRule() {
    const id = `PR-${Date.now()}`
    setAg((x) => ({
      ...x,
      rules: [
        ...x.rules,
        { id, label: 'New price', kind: 'percent', value: 0, roomTypes: [...roomTypes], validFrom: x.validFrom, validTo: x.validTo, requiresApproval: false },
      ],
    }))
    setValues((v) => ({ ...v, [id]: '' }))
  }

  function save() {
    const rules = ag.rules.map((r) => ({ ...r, value: parseAmount(values[r.id] ?? '') }))
    const bad = rules.find((r) => r.value <= 0 || (r.kind === 'percent' && r.value >= 100) || r.roomTypes.length === 0)
    if (bad) return run(() => Promise.reject(new Error(`Check "${bad.label}": it needs a value above 0 (under 100 for a percentage) and at least one room type.`)))
    return run(() => saveAgreement(a.id, { ...ag, rules }, reason), onDone)
  }

  return (
    <div className="space-y-4 rounded-lg border border-ink/10 bg-canvas/60 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Reference">{(id) => <Input id={id} value={ag.reference} onChange={(e) => setAg({ ...ag, reference: e.target.value })} />}</Field>
        <Field label="Valid from">{(id) => <Input id={id} type="date" value={ag.validFrom} onChange={(e) => setAg({ ...ag, validFrom: e.target.value })} />}</Field>
        <Field label="Valid to">{(id) => <Input id={id} type="date" value={ag.validTo} onChange={(e) => setAg({ ...ag, validTo: e.target.value })} />}</Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={ag.allowDiscountOnNegotiatedRate}
          onChange={(e) => setAg({ ...ag, allowDiscountOnNegotiatedRate: e.target.checked })}
        />
        <span>
          The agreement allows a discount on top of a negotiated rate
          <span className="block text-xs text-ink/60">Leave unticked unless the signed agreement says so. Two discounts are never added together.</span>
        </span>
      </label>

      <div className="space-y-3">
        {ag.rules.map((r) => (
          <div key={r.id} className="space-y-3 rounded-lg border border-ink/10 bg-surface p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">{(id) => <Input id={id} value={r.label} onChange={(e) => setRule(r.id, { label: e.target.value })} />}</Field>
              <Field label="Type">
                {(id) => (
                  <Select id={id} value={r.kind} onChange={(e) => setRule(r.id, { kind: e.target.value as PricingRule['kind'] })}>
                    {Object.entries(KIND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={r.kind === 'percent' ? 'Percent' : 'Amount (UGX)'}>
                {(id) => <Input id={id} inputMode="numeric" value={values[r.id] ?? ''} onChange={(e) => setValues({ ...values, [r.id]: e.target.value })} />}
              </Field>
              <Field label="Minimum nights (optional)">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    value={r.minNights ?? ''}
                    onChange={(e) => setRule(r.id, { minNights: Number(e.target.value) || undefined })}
                  />
                )}
              </Field>
              <Field label="Valid from">{(id) => <Input id={id} type="date" value={r.validFrom} onChange={(e) => setRule(r.id, { validFrom: e.target.value })} />}</Field>
              <Field label="Valid to">{(id) => <Input id={id} type="date" value={r.validTo} onChange={(e) => setRule(r.id, { validTo: e.target.value })} />}</Field>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-ink/60">Room types:</span>
              {roomTypes.map((t) => (
                <label key={t} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={r.roomTypes.includes(t)}
                    onChange={(e) =>
                      setRule(r.id, { roomTypes: e.target.checked ? [...r.roomTypes, t] : r.roomTypes.filter((x) => x !== t) })
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={r.requiresApproval} onChange={(e) => setRule(r.id, { requiresApproval: e.target.checked })} />
                A manager must approve it on each booking
              </label>
              <Button size="sm" variant="ghost" onClick={() => setAg({ ...ag, rules: ag.rules.filter((x) => x.id !== r.id) })}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={addRule}>
          Add a price
        </Button>
      </div>

      <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={ag.notes} onChange={(e) => setAg({ ...ag, notes: e.target.value })} />}</Field>
      <Field label="Reason for the change" required hint="Kept in the account history.">
        {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <FormError error={error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy || !reason.trim()}>
          Save agreement
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
