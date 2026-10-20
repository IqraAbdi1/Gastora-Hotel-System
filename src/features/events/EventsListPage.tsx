import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Chip, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth } from '../../lib/format'
import type { BookingInput, EventBooking } from '../../services/events/eventsTypes'
import { useCorporate } from '../corporate/corporateContext'
import { ErrorNote } from './ErrorNote'
import { BEO_STATUS_LABEL, BEO_STATUS_TONE, EVENT_STATUS_LABEL, EVENT_STATUS_TONE, EVENT_TYPES, EVENT_TYPE_LABEL, addDays, num } from './eventsUi'
import { useEvents, useRun } from './useEvents'

type Filter = 'upcoming' | 'tentative' | 'definite' | 'past' | 'cancelled'

export default function EventsListPage() {
  const { data } = useEvents()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [adding, setAdding] = useState(false)

  const upcoming = data.bookings.filter((b) => b.endDate >= TODAY && b.status !== 'cancelled')
  const match: Record<Filter, (b: EventBooking) => boolean> = {
    upcoming: (b) => b.endDate >= TODAY && b.status !== 'cancelled',
    tentative: (b) => b.status === 'tentative',
    definite: (b) => b.status === 'definite',
    past: (b) => b.endDate < TODAY && b.status !== 'cancelled',
    cancelled: (b) => b.status === 'cancelled',
  }
  const rows = data.bookings.filter(match[filter]).sort((a, b) => (filter === 'past' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)))
  const beoOf = (id: string) => data.beos.find((b) => b.eventBookingId === id)
  const soon = upcoming.filter((b) => b.startDate <= addDays(TODAY, 7))
  const unsigned = soon.filter((b) => beoOf(b.id)?.status !== 'signed')

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Events and sales"
        title="Events and BEOs"
        description="Every booked event with its banquet event order and resources."
        actions={<Button onClick={() => setAdding(true)}>New event</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Upcoming" value={String(upcoming.length)} icon="calendar" />
        <StatCard label="Next 7 days" value={String(soon.length)} hint={`${soon.reduce((s, b) => s + b.expectedGuests, 0)} guests`} icon="guests" />
        <StatCard label="Tentative" value={String(upcoming.filter((b) => b.status === 'tentative').length)} tone="warn" icon="alert" />
        <StatCard label="BEO not signed" value={String(unsigned.length)} hint="Events in 7 days" tone={unsigned.length ? 'bad' : 'default'} icon="tasks" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['upcoming', 'tentative', 'definite', 'past', 'cancelled'] as Filter[]).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)} count={data.bookings.filter(match[f]).length}>
            {f[0].toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </div>

      <Card padded={false}>
        <DataTable
          rows={rows}
          rowKey={(b) => b.id}
          onRowClick={(b) => navigate(`/events/bookings/${b.id}`)}
          empty={{ title: 'No events here' }}
          columns={[
            {
              key: 'name',
              header: 'Event',
              cell: (b) => (
                <div>
                  <p className="font-medium text-ink">{b.name}</p>
                  <p className="text-xs text-ink/55">{b.clientName}</p>
                </div>
              ),
            },
            { key: 'date', header: 'Dates', cell: (b) => (b.startDate === b.endDate ? dayMonth(b.startDate) : `${dayMonth(b.startDate)} to ${dayMonth(b.endDate)}`) },
            { key: 'type', header: 'Type', cell: (b) => EVENT_TYPE_LABEL[b.eventType], hideBelow: 'lg' },
            { key: 'pax', header: 'Guests', cell: (b) => b.guaranteedGuests ?? b.expectedGuests, align: 'right', hideBelow: 'md' },
            { key: 'status', header: 'Status', cell: (b) => <Badge tone={EVENT_STATUS_TONE[b.status]}>{EVENT_STATUS_LABEL[b.status]}</Badge> },
            {
              key: 'beo',
              header: 'BEO',
              hideBelow: 'sm',
              cell: (b) => {
                const beo = beoOf(b.id)
                return beo ? <Badge tone={BEO_STATUS_TONE[beo.status]}>{BEO_STATUS_LABEL[beo.status]}</Badge> : '—'
              },
            },
          ]}
        />
      </Card>

      {adding && <EventForm onClose={() => setAdding(false)} onSaved={(b) => navigate(`/events/bookings/${b.id}`)} />}
    </div>
  )
}

/** Create an event, or change its details. */
export function EventForm({ booking, onClose, onSaved }: { booking?: EventBooking; onClose: () => void; onSaved: (b: EventBooking) => void }) {
  const { service, actor, propertyId } = useEvents()
  const { accounts } = useCorporate()
  const { busy, error, run } = useRun()
  const [f, setF] = useState({
    name: booking?.name ?? '',
    eventType: booking?.eventType ?? 'meeting',
    companyId: booking?.companyId ?? '',
    clientName: booking?.clientName ?? '',
    contactName: booking?.contactName ?? '',
    contactPhone: booking?.contactPhone ?? '',
    startDate: booking?.startDate ?? addDays(TODAY, 14),
    endDate: booking?.endDate ?? addDays(TODAY, 14),
    expectedGuests: String(booking?.expectedGuests ?? ''),
    guaranteedGuests: booking?.guaranteedGuests === undefined ? '' : String(booking.guaranteedGuests),
    notes: booking?.notes ?? '',
  })
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const pickCompany = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    const c = a?.contacts.find((x) => x.active && x.canBook) ?? a?.contacts[0]
    set({ companyId: id, ...(a ? { clientName: a.name, contactName: c?.name ?? f.contactName, contactPhone: c?.phone ?? f.contactPhone } : {}) })
  }
  const save = async () => {
    const input: BookingInput = {
      name: f.name,
      eventType: f.eventType,
      companyId: f.companyId,
      clientName: f.clientName,
      contactName: f.contactName,
      contactPhone: f.contactPhone,
      startDate: f.startDate,
      endDate: f.endDate,
      expectedGuests: num(f.expectedGuests),
      ownerName: booking?.ownerName ?? actor.name,
      notes: f.notes,
    }
    const saved = await run(() =>
      booking
        ? service.updateBooking(booking.id, { ...input, guaranteedGuests: f.guaranteedGuests === '' ? undefined : num(f.guaranteedGuests) }, actor)
        : service.createBooking(propertyId, input, actor),
    )
    if (saved) onSaved(saved)
  }
  return (
    <Modal
      title={booking ? 'Event details' : 'New event'}
      onClose={onClose}
      side
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {booking ? 'Save' : 'Create event'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Event name" required>
          {(id) => <Input id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={f.eventType} onChange={(e) => set({ eventType: e.target.value as EventBooking['eventType'] })}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Company account">
            {(id) => (
              <Select id={id} value={f.companyId} onChange={(e) => pickCompany(e.target.value)}>
                <option value="">None</option>
                {accounts
                  .filter((a) => a.status === 'active' || a.id === f.companyId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Client" required>
          {(id) => <Input id={id} value={f.clientName} onChange={(e) => set({ clientName: e.target.value })} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact">{(id) => <Input id={id} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />}</Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start" required>
            {(id) => <Input id={id} type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} />}
          </Field>
          <Field label="End" required>
            {(id) => <Input id={id} type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Expected guests" required>
            {(id) => <Input id={id} inputMode="numeric" value={f.expectedGuests} onChange={(e) => set({ expectedGuests: e.target.value })} />}
          </Field>
          {booking && (
            <Field label="Guaranteed guests" hint="The number the client pays for">
              {(id) => <Input id={id} inputMode="numeric" value={f.guaranteedGuests} onChange={(e) => set({ guaranteedGuests: e.target.value })} />}
            </Field>
          )}
        </div>
        <Field label="Notes">{(id) => <Textarea id={id} rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
