import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, Segmented } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { addDays, productionBy, productionTotals } from '../../lib/channels'
import type { Production } from '../../lib/channels'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'

type Window = 'ahead' | 'past'

/**
 * What each channel brought, and what the hotel kept of it.
 *
 * The hotel's own site and its own desk sit in the same table at zero commission, because the only way
 * to judge a channel is against what the hotel can do without one.
 */
export default function ProductionCard() {
  const { reservations } = useHotel()
  const [window, setWindow] = useState<Window>('past')

  const { from, to } = useMemo(
    () => (window === 'past' ? { from: addDays(TODAY, -90), to: TODAY } : { from: TODAY, to: addDays(TODAY, 90) }),
    [window],
  )
  const rows = useMemo(() => productionBy(reservations, from, to), [reservations, from, to])
  const totals = useMemo(() => productionTotals(rows), [rows])

  const columns: Column<Production>[] = [
    {
      key: 'name',
      header: 'Where it came from',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.name}</p>
          <p className="text-xs text-ink/55">
            {r.bookings} booking{r.bookings === 1 ? '' : 's'} · {r.roomNights} room night
            {r.roomNights === 1 ? '' : 's'}
            {r.lost > 0 && ` · ${r.lost} fell through`}
          </p>
        </div>
      ),
    },
    {
      key: 'money',
      header: 'Guests paid',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{ugx(r.money)}</span>,
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) =>
        r.direct ? (
          <Badge tone="good">none</Badge>
        ) : (
          <span className="tabular-nums text-bad">− {ugx(r.commission)}</span>
        ),
    },
    {
      key: 'net',
      header: 'Hotel kept',
      align: 'right',
      cell: (r) => <span className="font-semibold tabular-nums text-ink">{ugx(r.net)}</span>,
    },
    {
      key: 'perNight',
      header: 'A night',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => <span className="tabular-nums text-ink/70">{ugx(r.perNight)}</span>,
    },
    {
      key: 'share',
      header: 'Share',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => (
        <span className="tabular-nums text-ink/60">
          {totals.net ? Math.round((r.net / totals.net) * 100) : 0}%
        </span>
      ),
    },
  ]

  return (
    <Card
      title="What each channel brought"
      icon="money"
      count={rows.length}
      padded={false}
      description="The hotel's own site and desk are in the same table, at no commission."
    >
      <div className="p-4 pb-0">
        <Segmented
          label="Period"
          value={window}
          onChange={(v) => setWindow(v as Window)}
          options={[
            { key: 'past', label: 'Arrived, last 90 days' },
            { key: 'ahead', label: 'Arriving, next 90 days' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-sm text-ink/55">No stays in this period.</p>
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} />
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-ink/10 p-4 text-sm">
            <span className="text-ink/65">
              {totals.bookings} booking{totals.bookings === 1 ? '' : 's'} · {totals.roomNights} room nights
              {totals.lost > 0 && ` · ${totals.lost} fell through`}
            </span>
            <span className="flex flex-wrap items-baseline gap-4">
              <span className="text-ink/65">
                Guests paid <span className="font-semibold tabular-nums text-ink">{ugx(totals.money)}</span>
              </span>
              <span className="text-ink/65">
                Commission <span className="font-semibold tabular-nums text-bad">{ugx(totals.commission)}</span>
              </span>
              <span className="text-ink/65">
                Kept <span className="font-bold tabular-nums text-ink">{ugx(totals.net)}</span>
              </span>
            </span>
          </div>
          <p className="px-4 pb-4 text-xs text-ink/55">
            Commission took {totals.costPercent}% of what guests paid in this period.
          </p>
        </>
      )}
    </Card>
  )
}
