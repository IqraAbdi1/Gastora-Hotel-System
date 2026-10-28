import { useMemo, useState } from 'react'
import { Badge, Button, Modal } from '../../components/ui'
import { stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { stayHistory } from '../../lib/loyalty'
import { mergeNote, mergePlan } from '../../lib/mergeGuests'
import type { Guest } from '../../types'
import { useAuth } from '../auth/authContext'

/**
 * Joining two records of one person.
 *
 * The dialog shows what will happen before it happens, because a merge cannot be undone: the two
 * records become one, and the person pressing the button is the only check there is.
 */
export default function MergeDialog({
  a,
  b,
  onClose,
  onMerged,
}: {
  a: Guest
  b: Guest
  onClose: () => void
  onMerged?: (keptId: string) => void
}) {
  const { reservations, mergeGuests } = useHotel()
  const { user } = useAuth()
  const [keepId, setKeepId] = useState(a.id)

  const keep = keepId === a.id ? a : b
  const drop = keepId === a.id ? b : a
  const plan = useMemo(() => mergePlan(keep, drop, reservations), [keep, drop, reservations])

  const histories = {
    [a.id]: stayHistory(a, reservations),
    [b.id]: stayHistory(b, reservations),
  }

  function join() {
    const at = stamp()
    const note = mergeNote(plan, user?.name ?? 'Front desk', at)
    mergeGuests(keep.id, drop.id, { ...plan.result, notes: [...(plan.result.notes ?? []), note] }, drop.name)
    onMerged?.(keep.id)
    onClose()
  }

  return (
    <Modal
      title="Join these two records"
      description="One person, recorded twice. Choose which record survives."
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Leave them apart
          </Button>
          <Button onClick={join}>Join them</Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[a, b].map((g) => {
          const mine = keepId === g.id
          const h = histories[g.id]
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={mine}
              onClick={() => setKeepId(g.id)}
              className={`rounded-xl border p-3 text-left transition ${
                mine ? 'border-brand bg-brand/[0.07] ring-1 ring-brand/30' : 'border-ink/10 bg-surface hover:border-brand/40'
              }`}
            >
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {g.name}
                {mine && <Badge tone="good">Keep this one</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-ink/60">
                {g.id} · {g.phone || 'no telephone'}
                {g.email ? ` · ${g.email}` : ''}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                {h.stays} stay{h.stays === 1 ? '' : 's'} · {ugx(h.spent)} spent
                {h.lastStay ? ` · last here ${dayMonth(h.lastStay)}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <p className="text-ink/75">
          <strong className="text-ink">{plan.stays}</strong> booking{plan.stays === 1 ? '' : 's'} will move to{' '}
          {keep.name}, and {drop.name}'s record will be gone.
        </p>

        {plan.fills.length > 0 && (
          <div className="rounded-lg bg-good/[0.08] p-3">
            <p className="font-semibold text-good">Filled in from the other record</p>
            <p className="mt-0.5 text-ink/75">{plan.fills.join(', ')}.</p>
          </div>
        )}

        {plan.clashes.length > 0 && (
          <div className="rounded-lg bg-warn/[0.1] p-3">
            <p className="font-semibold text-ink">These disagree. The record you keep wins.</p>
            <ul className="mt-1 space-y-0.5 text-ink/75">
              {plan.clashes.map((c) => (
                <li key={c.field}>
                  {c.field}: keeping <strong>{c.keeping}</strong>, losing {c.dropping}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink/55">
              To keep the other value, fix this record first.
            </p>
          </div>
        )}

        {plan.consentWidens && (
          <div className="rounded-lg bg-bad/[0.08] p-3">
            <p className="font-semibold text-bad">This would let the hotel market to them.</p>
            <p className="mt-0.5 text-ink/75">
              The newer record agreed to offers. Only join if certainly the same person.
            </p>
          </div>
        )}

        <p className="text-xs text-ink/55">
          Preferences and notes are combined. Old bookings keep their name.
        </p>
      </div>
    </Modal>
  )
}
