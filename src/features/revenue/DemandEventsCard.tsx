import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, dayMonthYear } from '../../lib/format'
import {
  describeEffect,
  EFFECT_LABEL,
  EFFECT_PERCENT,
  effectTone,
  newEventId,
  nightsCovered,
  sortEvents,
} from '../../lib/demandEvents'
import type { DemandEvent, EventEffect } from '../../lib/demandEvents'
import { roomTypeList } from '../../lib/rates'
import type { Room } from '../../types'
import { useFeatures } from '../platform/featuresContext'

const EFFECTS: EventEffect[] = ['high', 'some', 'low', 'percent']

/** "8 October", or "8 October 2027" when it is not this year's. */
const when = (d: string) => (d.slice(0, 4) === TODAY.slice(0, 4) ? dayMonth(d) : dayMonthYear(d))

const blank = (list: DemandEvent[]): DemandEvent => ({
  id: newEventId(list),
  name: '',
  from: TODAY,
  to: TODAY,
  effect: 'high',
})

/**
 * What the hotel knows is coming: a conference, a public holiday, a match, the school holidays.
 *
 * These are the hotel's own words, kept with where it heard them. They feed the rate suggestions above
 * and are marked there as the hotel's input rather than anything measured, and they never move a price
 * on their own.
 */
export default function DemandEventsCard() {
  const { options, setOptions } = useFeatures()
  const rates = options.rates
  const events = rates.events ?? []
  const [editing, setEditing] = useState<DemandEvent | null>(null)
  const [removing, setRemoving] = useState<DemandEvent | null>(null)

  const save = (list: DemandEvent[]) => setOptions({ rates: { ...rates, events: list } })

  function commit(e: DemandEvent) {
    const clean: DemandEvent = {
      ...e,
      name: e.name.trim(),
      to: e.to < e.from ? e.from : e.to,
      percent: e.effect === 'percent' ? e.percent ?? 0 : undefined,
      types: e.types && e.types.length > 0 ? e.types : undefined,
      note: e.note?.trim() || undefined,
    }
    save(events.some((x) => x.id === e.id) ? events.map((x) => (x.id === e.id ? clean : x)) : [...events, clean])
    setEditing(null)
  }

  const list = sortEvents(events, TODAY)

  return (
    <Card
      title="Events and demand"
      icon="calendar"
      count={events.length}
      padded
      description="Conferences, holidays, matches: what you know is coming that the booking history does not."
      actions={
        <Button size="sm" onClick={() => setEditing(blank(events))}>
          Add an event
        </Button>
      }
    >
      <p className="text-xs text-ink/60">
        Each event moves the suggestions for its nights up or down, and is shown there as{' '}
        <strong className="text-ink/80">Your input</strong>: something the hotel said, not something measured.
        Nothing changes a price until somebody approves it.
      </p>

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">No events yet. Suggestions read pace and occupancy alone.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((e) => {
            const past = e.to < TODAY
            const n = nightsCovered(e)
            return (
              <li key={e.id} className={`rounded-xl border border-ink/10 p-3 ${past ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {e.name || 'Unnamed event'}
                      {past && <span className="ml-2 text-xs font-normal text-ink/50">Over</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/70">
                      {e.from === e.to ? when(e.from) : `${dayMonth(e.from)} to ${when(e.to)}`} · {n} night
                      {n === 1 ? '' : 's'} · {e.types && e.types.length > 0 ? e.types.join(', ') : 'Every room type'}
                    </p>
                    {e.note && <p className="mt-0.5 text-xs text-ink/55">{e.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={effectTone(e)} dot>
                      {describeEffect(e)}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(e)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <EventForm key={editing.id} event={editing} isNew={!events.some((x) => x.id === editing.id)} onSave={commit} onClose={() => setEditing(null)} />}

      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name || 'this event'}?`}
          message="Suggestions for its nights go back to reading pace and occupancy alone. Prices already approved stay as they are."
          confirmLabel="Delete"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            save(events.filter((x) => x.id !== removing.id))
            setRemoving(null)
          }}
        />
      )}
    </Card>
  )
}

function EventForm({
  event,
  isNew,
  onSave,
  onClose,
}: {
  event: DemandEvent
  isNew: boolean
  onSave: (e: DemandEvent) => void
  onClose: () => void
}) {
  const [e, setE] = useState<DemandEvent>(event)
  const set = (patch: Partial<DemandEvent>) => setE((x) => ({ ...x, ...patch }))
  const types = e.types ?? []
  const toggle = (t: Room['type']) => set({ types: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] })
  const problem = !e.name.trim() ? 'Give the event a name.' : e.to < e.from ? 'The last night is before the first.' : undefined

  return (
    <Modal
      title={isNew ? 'Add an event' : `Edit ${event.name}`}
      description="What you expect, in your own words. It moves suggestions, never a price."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!!problem} onClick={() => onSave(e)}>
            {isNew ? 'Add event' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          {(id) => (
            <Input id={id} value={e.name} placeholder="East Africa Business Summit" onChange={(x) => set({ name: x.target.value })} />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First night">
            {(id) => (
              <Input id={id} type="date" value={e.from} onChange={(x) => x.target.value && set({ from: x.target.value })} />
            )}
          </Field>
          <Field label="Last night" hint="The last night guests stay for it, not the day they leave.">
            {(id) => <Input id={id} type="date" value={e.to} onChange={(x) => x.target.value && set({ to: x.target.value })} />}
          </Field>
        </div>
        <Field label="What you expect">
          {(id) => (
            <Select id={id} value={e.effect} onChange={(x) => set({ effect: x.target.value as EventEffect })}>
              {EFFECTS.map((k) => (
                <option key={k} value={k}>
                  {EFFECT_LABEL[k]}
                  {k !== 'percent' ? ` (${EFFECT_PERCENT[k] > 0 ? '+' : '−'}${Math.abs(EFFECT_PERCENT[k])}%)` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {e.effect === 'percent' && (
          <Field label="Effect on the price, %" hint="Negative for a quiet spell, such as −10.">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                className="tabular-nums"
                value={String(e.percent ?? 0)}
                onChange={(x) => set({ percent: Number(x.target.value.replace(/[^\d-]/g, '')) || 0 })}
              />
            )}
          </Field>
        )}
        <div>
          <p className="text-sm font-medium text-ink/80">Room types</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {roomTypeList.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={types.includes(t)}
                onClick={() => toggle(t)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  types.includes(t) ? 'border-brand bg-brand/15 text-ink' : 'border-ink/10 bg-surface text-ink/55 hover:border-brand/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/55">{types.length === 0 ? 'None chosen, so every room type.' : `Only ${types.join(', ')}.`}</p>
        </div>
        <Field label="Note or source" hint="Where you heard, so the next manager can check it.">
          {(id) => (
            <Textarea id={id} rows={2} value={e.note ?? ''} onChange={(x) => set({ note: x.target.value })} />
          )}
        </Field>
        {problem && <p className="text-xs font-medium text-bad">{problem}</p>}
      </div>
    </Modal>
  )
}
