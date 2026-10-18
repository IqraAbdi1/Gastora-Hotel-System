import { useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, Select } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { adviseNight, DIRECTION_LABEL, DIRECTION_TONE, worthSaying } from '../../lib/rateAdvice'
import type { RateAdvice } from '../../lib/rateAdvice'
import type { NightPace } from '../../lib/pace'
import { DAY_SHORT, dayOf, newOverrideId, priceNight } from '../../lib/rateCalendar'
import type { RateOverride } from '../../lib/rateCalendar'
import { roomTypeList } from '../../lib/rates'
import { soldByNight } from '../../lib/availability'
import type { Room } from '../../types'
import { useAuth } from '../auth/authContext'
import { useHotel } from '../../lib/hotelContext'
import { useFeatures } from '../platform/featuresContext'

/**
 * What the system would do about the nights ahead, and why, for a person to accept or ignore.
 *
 * Nothing here changes a price. Approving writes one date's price, signed with the name of whoever
 * approved it, and that price then beats every rule in the calendar - including the rules that
 * produced the suggestion, which is what stops a hotel arguing with its own software.
 */
export default function RateAdviceCard({ nights }: { nights: NightPace[] }) {
  const { options, setOptions } = useFeatures()
  const { rooms, reservations } = useHotel()
  const { user } = useAuth()
  const [type, setType] = useState<Room['type']>('Standard')
  const [open, setOpen] = useState<RateAdvice | null>(null)

  const rates = options.rates
  const by = user?.name ?? 'Front desk'

  const advice = useMemo(() => {
    if (nights.length === 0) return []
    const last = nights[nights.length - 1].date
    const sold = soldByNight(rooms, reservations, nights[0].date, last)
    return worthSaying(
      nights.map((n) => adviseNight(n, priceNight(type, n.date, rates, (d) => sold[d]), type)),
    )
  }, [nights, rooms, reservations, rates, type])

  function approve(a: RateAdvice) {
    const override: RateOverride = {
      id: newOverrideId(rates.overrides ?? []),
      date: a.date,
      type: a.type,
      rate: a.suggested,
      by,
      at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      note: a.drivers.map((d) => d.text).join(' '),
    }
    setOptions({ rates: { ...rates, overrides: [...(rates.overrides ?? []), override] } })
    setOpen(null)
  }

  const settled = (rates.overrides ?? []).filter((o) => o.date >= (nights[0]?.date ?? ''))

  return (
    <Card
      title="Suggested rate changes"
      icon="money"
      count={advice.length}
      padded
      description="Rules reading pace and occupancy. Nothing changes until somebody approves it."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-ink/60">
          Each suggestion says what it rests on: a <strong className="text-ink/80">Rule</strong> is something counted,
          an <strong className="text-ink/80">Estimate</strong> is the forecast, which any conference nobody told us
          about will beat.
        </p>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as Room['type'])}
          aria-label="Room type"
          className="w-36"
        >
          {roomTypeList.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>

      {advice.length === 0 ? (
        <p className="mt-3 rounded-lg bg-good/[0.08] p-3 text-sm text-ink/75">
          Nothing to suggest for {type} rooms. Every night ahead is either filling the way this hotel usually fills,
          too far off to act on, or already priced by hand.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {advice.map((a) => (
            <li key={`${a.date}-${a.type}`} className="rounded-xl border border-ink/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {DAY_SHORT[dayOf(a.date)]} {dayMonth(a.date)}
                    <span className="ml-2 text-sm font-normal text-ink/55">
                      {a.daysOut === 0 ? 'tonight' : `${a.daysOut} days out`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink/75">
                    <span className="tabular-nums">{ugx(a.current)}</span>
                    <span className="mx-1.5 text-ink/40">→</span>
                    <span className="font-semibold tabular-nums text-ink">{ugx(a.suggested)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={DIRECTION_TONE[a.direction]} dot>
                    {DIRECTION_LABEL[a.direction]}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => setOpen(a)}>
                    Why
                  </Button>
                  <Button size="sm" onClick={() => approve(a)}>
                    Approve
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {settled.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Prices set by hand</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {settled.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink/70">
                  {dayMonth(o.date)} · {o.type} · <span className="tabular-nums">{ugx(o.rate)}</span>
                  <span className="ml-2 text-xs text-ink/50">
                    {o.by}, {o.at}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-bad"
                  onClick={() =>
                    setOptions({ rates: { ...rates, overrides: (rates.overrides ?? []).filter((x) => x.id !== o.id) } })
                  }
                >
                  Put it back
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink/55">
            A price set by hand beats every rule in the calendar. Putting it back returns the night to the rules.
          </p>
        </div>
      )}

      {open && (
        <Modal
          title={`${DAY_SHORT[dayOf(open.date)]} ${dayMonth(open.date)} · ${open.type}`}
          description={`${ugx(open.current)} now, ${ugx(open.suggested)} suggested`}
          onClose={() => setOpen(null)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Leave it
              </Button>
              <Button onClick={() => approve(open)}>Approve {ugx(open.suggested)}</Button>
            </div>
          }
        >
          <ul className="space-y-2">
            {open.drivers.map((d) => (
              <li key={d.text} className="flex gap-2 text-sm">
                <Badge tone={d.basis === 'Rule' ? 'neutral' : 'warn'}>{d.basis}</Badge>
                <span className="text-ink/75">{d.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink/55">
            Approving sets this one night's {open.type} price and signs it with your name. It does not change the
            published rate, the season, or any other night.
          </p>
        </Modal>
      )}
    </Card>
  )
}
