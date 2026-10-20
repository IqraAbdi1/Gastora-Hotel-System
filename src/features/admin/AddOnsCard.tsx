import { Badge, Button, Card, Field, Input, Textarea } from '../../components/ui'
import { newAddOnId, PER_LABEL } from '../../lib/addOns'
import type { AddOn, Per } from '../../lib/addOns'
import { chargeCategories } from '../../lib/folio'
import { ugx } from '../../lib/format'

const box = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink'
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * What the hotel sells beside the room.
 *
 * Each extra names the charge category it is posted under, because an extra that does not reach the
 * folio by the hotel's own categories is money that will not appear in any report it already has.
 */
export default function AddOnsCard({
  addOns,
  set,
}: {
  addOns: AddOn[]
  set: (next: AddOn[]) => void
}) {
  const change = (id: string, patch: Partial<AddOn>) => set(addOns.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  return (
    <Card
      title="Extras sold with the room"
      icon="money"
      count={addOns.filter((a) => a.on).length}
      padded
      description="Offered on the hotel's booking page and posted to the guest's bill."
    >
      <ul className="space-y-2">
        {addOns.map((a) => (
          <li key={a.id} className="rounded-lg border border-ink/10 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_8rem]">
              <Input
                value={a.name}
                onChange={(e) => change(a.id, { name: e.target.value })}
                aria-label="Extra name"
                placeholder="Airport pickup"
              />
              <Input
                inputMode="numeric"
                className="tabular-nums"
                value={String(a.price)}
                onChange={(e) => change(a.id, { price: num(e.target.value) })}
                aria-label={`${a.name} price`}
              />
              <select
                value={a.per}
                onChange={(e) => change(a.id, { per: e.target.value as Per })}
                aria-label={`${a.name} charged`}
                className={box}
              >
                {(['stay', 'night', 'person'] as Per[]).map((p) => (
                  <option key={p} value={p}>
                    {PER_LABEL[p]}
                  </option>
                ))}
              </select>
              <select
                value={a.category}
                onChange={(e) => change(a.id, { category: e.target.value })}
                aria-label={`${a.name} category`}
                className={box}
              >
                {chargeCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <Field label="What the guest reads">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={a.blurb}
                    onChange={(e) => change(a.id, { blurb: e.target.value })}
                    placeholder="A driver meets you at Entebbe with your name on a board."
                  />
                )}
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-ink/60">
                <Badge tone={a.on ? 'good' : 'neutral'} dot={a.on}>
                  {a.on ? 'Offered' : 'Off'}
                </Badge>
                {ugx(a.price)} {PER_LABEL[a.per]} · posted as {a.category}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-ink/70">
                  <input type="checkbox" checked={a.on} onChange={(e) => change(a.id, { on: e.target.checked })} />
                  Offered
                </label>
                <button
                  type="button"
                  className="font-semibold text-bad"
                  onClick={() => set(addOns.filter((x) => x.id !== a.id))}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
        {addOns.length === 0 && <li className="text-xs text-ink/55">Nothing is sold beside the room.</li>}
      </ul>

      <div className="mt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            set([
              ...addOns,
              { id: newAddOnId(addOns), name: '', blurb: '', price: 50000, per: 'stay', category: 'Other', on: false },
            ])
          }
        >
          Add an extra
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink/55">
        Extras go on the bill at booking. Not part of the deposit.
      </p>
    </Card>
  )
}
