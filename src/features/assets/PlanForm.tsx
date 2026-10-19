import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import type { Asset } from '../../lib/assets'
import { PLAN_PROBLEM_TEXT, planProblem } from '../../lib/preventive'
import type { Every, ServicePlan } from '../../lib/preventive'

/** A piece of work that comes round again: by the calendar, or by how hard the machine has worked. */
export default function PlanForm({
  plan,
  assets,
  isNew,
  onClose,
  onSave,
}: {
  plan: ServicePlan
  assets: Asset[]
  isNew: boolean
  onClose: () => void
  onSave: (plan: ServicePlan) => void
}) {
  const [draft, setDraft] = useState<ServicePlan>(plan)
  const [touched, setTouched] = useState(false)
  const set = (patch: Partial<ServicePlan>) => setDraft((d) => ({ ...d, ...patch }))

  const asset = assets.find((a) => a.id === draft.assetId) ?? assets[0]
  const problem = asset ? planProblem(draft, asset) : 'name'
  const show = (key: typeof problem) => (touched && problem === key ? PLAN_PROBLEM_TEXT[key as 'name'] : undefined)

  function setKind(kind: Every['kind']) {
    const n = kind === 'meter' ? 250 : kind === 'months' ? 3 : 30
    set({ every: { kind, n } as Every })
  }

  function save() {
    setTouched(true)
    if (problem) return
    onSave({ ...draft, name: draft.name.trim() })
  }

  return (
    <Modal
      title={isNew ? 'New service plan' : 'Edit service plan'}
      description="Work that comes round again, so nobody has to remember it."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{isNew ? 'Add it' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Which machine">
          {(id) => (
            <Select id={id} value={draft.assetId} onChange={(e) => set({ assetId: e.target.value })}>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag} · {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="What is to be done" required error={show('name')}>
          {(id) => (
            <Input
              id={id}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Service: oil, filters, belts"
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Counted by" error={show('meter')}>
            {(id) => (
              <Select id={id} value={draft.every.kind} onChange={(e) => setKind(e.target.value as Every['kind'])}>
                <option value="months">The calendar, in months</option>
                <option value="days">The calendar, in days</option>
                <option value="meter">How hard it works{asset?.meterUnit ? ` (${asset.meterUnit})` : ''}</option>
              </Select>
            )}
          </Field>
          <Field
            label="How often"
            required
            error={show('every')}
            hint={draft.every.kind === 'meter' ? `Every this many ${asset?.meterUnit ?? 'hours'}.` : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={draft.every.n}
                onChange={(e) => set({ every: { ...draft.every, n: Number(e.target.value) } as Every })}
              />
            )}
          </Field>
        </div>

        <Field
          label="Warn this many days ahead"
          hint="The job appears on the list this far before it falls due, so somebody can plan it."
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={draft.leadDays}
              onChange={(e) => set({ leadDays: Math.max(0, Number(e.target.value)) })}
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Last done on" hint="Leave it empty and it counts from the day the machine was bought.">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.lastDoneOn ?? ''}
                onChange={(e) => set({ lastDoneOn: e.target.value || undefined })}
              />
            )}
          </Field>
          {draft.every.kind === 'meter' && (
            <Field label="Reading when last done">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={draft.lastDoneAt ?? ''}
                  onChange={(e) => set({ lastDoneAt: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              )}
            </Field>
          )}
        </div>

        <Field label="Notes">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={draft.note ?? ''}
              onChange={(e) => set({ note: e.target.value })}
              className="resize-none"
              placeholder="Parts needed, who does it, anything required by law."
            />
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
          On. Switch it off to stop raising this work without losing the record.
        </label>
      </div>
    </Modal>
  )
}
