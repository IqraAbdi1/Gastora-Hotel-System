import { useState } from 'react'
import { Badge, Button, Card, Field, Input, Select } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { newStayRateId, nextDay, priceNights, stayDiscountOf, stayRateLabel } from '../../lib/rateCalendar'
import type { StayRate } from '../../lib/rateCalendar'
import { roomTypeList } from '../../lib/rates'
import type { RatesPolicy } from '../../lib/rates'
import type { Room } from '../../types'

const box = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink'
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * Pricing by length of stay: less per night for a guest who stays longer.
 *
 * The last layer of the rate calendar. Whatever the season, the day and the house decided a night costs,
 * a stay long enough takes its percentage off every night of it. The desk's quote, the booking page and
 * the guest's own price all read the same rule, so a guest is never quoted two numbers.
 */
export default function StayRatesCard({
  rates,
  set,
}: {
  rates: RatesPolicy
  set: (patch: Partial<RatesPolicy>) => void
}) {
  const list = rates.stayRates ?? []
  const [type, setType] = useState<Room['type']>('Standard')
  const [nights, setNights] = useState(7)
  const setRule = (id: string, patch: Partial<StayRate>) =>
    set({ stayRates: list.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  // A real stay from today, priced the way the desk and the booking page would price it.
  let end = TODAY
  for (let i = 0; i < Math.max(1, nights); i++) end = nextDay(end)
  const planId = rates.plans[0]?.id
  const stay = priceNights(type, TODAY, end, rates, undefined, { planId })
  const deal = stayDiscountOf(stay)
  const total = stay.reduce((n, p) => n + p.rate, 0)

  return (
    <Card
      title="Longer stays"
      icon="calendar"
      count={list.length}
      padded
      description="Less per night for a guest who stays longer. Applied last, after the season, the day and how full the house is."
    >
      <p className="text-xs text-ink/60">
        The rule with the most nights the stay reaches is the one that applies: a ten-night guest gets the seven-night
        price, not both. The guest and the desk see it as its own line, such as “Stay 3 nights or more: 5% off”.
      </p>
      <ul className="mt-3 space-y-2">
        {list.map((r) => (
          <li key={r.id} className="rounded-lg border border-ink/10 p-2.5">
            <div className="grid gap-2 sm:grid-cols-[6rem_6rem_8rem_8.5rem_8.5rem]">
              <Field label="Nights or more">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(r.minNights)}
                    onChange={(e) => setRule(r.id, { minNights: Math.max(1, num(e.target.value)) })}
                  />
                )}
              </Field>
              <Field label="% off a night">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(r.percentOff)}
                    onChange={(e) => setRule(r.id, { percentOff: Math.min(90, num(e.target.value)) })}
                  />
                )}
              </Field>
              <Field label="Room type">
                {(id) => (
                  <select
                    id={id}
                    value={r.type ?? ''}
                    onChange={(e) => setRule(r.id, { type: (e.target.value || undefined) as Room['type'] })}
                    className={box}
                  >
                    <option value="">Every type</option>
                    {roomTypeList.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="From night">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={r.from ?? ''}
                    onChange={(e) => setRule(r.id, { from: e.target.value || undefined })}
                    className={box}
                  />
                )}
              </Field>
              <Field label="To night">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={r.to ?? ''}
                    onChange={(e) => setRule(r.id, { to: e.target.value || undefined })}
                    className={box}
                  />
                )}
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rates.plans.map((p) => {
                const on = (r.planIds ?? []).includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setRule(r.id, {
                        planIds: on ? (r.planIds ?? []).filter((x) => x !== p.id) : [...(r.planIds ?? []), p.id],
                      })
                    }
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                      on ? 'border-brand bg-brand/15 text-ink' : 'border-ink/10 bg-surface text-ink/55 hover:border-brand/40'
                    }`}
                  >
                    {p.name || 'Unnamed plan'}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-ink/60">
                <strong className="text-ink/80">{stayRateLabel(r)}</strong> · {r.type ?? 'Every type'} ·{' '}
                {r.planIds && r.planIds.length > 0
                  ? rates.plans
                      .filter((p) => r.planIds!.includes(p.id))
                      .map((p) => p.name)
                      .join(', ')
                  : 'every meal plan'}
                {(r.from || r.to) &&
                  ` · nights ${r.from ? `from ${dayMonth(r.from)}` : ''}${r.from && r.to ? ' ' : ''}${r.to ? `to ${dayMonth(r.to)}` : ''}`}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-ink/70">
                  <input type="checkbox" checked={r.on} onChange={(e) => setRule(r.id, { on: e.target.checked })} />
                  On
                </label>
                <button
                  type="button"
                  className="font-semibold text-bad"
                  onClick={() => set({ stayRates: list.filter((x) => x.id !== r.id) })}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="text-xs text-ink/55">No long-stay prices. Every night costs the same however long the stay.</li>}
      </ul>
      <p className="mt-1 text-xs text-ink/55">
        No meal plan chosen means every plan. Dates are judged night by night, so a long stay that runs into a period
        left out pays the full price for those nights.
      </p>
      <div className="mt-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            set({ stayRates: [...list, { id: newStayRateId(list), minNights: 7, percentOff: 10, on: false }] })
          }
        >
          Add a long-stay price
        </Button>
      </div>

      <section className="mt-4 border-t border-ink/10 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <p className="mr-auto text-sm font-medium text-ink/80">Try a stay from today</p>
          <Field label="Room type">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as Room['type'])} className="w-36">
                {roomTypeList.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nights">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                className="w-20 tabular-nums"
                value={String(nights)}
                onChange={(e) => setNights(Math.min(60, Math.max(1, num(e.target.value))))}
              />
            )}
          </Field>
        </div>
        <div className="mt-2 space-y-1 text-sm">
          {deal ? (
            <>
              <p className="flex justify-between text-ink/60">
                <span>Before the long-stay price</span>
                <span className="tabular-nums">{ugx(total + deal.saving)}</span>
              </p>
              <p className="flex justify-between text-good">
                <span>{deal.label}</span>
                <span className="tabular-nums">− {ugx(deal.saving)}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-ink/55">No long-stay price applies to this stay.</p>
          )}
          <p className="flex justify-between">
            <span>
              {nights} night{nights === 1 ? '' : 's'}, {rates.plans[0]?.name ?? 'room only'}
            </span>
            <span className="flex items-center gap-2">
              {deal && <Badge tone="good">Long stay</Badge>}
              <span className="font-semibold tabular-nums">{ugx(total)}</span>
            </span>
          </p>
        </div>
        <p className="mt-1 text-xs text-ink/55">
          Room only, through the whole rate calendar. The meal plan is added on top of each night. A booking already taken
          keeps the price it was sold at.
        </p>
      </section>
    </Card>
  )
}
