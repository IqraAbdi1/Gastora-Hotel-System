import { useMemo, useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { soldByNight } from '../../lib/availability'
import { addDays, sellableBy } from '../../lib/channels'
import type { Channel } from '../../lib/channels'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { outOfLine, parityFor, PARITY_NOTE, PARITY_TONE } from '../../lib/parity'
import { DAY_SHORT, dayOf, priceNight } from '../../lib/rateCalendar'
import type { Room } from '../../types'
import { useFeatures } from '../platform/featuresContext'

const AHEAD = 14

/**
 * Where a channel is showing a different price from the hotel.
 *
 * Every figure here is sample, said plainly and repeatedly, because the alternative - a made-up number
 * presented as Booking.com's price - is one a hotelier might act on.
 */
export default function ParityCard({ channels }: { channels: Channel[] }) {
  const { rooms, reservations } = useHotel()
  const { options } = useFeatures()
  const [all, setAll] = useState(false)

  const sold = useMemo(() => soldByNight(rooms, reservations, TODAY, addDays(TODAY, AHEAD)), [rooms, reservations])
  const dates = useMemo(() => Array.from({ length: AHEAD }, (_, i) => addDays(TODAY, i)), [])

  const lines = useMemo(
    () =>
      parityFor(
        channels,
        dates,
        (type: Room['type'], date: string) => priceNight(type, date, options.rates, (d) => sold[d]).rate,
        (c) => sellableBy(c),
      ),
    [channels, dates, options.rates, sold],
  )
  const bad = outOfLine(lines)
  const under = bad.filter((l) => l.state === 'cheaper there')
  const shown = all ? bad : bad.slice(0, 8)

  if (channels.filter((c) => c.on).length === 0) return null

  return (
    <Card
      title="Rate parity"
      icon="alert"
      count={bad.length}
      padded
      description="Channel prices that differ from the hotel, next 14 days."
    >
      <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-xs text-ink/75">
        <p className="font-semibold text-ink">Sample figures, not live channel prices.</p>
      </div>

      {bad.length === 0 ? (
        <p className="mt-3 rounded-lg bg-good/[0.08] p-3 text-sm text-ink/75">
          Every channel is showing the hotel's own price for the next fortnight.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink/75">
            {under.length > 0 ? (
              <>
                <strong className="text-bad">{under.length}</strong> night
                {under.length === 1 ? ' is' : 's are'} cheaper on a channel than on the hotel's own site. Fix these first.
              </>
            ) : (
              'No channel is undercutting the hotel.'
            )}
          </p>

          <ul className="mt-3 space-y-1.5">
            {shown.map((l) => (
              <li
                key={`${l.channelId}-${l.type}-${l.date}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-ink">{l.channelName}</span>
                  <span className="ml-2 text-xs text-ink/55">
                    {l.type} · {DAY_SHORT[dayOf(l.date)]} {dayMonth(l.date)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-ink/60">
                    ours <span className="tabular-nums">{ugx(l.ours)}</span> · theirs{' '}
                    <span className="tabular-nums">{ugx(l.theirs)}</span>
                  </span>
                  <Badge tone={PARITY_TONE[l.state]} dot>
                    {l.gap < 0 ? '−' : '+'}
                    {ugx(Math.abs(l.gap))}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>

          {bad.length > shown.length && (
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
                Show the other {bad.length - shown.length}
              </Button>
            </div>
          )}

          <p className="mt-3 text-xs text-ink/55">{PARITY_NOTE[under.length > 0 ? 'cheaper there' : 'dearer there']}</p>
        </>
      )}
    </Card>
  )
}
