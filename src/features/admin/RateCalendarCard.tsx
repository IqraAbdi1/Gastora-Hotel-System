import { useState } from 'react'
import { Badge, Button, Card, Field, Input, Select } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import {
  DAY_NAMES,
  DAY_SHORT,
  dayOf,
  describeMove,
  newDayRateId,
  newOccupancyRateId,
  newSeasonId,
  priceNights,
  nextDay,
} from '../../lib/rateCalendar'
import type { DayRate, Move, OccupancyRate, RateSeason } from '../../lib/rateCalendar'
import { soldByNight } from '../../lib/availability'
import { useHotel } from '../../lib/hotelContext'
import { roomTypeList } from '../../lib/rates'
import type { RatesPolicy } from '../../lib/rates'
import type { Room } from '../../types'
import { eventsOn } from '../../lib/demandEvents'
import { useFeatures } from '../platform/featuresContext'

const box = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink'
const num = (s: string) => Number(s.replace(/[^\d-]/g, '')) || 0

const MOVES: { key: Move; label: string }[] = [
  { key: 'percent', label: '% of the published rate' },
  { key: 'set', label: 'A price of its own' },
  { key: 'amount', label: 'UGX more or less' },
]

/**
 * The rate calendar: what a room costs on a given night rather than in general.
 *
 * A season decides the price for a stretch of dates; a day-of-week rule then moves whatever the season
 * decided. Both are read top to bottom and the first match wins, which is what lets a hotel set a
 * December rate and put Christmas itself above it. The preview at the bottom is the honest check: it
 * prices real nights with the rules as they now stand.
 */
export default function RateCalendarCard({
  rates,
  set,
}: {
  rates: RatesPolicy
  set: (patch: Partial<RatesPolicy>) => void
}) {
  const { rooms, reservations } = useHotel()
  // Demand events belong to revenue management. They only mark the nights here; they never price one.
  const { features } = useFeatures()
  const events = features.revenue ? (rates.events ?? []) : []
  const [type, setType] = useState<Room['type']>('Standard')
  const seasons = rates.seasons ?? []
  const dayRates = rates.dayRates ?? []
  const busy = rates.occupancyRates ?? []

  const setSeason = (id: string, patch: Partial<RateSeason>) =>
    set({ seasons: seasons.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const setDay = (id: string, patch: Partial<DayRate>) =>
    set({ dayRates: dayRates.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
  const setBusy = (id: string, patch: Partial<OccupancyRate>) =>
    set({ occupancyRates: busy.map((o) => (o.id === id ? { ...o, ...patch } : o)) })

  // Fourteen nights from today: long enough to show a weekend rule working, short enough to read.
  let end = TODAY
  for (let i = 0; i < 14; i++) end = nextDay(end)
  // The preview prices real nights against the bookings the hotel actually holds, not a guess.
  const sold = soldByNight(rooms, reservations, TODAY, end)
  // Night by night, with no stay rate: fourteen nights here are a list to read, not a stay.
  const preview = priceNights(type, TODAY, end, rates, (d) => sold[d], { lengthOfStay: false })
  const flat = (rates.roomRates[type] ?? 0) * preview.length
  const withCalendar = preview.reduce((n, p) => n + p.rate, 0)

  return (
    <Card
      title="Rate calendar"
      icon="calendar"
      padded
      description="Seasons and weekdays that change the published rate."
    >
      <div className="space-y-5">
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink/80">Seasons</p>
            <span className="text-xs text-ink/55">Read top to bottom. The first one that covers the night wins.</span>
          </div>
          <ul className="mt-2 space-y-2">
            {seasons.map((s) => (
              <li key={s.id} className="rounded-lg border border-ink/10 p-2.5">
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_7rem_6rem_5rem]">
                  <Input
                    value={s.name}
                    onChange={(e) => setSeason(s.id, { name: e.target.value })}
                    aria-label="Season name"
                    placeholder="December peak"
                  />
                  <select
                    value={s.type ?? ''}
                    onChange={(e) => setSeason(s.id, { type: (e.target.value || undefined) as Room['type'] })}
                    aria-label={`${s.name} room type`}
                    className={box}
                  >
                    <option value="">Every type</option>
                    {roomTypeList.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={s.from}
                    onChange={(e) => e.target.value && setSeason(s.id, { from: e.target.value })}
                    aria-label={`${s.name} from`}
                    className={box}
                  />
                  <input
                    type="date"
                    value={s.to}
                    onChange={(e) => e.target.value && setSeason(s.id, { to: e.target.value })}
                    aria-label={`${s.name} to`}
                    className={box}
                  />
                  <select
                    value={s.how}
                    onChange={(e) => setSeason(s.id, { how: e.target.value as Move })}
                    aria-label={`${s.name} how`}
                    className={box}
                  >
                    {MOVES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(s.value)}
                    onChange={(e) => setSeason(s.id, { value: num(e.target.value) })}
                    aria-label={`${s.name} value`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-ink/60">
                    {s.type ?? 'Every type'} · {dayMonth(s.from)} to {dayMonth(s.to)} · {describeMove(s)}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-ink/70">
                      <input type="checkbox" checked={s.on} onChange={(e) => setSeason(s.id, { on: e.target.checked })} />
                      On
                    </label>
                    <button
                      type="button"
                      className="font-semibold text-bad"
                      onClick={() => set({ seasons: seasons.filter((x) => x.id !== s.id) })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {seasons.length === 0 && <li className="text-xs text-ink/55">No seasons. Every night costs the published rate.</li>}
          </ul>
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                set({
                  seasons: [
                    ...seasons,
                    { id: newSeasonId(seasons), name: '', from: TODAY, to: TODAY, how: 'percent', value: 10, on: false },
                  ],
                })
              }
            >
              Add a season
            </Button>
          </div>
        </section>

        <section className="border-t border-ink/10 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink/80">Days of the week</p>
            <span className="text-xs text-ink/55">Applied after the season. Only one can apply to a night.</span>
          </div>
          <ul className="mt-2 space-y-2">
            {dayRates.map((d) => (
              <li key={d.id} className="rounded-lg border border-ink/10 p-2.5">
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_6rem]">
                  <Input
                    value={d.name}
                    onChange={(e) => setDay(d.id, { name: e.target.value })}
                    aria-label="Day rule name"
                    placeholder="Weekend"
                  />
                  <select
                    value={d.type ?? ''}
                    onChange={(e) => setDay(d.id, { type: (e.target.value || undefined) as Room['type'] })}
                    aria-label={`${d.name} room type`}
                    className={box}
                  >
                    <option value="">Every type</option>
                    {roomTypeList.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={d.how}
                    onChange={(e) => setDay(d.id, { how: e.target.value as Move })}
                    aria-label={`${d.name} how`}
                    className={box}
                  >
                    {MOVES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(d.value)}
                    onChange={(e) => setDay(d.id, { value: num(e.target.value) })}
                    aria-label={`${d.name} value`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((name, n) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={d.days.includes(n)}
                      onClick={() =>
                        setDay(d.id, { days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n].sort() })
                      }
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                        d.days.includes(n)
                          ? 'border-brand bg-brand/15 text-ink'
                          : 'border-ink/10 bg-surface text-ink/55 hover:border-brand/40'
                      }`}
                    >
                      {DAY_SHORT[n]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-ink/60">
                    {d.type ?? 'Every type'} ·{' '}
                    {d.days.length === 0 ? 'No days chosen, so it never applies' : d.days.map((n) => DAY_SHORT[n]).join(', ')} ·{' '}
                    {describeMove(d)}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-ink/70">
                      <input type="checkbox" checked={d.on} onChange={(e) => setDay(d.id, { on: e.target.checked })} />
                      On
                    </label>
                    <button
                      type="button"
                      className="font-semibold text-bad"
                      onClick={() => set({ dayRates: dayRates.filter((x) => x.id !== d.id) })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {dayRates.length === 0 && <li className="text-xs text-ink/55">Every day of the week costs the same.</li>}
          </ul>
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                set({
                  dayRates: [
                    ...dayRates,
                    { id: newDayRateId(dayRates), name: '', days: [5, 6], how: 'percent', value: 10, on: false },
                  ],
                })
              }
            >
              Add a day rule
            </Button>
          </div>
        </section>

        <section className="border-t border-ink/10 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink/80">When the house is filling</p>
            <span className="text-xs text-ink/55">The whole hotel that night, not the room type.</span>
          </div>
          <ul className="mt-2 space-y-2">
            {busy.map((o) => (
              <li key={o.id} className="rounded-lg border border-ink/10 p-2.5">
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem_7rem_6rem]">
                  <Input
                    value={o.name}
                    onChange={(e) => setBusy(o.id, { name: e.target.value })}
                    aria-label="Occupancy step name"
                    placeholder="Filling up"
                  />
                  <select
                    value={o.type ?? ''}
                    onChange={(e) => setBusy(o.id, { type: (e.target.value || undefined) as Room['type'] })}
                    aria-label={`${o.name} room type`}
                    className={box}
                  >
                    <option value="">Every type</option>
                    {roomTypeList.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(o.atLeast)}
                    onChange={(e) => setBusy(o.id, { atLeast: Math.min(100, Math.max(0, num(e.target.value))) })}
                    aria-label={`${o.name} percent sold`}
                  />
                  <select
                    value={o.how}
                    onChange={(e) => setBusy(o.id, { how: e.target.value as Move })}
                    aria-label={`${o.name} how`}
                    className={box}
                  >
                    {MOVES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(o.value)}
                    onChange={(e) => setBusy(o.id, { value: num(e.target.value) })}
                    aria-label={`${o.name} value`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-ink/60">
                    {o.type ?? 'Every type'} · from {o.atLeast}% sold · {describeMove(o)}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-ink/70">
                      <input type="checkbox" checked={o.on} onChange={(e) => setBusy(o.id, { on: e.target.checked })} />
                      On
                    </label>
                    <button
                      type="button"
                      className="font-semibold text-bad"
                      onClick={() => set({ occupancyRates: busy.filter((x) => x.id !== o.id) })}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {busy.length === 0 && <li className="text-xs text-ink/55">The rate does not move with how full the hotel is.</li>}
          </ul>
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                set({
                  occupancyRates: [
                    ...busy,
                    { id: newOccupancyRateId(busy), name: '', atLeast: 80, how: 'percent', value: 15, on: false },
                  ],
                })
              }
            >
              Add a step
            </Button>
          </div>
        </section>

        <section className="border-t border-ink/10 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-medium text-ink/80">The next fourteen nights</p>
            <Field label="Room type">
              {(id) => (
                <Select id={id} value={type} onChange={(e) => setType(e.target.value as Room['type'])} className="w-36">
                  {roomTypeList.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ul className="mt-2 space-y-1">
            {preview.map((p) => (
              <li key={p.date} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-ink/70">
                  {DAY_SHORT[dayOf(p.date)]} {dayMonth(p.date)}
                  {p.sold !== undefined && <span className="ml-2 text-xs text-ink/45">{p.sold}% sold</span>}
                  {eventsOn(events, p.date, type).map((e) => (
                    <span key={e.id} className="ml-2">
                      <Badge tone="info">Event: {e.name}</Badge>
                    </span>
                  ))}
                  {p.steps.length > 1 && (
                    <span className="ml-2 text-xs text-ink/50">{p.steps.slice(1).map((x) => x.label).join(' → ')}</span>
                  )}
                </span>
                <span className="tabular-nums font-medium text-ink/80">{ugx(p.rate)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2 text-sm">
            <span className="text-ink/65">Fourteen nights</span>
            <span className="flex items-center gap-2">
              {withCalendar !== flat && <span className="text-xs text-ink/50 line-through">{ugx(flat)}</span>}
              <span className="font-bold tabular-nums text-ink">{ugx(withCalendar)}</span>
              {withCalendar !== flat && (
                <Badge tone={withCalendar > flat ? 'good' : 'warn'}>
                  {withCalendar > flat ? '+' : '−'}
                  {ugx(Math.abs(withCalendar - flat))}
                </Badge>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/55">
            Room only. Existing bookings keep their price.
          </p>
          {events.length > 0 && (
            <p className="mt-1 text-xs text-ink/55">
              Events only move revenue suggestions, never prices.
            </p>
          )}
        </section>
      </div>
    </Card>
  )
}
