import { useMemo } from 'react'
import { Badge, Card, DataTable, EmptyState, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { KIND_LABEL, downWords, downtimeTotals, roomDowntime } from '../../lib/downtime'
import type { RoomDown } from '../../lib/downtime'
import { priceNight } from '../../lib/rateCalendar'
import { useHotel } from '../../lib/hotelContext'
import type { Room } from '../../types'
import { useNow } from '../../lib/useNow'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'

/**
 * What the rooms off sale have cost.
 *
 * The figure is the room's own price for the nights it could not be sold. It is the most those nights
 * could have been worth, not money taken out of the bank: on a night the hotel did not sell out, the
 * room might not have sold anyway. The card says that rather than letting a manager read it as a loss.
 */
export default function DowntimeCard() {
  const { rooms } = useHotel()
  const { options, stayTimes } = useFeatures()
  const { spells } = useHousekeeping()
  const now = useNow(60000)

  const rateFor = useMemo(
    () => (type: string, date: string) => priceNight(type as Room['type'], date, options.rates).rate,
    [options.rates],
  )

  const rows = useMemo(
    () => roomDowntime(spells, rooms, rateFor, stayTimes.checkInTime, now),
    [spells, rooms, rateFor, stayTimes.checkInTime, now],
  )
  const totals = downtimeTotals(rows)

  const columns: Column<RoomDown>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: (r) => (
        <>
          <p className="font-semibold text-ink">Room {r.room}</p>
          <p className="text-xs text-ink/60">{r.type}</p>
        </>
      ),
    },
    {
      key: 'spells',
      header: 'Times off sale',
      hideBelow: 'sm',
      cell: (r) => (
        <>
          <p className="text-ink/70">{r.spells.length}</p>
          <p className="text-xs text-ink/55">
            Last {dayMonth(r.spells[0].fromIso.slice(0, 10))} · {KIND_LABEL[r.spells[0].kind]}
          </p>
        </>
      ),
    },
    { key: 'hours', header: 'Off sale for', align: 'right', cell: (r) => <span className="tabular-nums text-ink/70">{downWords(r.hours)}</span> },
    {
      key: 'nights',
      header: 'Nights lost',
      align: 'right',
      cell: (r) => <span className="tabular-nums font-semibold">{r.nights.length}</span>,
    },
    {
      key: 'worth',
      header: 'Could have earned',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => <span className="tabular-nums text-ink/70">{r.worth > 0 ? ugx(r.worth) : '—'}</span>,
    },
    { key: 'open', header: '', align: 'right', cell: (r) => (r.open ? <Badge tone="bad">Off sale now</Badge> : null) },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Nights lost" icon="calendar" value={String(totals.nights)} hint="Rooms that could not be sold" tone={totals.nights > 0 ? 'warn' : 'default'} />
        <StatCard label="Rooms affected" icon="bed" value={String(totals.rooms)} hint="Have been off sale" />
        <StatCard label="Off sale now" icon="alert" value={String(totals.open)} hint="Still not sellable" tone={totals.open > 0 ? 'bad' : 'default'} />
        <StatCard label="Could have earned" icon="money" value={ugx(totals.worth)} hint="At the rooms' own rates" />
      </div>

      <Card
        title="Downtime"
        icon="money"
        count={rows.length}
        description="A night counts when the room was still off sale at check-in time, so a tap fixed before lunch costs nothing."
        padded={false}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No room has been off sale"
            hint="A room taken out of order or out of service is counted from the moment it leaves sale."
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.room} />
        )}
        <p className="border-t border-ink/10 px-4 py-3 text-xs text-ink/60">
          <Badge tone="brand">Estimate</Badge>{' '}
          <span className="ml-1">
            The money is the room&apos;s own price for those nights, as of {dayMonth(TODAY)}. It is the most they
            could have been worth, not money taken out of the bank: on a night the hotel did not sell out, the room
            might not have sold anyway.
          </span>
        </p>
      </Card>
    </div>
  )
}
