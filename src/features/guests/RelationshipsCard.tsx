import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Field, Input, Select } from '../../components/ui'
import { addLink, LINK_LABEL, LINK_NOTE, mirror, withoutLink } from '../../lib/relationships'
import type { GuestLink } from '../../types'
import type { Guest } from '../../types'
import { useHotel } from '../../lib/hotelContext'
import { useCorporate } from '../corporate/corporateContext'

/**
 * Who this guest belongs with: the people they travel with, the company that pays, the agent that sold
 * the stay. A household link is written on both records, because a relationship recorded on one side
 * only is true until somebody opens the other record.
 */
export default function RelationshipsCard({ guest }: { guest: Guest }) {
  const { guests, updateGuest } = useHotel()
  const { accounts } = useCorporate()
  const [kind, setKind] = useState<GuestLink['kind']>('household')
  const [targetId, setTargetId] = useState('')
  const [relation, setRelation] = useState('')

  const links = guest.links ?? []
  const others = guests.filter((g) => g.id !== guest.id)
  const choices =
    kind === 'household'
      ? others.map((g) => ({ id: g.id, name: `${g.name}${g.phone ? ` · ${g.phone}` : ''}` }))
      : accounts.map((a) => ({ id: a.id, name: a.name }))

  function add() {
    const chosen = choices.find((c) => c.id === targetId)
    if (!chosen) return
    const name = kind === 'household' ? others.find((g) => g.id === targetId)?.name ?? chosen.name : chosen.name
    const next = addLink(guest, { kind, targetId, name, relation: relation.trim() || undefined })
    if (next) updateGuest(guest.id, { links: next })

    // The other side of a household, written at the same moment.
    if (kind === 'household') {
      const other = others.find((g) => g.id === targetId)
      if (other) {
        const back = addLink(other, mirror(guest, relation.trim() || undefined))
        if (back) updateGuest(other.id, { links: back })
      }
    }
    setTargetId('')
    setRelation('')
  }

  function remove(link: GuestLink) {
    updateGuest(guest.id, { links: withoutLink(guest, link.id) })
    if (link.kind === 'household') {
      const other = guests.find((g) => g.id === link.targetId)
      const back = other?.links?.find((l) => l.targetId === guest.id)
      if (other && back) updateGuest(other.id, { links: withoutLink(other, back.id) })
    }
  }

  return (
    <Card
      title="Who they belong with"
      icon="guests"
      count={links.length}
      padded
      description="The people they travel with, the company that pays, the agent that sold the stay."
    >
      {links.length === 0 ? (
        <p className="text-sm text-ink/55">Nothing linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm">
              <span className="min-w-0">
                <Badge tone={l.kind === 'household' ? 'neutral' : 'good'}>{LINK_LABEL[l.kind]}</Badge>
                {l.kind === 'household' ? (
                  <Link to={`/desk/guests/${l.targetId}`} className="ml-2 font-medium text-brand">
                    {l.name}
                  </Link>
                ) : (
                  <span className="ml-2 font-medium text-ink">{l.name}</span>
                )}
                {l.relation && <span className="ml-2 text-xs text-ink/55">{l.relation}</span>}
              </span>
              <button type="button" className="text-xs font-semibold text-bad" onClick={() => remove(l)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_1fr_8rem_auto]">
        <Field label="Kind">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as GuestLink['kind'])
                setTargetId('')
              }}
            >
              {(['household', 'company', 'agent'] as GuestLink['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {LINK_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={kind === 'household' ? 'Which guest' : 'Which account'}>
          {(id) => (
            <Select id={id} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="In what way" hint="Optional">
          {(id) => <Input id={id} value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Wife" />}
        </Field>
        <div className="self-end">
          <Button size="sm" disabled={!targetId} onClick={add}>
            Link
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/55">{LINK_NOTE[kind]}</p>
    </Card>
  )
}
