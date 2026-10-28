import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Select } from '../../components/ui'
import { ugx } from '../../lib/format'
import { availableOn } from '../../services/events/eventsRules'
import type { EventBooking, EventsData, ResourceBooking } from '../../services/events/eventsTypes'
import { ErrorNote } from './ErrorNote'
import { EQUIPMENT_LABEL, eventDays, num, shortDate } from './eventsUi'
import { useEvents, useRun } from './useEvents'

// Projectors, PA, staging, decor and the people who run them, booked by day against what the hotel has.
export default function ResourcesTab({ booking, data, closed }: { booking: EventBooking; data: EventsData; closed: boolean }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const days = eventDays(booking)
  const [equipmentId, setEquipmentId] = useState(data.equipment[0]?.id ?? '')
  const [date, setDate] = useState(days[0])
  const [qty, setQty] = useState('1')
  const [removing, setRemoving] = useState<ResourceBooking | null>(null)

  const live = new Set(data.bookings.filter((b) => b.status !== 'cancelled').map((b) => b.id))
  const rows = data.resourceBookings.filter((r) => r.eventBookingId === booking.id).sort((a, b) => a.date.localeCompare(b.date))
  const item = (id: string) => data.equipment.find((e) => e.id === id)
  const chosen = item(equipmentId)
  const free = chosen ? availableOn(chosen, date, data.resourceBookings, live) : 0
  const total = rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
  const cost = rows.reduce((s, r) => s + r.quantity * r.unitCost, 0)

  const add = async () => {
    if (await run(() => service.bookResource(booking.id, equipmentId, date, num(qty), actor))) setQty('1')
  }

  return (
    <div className="space-y-4">
      {!closed && (
        <Card title="Book equipment or staff" icon="tasks">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_100px_auto] sm:items-end">
            <Field label="Item">
              {(id) => (
                <Select id={id} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
                  {(['av', 'furniture', 'decor', 'staff'] as const).map((c) => (
                    <optgroup key={c} label={EQUIPMENT_LABEL[c]}>
                      {data.equipment
                        .filter((e) => e.category === c)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} · {ugx(e.dailyRate)}/day
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Day">
              {(id) => (
                <Select id={id} value={date} onChange={(e) => setDate(e.target.value)}>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {shortDate(d)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Qty">{(id) => <Input id={id} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
            <Button onClick={add} disabled={busy || !chosen}>
              Book
            </Button>
          </div>
          {chosen && (
            <p className={`mt-2 text-sm ${free < num(qty) ? 'font-semibold text-bad' : 'text-ink/65'}`}>
              {Math.max(0, free)} of {chosen.quantityOwned} free on {shortDate(date)}
            </p>
          )}
          <div className="mt-2">
            <ErrorNote error={error} />
          </div>
        </Card>
      )}

      <Card title="Booked" count={rows.length} padded={false} description={`${ugx(total)} · cost ${ugx(cost)}`}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty={{ title: 'Nothing booked' }}
          columns={[
            { key: 'd', header: 'Day', cell: (r) => shortDate(r.date) },
            { key: 'i', header: 'Item', cell: (r) => <span className="font-medium text-ink">{item(r.equipmentId)?.name}</span> },
            { key: 'c', header: 'Kind', cell: (r) => <Badge tone={item(r.equipmentId)?.category === 'staff' ? 'info' : 'neutral'}>{EQUIPMENT_LABEL[item(r.equipmentId)?.category ?? 'av']}</Badge>, hideBelow: 'md' },
            { key: 'q', header: 'Qty', cell: (r) => r.quantity, align: 'right' },
            {
              key: 'f',
              header: 'Free that day',
              hideBelow: 'sm',
              align: 'right',
              cell: (r) => {
                const e = item(r.equipmentId)
                return e ? `${availableOn(e, r.date, data.resourceBookings, live)} of ${e.quantityOwned}` : '—'
              },
            },
            { key: 't', header: 'Total', cell: (r) => ugx(r.quantity * r.unitPrice), align: 'right' },
            {
              key: 'x',
              header: '',
              cell: (r) =>
                !closed && (
                  <button type="button" className="text-xs font-semibold text-bad hover:underline" onClick={() => setRemoving(r)}>
                    Release
                  </button>
                ),
            },
          ]}
        />
      </Card>
      {removing && (
        <ConfirmDialog
          title="Release this booking?"
          message={`${item(removing.equipmentId)?.name} × ${removing.quantity} on ${shortDate(removing.date)}.`}
          confirmLabel="Release"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const r = removing
            setRemoving(null)
            void run(() => service.removeResource(r.id, actor))
          }}
        />
      )}
    </div>
  )
}
