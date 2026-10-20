import { useState } from 'react'
import { Badge, Button, Modal } from '../../components/ui'
import type { ModifierGroup } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import type { LineModifier, Product } from './posTypes'

// Choices for one item: required groups must be answered before it goes on the order.
export default function ModifierDialog({
  product,
  groups,
  onConfirm,
  onClose,
}: {
  product: Product
  groups: ModifierGroup[]
  onConfirm: (modifiers: LineModifier[]) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')

  function toggle(group: ModifierGroup, modifierId: string) {
    setError('')
    setPicked((old) => {
      const current = old[group.id] ?? []
      if (current.includes(modifierId)) return { ...old, [group.id]: current.filter((id) => id !== modifierId) }
      if (group.maxSelect === 1) return { ...old, [group.id]: [modifierId] }
      if (current.length >= group.maxSelect) return old
      return { ...old, [group.id]: [...current, modifierId] }
    })
  }

  const chosen: LineModifier[] = groups.flatMap((g) =>
    (picked[g.id] ?? []).map((id) => {
      const m = g.modifiers.find((x) => x.id === id)
      return { groupId: g.id, modifierId: id, name: m?.name ?? '', price: m?.price ?? 0 }
    }),
  )
  const price = product.price + chosen.reduce((s, m) => s + m.price, 0)

  function confirm() {
    const missing = groups.find((g) => (picked[g.id]?.length ?? 0) < g.minSelect)
    if (missing) return setError(`Choose ${missing.minSelect === 1 ? 'one' : missing.minSelect} for ${missing.name}.`)
    onConfirm(chosen)
  }

  return (
    <Modal
      title={`${product.emoji} ${product.name}`}
      description={cash(price)}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm}>Add to order</Button>
        </>
      }
    >
      <div className="space-y-5">
        {groups.map((g) => (
          <fieldset key={g.id}>
            <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
              {g.name}
              <Badge tone={g.required ? 'warn' : 'neutral'}>{g.required ? 'Required' : 'Optional'}</Badge>
              {g.maxSelect > 1 && <span className="text-xs font-normal text-ink/50">up to {g.maxSelect}</span>}
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.modifiers.map((m) => {
                const on = (picked[g.id] ?? []).includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(g, m.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${on ? 'border-brand bg-brand/5 font-semibold text-brand' : 'border-ink/15 hover:border-brand/40'}`}
                  >
                    <span>{m.name}</span>
                    <span className="text-xs">{m.price ? `+${cash(m.price)}` : 'Included'}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
