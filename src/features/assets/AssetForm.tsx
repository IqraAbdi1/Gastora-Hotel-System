import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { useHotel } from '../../lib/hotelContext'
import { ASSET_CATEGORIES, ASSET_STATES, DEFAULT_LIFE_YEARS, PROBLEM_TEXT, assetProblem } from '../../lib/assets'
import type { Asset, AssetCategory, AssetState, MeterUnit } from '../../lib/assets'

const NOT_A_ROOM = ''

/** Adding a piece of equipment, or correcting what is on record about it. */
export default function AssetForm({
  asset,
  all,
  showCosts,
  onClose,
  onSave,
}: {
  asset: Asset
  all: Asset[]
  showCosts: boolean
  onClose: () => void
  onSave: (asset: Asset) => void
}) {
  const { rooms } = useHotel()
  const [draft, setDraft] = useState<Asset>(asset)
  const [touched, setTouched] = useState(false)
  const set = (patch: Partial<Asset>) => setDraft((d) => ({ ...d, ...patch }))

  const problem = assetProblem(draft, all)
  const isNew = !all.some((a) => a.id === asset.id)

  function pickRoom(number: string) {
    if (number === NOT_A_ROOM) set({ room: undefined, where: '' })
    else set({ room: number, where: `Room ${number}` })
  }

  function save() {
    setTouched(true)
    if (problem) return
    onSave({ ...draft, tag: draft.tag.trim(), name: draft.name.trim(), where: draft.where.trim() })
  }

  const showProblem = (key: typeof problem) => touched && problem === key

  return (
    <Modal
      wide
      title={isNew ? 'Add equipment' : `Edit ${draft.tag}`}
      description="What it is, where it is, and what the hotel knows about it."
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Asset number"
            required
            hint="The number on the thing itself, such as AC-204."
            error={showProblem('tag') ? PROBLEM_TEXT.tag : showProblem('duplicate tag') ? PROBLEM_TEXT['duplicate tag'] : undefined}
          >
            {(id) => <Input id={id} value={draft.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="AC-204" />}
          </Field>
          <Field label="What is it" required error={showProblem('name') ? PROBLEM_TEXT.name : undefined}>
            {(id) => (
              <Input id={id} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Split air conditioner" />
            )}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={draft.category} onChange={(e) => set({ category: e.target.value as AssetCategory })}>
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="In a room?" hint="Choose a room, or leave it and type the place below.">
            {(id) => (
              <Select id={id} value={draft.room ?? NOT_A_ROOM} onChange={(e) => pickRoom(e.target.value)}>
                <option value={NOT_A_ROOM}>Not in a room</option>
                {rooms.map((r) => (
                  <option key={r.number} value={r.number}>
                    Room {r.number}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="Where it is"
          required
          hint="Plant room, Kitchen, Roof, Laundry — wherever a technician would go to find it."
          error={showProblem('where') ? PROBLEM_TEXT.where : undefined}
        >
          {(id) => (
            <Input
              id={id}
              value={draft.where}
              disabled={!!draft.room}
              onChange={(e) => set({ where: e.target.value })}
              placeholder="Plant room"
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Make">
            {(id) => <Input id={id} value={draft.make ?? ''} onChange={(e) => set({ make: e.target.value })} placeholder="LG" />}
          </Field>
          <Field label="Model">
            {(id) => <Input id={id} value={draft.model ?? ''} onChange={(e) => set({ model: e.target.value })} />}
          </Field>
          <Field label="Serial number">
            {(id) => <Input id={id} value={draft.serial ?? ''} onChange={(e) => set({ serial: e.target.value })} />}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bought on" hint="Leave it empty if it was here before the hotel kept records.">
            {(id) => (
              <Input id={id} type="date" value={draft.boughtOn ?? ''} onChange={(e) => set({ boughtOn: e.target.value || undefined })} />
            )}
          </Field>
          <Field
            label="Warranty ends"
            error={showProblem('warranty before purchase') ? PROBLEM_TEXT['warranty before purchase'] : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.warrantyUntil ?? ''}
                onChange={(e) => set({ warrantyUntil: e.target.value || undefined })}
              />
            )}
          </Field>
        </div>

        {showCosts && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What it cost" hint="Shillings, as paid.">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={draft.cost ?? ''}
                  onChange={(e) => set({ cost: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              )}
            </Field>
            <Field label="Years expected" hint={`How long the hotel expects to use it. ${DEFAULT_LIFE_YEARS} if left empty.`}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  value={draft.lifeYears ?? ''}
                  onChange={(e) => set({ lifeYears: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              )}
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Supplier">
            {(id) => <Input id={id} value={draft.supplier ?? ''} onChange={(e) => set({ supplier: e.target.value })} />}
          </Field>
          <Field label="Running meter" hint="Only for things with a dial.">
            {(id) => (
              <Select
                id={id}
                value={draft.meterUnit ?? ''}
                onChange={(e) => set({ meterUnit: e.target.value === '' ? undefined : (e.target.value as MeterUnit) })}
              >
                <option value="">None</option>
                <option value="hours">Running hours</option>
                <option value="kilometres">Kilometres</option>
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={draft.state} onChange={(e) => set({ state: e.target.value as AssetState })}>
                {ASSET_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Notes">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              className="resize-none"
              placeholder="Anything the next technician should know."
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
