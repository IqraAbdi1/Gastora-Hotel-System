import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { soldByNight } from '../../lib/availability'
import { displacementOf, VERDICT_NOTE, VERDICT_TONE } from '../../lib/displacement'
import type { GroupAsk } from '../../lib/displacement'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { buildUpCurve, curveIsThin, paceForNight } from '../../lib/pace'
import type { NightPace } from '../../lib/pace'
import { DAY_SHORT, dayOf, priceNight } from '../../lib/rateCalendar'
import { nightsOfStay } from '../../lib/rateRules'
import type { Room } from '../../types'
import { useFeatures } from '../platform/featuresContext'

/**
 * What a block keeps out, shown where the decision is made rather than in a report read afterwards.
 *
 * It stays quiet until there is something to weigh: no rooms asked for, no dates, nothing to say.
 */
export default function DisplacementCard({ ask, arrival, departure }: { ask: GroupAsk[]; arrival: string; departure: string }) {
  const { reservations, rooms } = useHotel()
  const { options } = useFeatures()
  const [open, setOpen] = useState(false)

  const asked = ask.reduce((n, a) => n + a.count, 0)
  const dates = nightsOfStay(arrival, departure)

  const result = useMemo(() => {
    if (asked === 0 || dates.length === 0) return null
    const curve = curveIsThin(reservations, TODAY) ? [] : buildUpCurve(reservations, TODAY)
    const pace: Record<string, NightPace> = {}
    for (const d of dates) pace[d] = paceForNight(reservations, rooms, d, TODAY, curve)
    const sold = soldByNight(rooms, reservations, dates[0], departure)
    const rateFor = (type: Room['type'], date: string) => priceNight(type, date, options.rates, (d) => sold[d]).rate
    return displacementOf(ask, arrival, departure, pace, rateFor)
  }, [ask, asked, arrival, departure, dates, reservations, rooms, options.rates])

  if (!result) return null

  const { verdict, groupMoney, lostMoney, net, tightNights, nights, known } = result

  return (
    <section className="rounded-xl border border-ink/10 bg-linear-to-br from-brand/[0.07] to-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">What this block keeps out</p>
          <p className="mt-0.5 text-xs text-ink/60">
            {asked} room{asked === 1 ? '' : 's'} a night, {nights.length} night{nights.length === 1 ? '' : 's'}
          </p>
        </div>
        <Badge tone={VERDICT_TONE[verdict]} dot={known}>
          {verdict}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'The group pays', value: ugx(groupMoney), tone: 'text-ink' },
          { label: 'Business kept out', value: known ? ugx(lostMoney) : '—', tone: 'text-ink/70' },
          {
            label: 'Difference',
            value: known ? `${net < 0 ? '− ' : ''}${ugx(Math.abs(net))}` : '—',
            tone: !known ? 'text-ink/40' : net < 0 ? 'text-bad' : 'text-good',
          },
        ].map((cell) => (
          <div key={cell.label} className="rounded-lg bg-surface/80 px-2.5 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{cell.label}</dt>
            <dd className={`mt-0.5 text-base font-bold tabular-nums ${cell.tone}`}>{cell.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2.5 text-xs text-ink/70">{VERDICT_NOTE[verdict]}</p>

      {known && (
        <>
          <p className="mt-1 text-xs text-ink/55">
            {tightNights === 0
              ? 'Every night has room to spare for this block.'
              : `On ${tightNights} of ${nights.length} night${nights.length === 1 ? '' : 's'} the block needs more rooms than are spare.`}
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="mt-2 text-xs font-semibold text-brand"
            aria-expanded={open}
          >
            {open ? 'Hide the nights' : 'Show the nights'}
          </button>
        </>
      )}

      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/50">
                <th className="py-1.5 pr-2 font-semibold">Night</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Sold now</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Would reach</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Pushed out</th>
                <th className="py-1.5 text-right font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {nights.map((n) => (
                <tr key={n.date} className={`border-b border-ink/5 ${n.displaced > 0 ? 'bg-warn/[0.06]' : ''}`}>
                  <td className="py-1.5 pr-2 text-ink/75">
                    {DAY_SHORT[dayOf(n.date)]} {dayMonth(n.date)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink/65">
                    {n.onBooks}/{n.sellable}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink/65">
                    {n.forecast === undefined ? '—' : `${n.forecast}/${n.sellable}`}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink/80">{n.displaced || '—'}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink/80">
                    {n.lostMoney > 0 ? ugx(n.lostMoney) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-ink/50">
            Amber rows: nights the block displaces paying guests.
          </p>
        </div>
      )}
    </section>
  )
}
