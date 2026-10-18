import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { freeByType } from '../../lib/booking'
import { stamp } from '../../lib/folio'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { REQUEST_LABEL, REQUEST_TONE, incoming, newRequestId, outgoing } from '../../lib/crs'
import type { CrossRequest } from '../../lib/crs'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import type { Room } from '../../types'

const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

// The group's booking office. A property that is full sends the guest to a sister property instead of
// losing them to whoever answers the phone next.
export default function CrsPage() {
  const { tenant, tenants } = useFeatures()
  const { rooms, reservations, addReservation } = useHotel()
  const { user } = useAuth()
  const [requests, setRequests] = useBrowserSyncedState<CrossRequest[]>('gastora:crs:requests', [])
  const [asking, setAsking] = useState<string | null>(null)
  const [arrival, setArrival] = useState(TODAY)
  const [departure, setDeparture] = useState(TODAY)
  const [type, setType] = useState<Room['type']>('Standard')

  const me = user?.name ?? 'Front desk'
  const sisters = tenants.filter((t) => t.group && t.group === tenant.group && t.id !== tenant.id)
  const here = useMemo(() => freeByType(rooms, reservations, arrival, departure), [rooms, reservations, arrival, departure])
  const mine = incoming(requests, tenant.id)
  const sent = outgoing(requests, tenant.id)

  function accept(req: CrossRequest) {
    const made = addReservation({
      guest: req.guest,
      roomType: req.roomType,
      room: null,
      arrival: req.arrival,
      departure: req.departure,
      total: 0,
      paid: 0,
      source: 'phone',
      adults: req.adults,
    })
    setRequests((list) => list.map((r) => (r.id === req.id ? { ...r, state: 'accepted', bookingId: made.id } : r)))
  }

  if (!tenant.group) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Front desk" title="Sister properties" />
        <Card title="This hotel stands on its own" padded>
          <p className="text-sm text-ink/70">
            It is not part of an owner's group, so there is nowhere to send a booking. Gastora sets the owner when the hotel signs up.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Sister properties"
        description={`${tenant.group}. They see each other's free rooms and nothing else.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Properties" value={String(sisters.length + 1)} hint={tenant.group} />
        <StatCard label="Asked of us" value={String(mine.filter((r) => r.state === 'sent').length)} tone={mine.some((r) => r.state === 'sent') ? 'warn' : 'default'} hint="Waiting for an answer" />
        <StatCard label="We asked" value={String(sent.filter((r) => r.state === 'sent').length)} hint="Sent to a sister property" />
      </div>

      <Card title="Who has room" description="For these dates, across the owner's hotels." padded>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Arrival">{(id) => <Input id={id} type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} />}</Field>
          <Field label="Departure">{(id) => <Input id={id} type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />}</Field>
          <Field label="Room type">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as Room['type'])}>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <ul className="mt-4 space-y-2">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand/[0.05] p-3">
            <div>
              <p className="text-sm font-semibold text-ink">{tenant.name}</p>
              <p className="text-xs text-ink/60">This hotel · {tenant.registry?.town ?? 'here'}</p>
            </div>
            <Badge tone={here[type] > 0 ? 'good' : 'bad'} dot>
              {here[type] > 0 ? `${here[type]} ${type} free` : `No ${type} free`}
            </Badge>
          </li>
          {sisters.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 p-3">
              <div>
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-ink/60">
                  {s.registry?.town ?? 'Another town'} · {s.rooms} rooms
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">Ask them</Badge>
                <Button size="sm" variant="secondary" onClick={() => setAsking(s.id)}>
                  Send this booking
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink/55">
          In this prototype every demonstration hotel shares one set of rooms, so only this property's figure is real. A sister property is
          asked rather than read, which is also how a careful group works across two systems: the other hotel answers for its own rooms.
        </p>
      </Card>

      {mine.length > 0 && (
        <Card title="Asked of us" icon="alert" count={mine.filter((r) => r.state === 'sent').length} padded>
          <ul className="space-y-2">
            {mine.map((r) => (
              <li key={r.id} className="rounded-xl border border-ink/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.guest}</p>
                    <p className="text-xs text-ink/65">
                      {r.roomType} · {dayMonth(r.arrival)} to {dayMonth(r.departure)} · {r.adults} adult(s) · from {r.fromTenantName} · {r.by},{' '}
                      {r.at}
                    </p>
                    {r.note && <p className="mt-0.5 text-xs text-ink/55">{r.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={REQUEST_TONE[r.state]} dot>
                      {REQUEST_LABEL[r.state]}
                    </Badge>
                    {r.state === 'sent' && (
                      <>
                        <Button size="sm" onClick={() => accept(r)}>
                          Take it
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRequests((list) => list.map((x) => (x.id === r.id ? { ...x, state: 'declined', reason: 'Nothing free' } : x)))}
                        >
                          We cannot
                        </Button>
                      </>
                    )}
                    {r.bookingId && <span className="text-xs text-ink/55">{r.bookingId}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sent.length > 0 && (
        <Card title="We asked" padded>
          <ul className="space-y-1.5 text-sm">
            {sent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 pb-1.5 last:border-0">
                <span className="text-ink/75">
                  {r.guest} · {r.roomType} · {dayMonth(r.arrival)} to {dayMonth(r.departure)} ·{' '}
                  {tenants.find((t) => t.id === r.toTenantId)?.name ?? r.toTenantId}
                </span>
                <Badge tone={REQUEST_TONE[r.state]} dot>
                  {REQUEST_LABEL[r.state]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {asking && (
        <AskDialog
          toName={tenants.find((t) => t.id === asking)?.name ?? ''}
          arrival={arrival}
          departure={departure}
          type={type}
          onClose={() => setAsking(null)}
          onSend={(guest, phone, adults, note) => {
            setRequests((list) => [
              {
                id: newRequestId(list),
                fromTenantId: tenant.id,
                fromTenantName: tenant.name,
                toTenantId: asking,
                guest,
                phone,
                roomType: type,
                arrival,
                departure,
                adults,
                note,
                at: stamp(),
                by: me,
                state: 'sent',
              },
              ...list,
            ])
            setAsking(null)
          }}
        />
      )}
    </div>
  )
}

function AskDialog({
  toName,
  arrival,
  departure,
  type,
  onClose,
  onSend,
}: {
  toName: string
  arrival: string
  departure: string
  type: Room['type']
  onClose: () => void
  onSend: (guest: string, phone: string, adults: number, note: string) => void
}) {
  const [guest, setGuest] = useState('')
  const [phone, setPhone] = useState('')
  const [adults, setAdults] = useState(1)
  const [note, setNote] = useState('')
  return (
    <Modal
      title={`Send this booking to ${toName}`}
      description={`${type} · ${dayMonth(arrival)} to ${dayMonth(departure)}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={guest.trim().length < 2} onClick={() => onSend(guest.trim(), phone.trim(), adults, note.trim())}>
            Send it
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name" required>{(id) => <Input id={id} value={guest} onChange={(e) => setGuest(e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        <Field label="Adults">
          {(id) => <Input id={id} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />}
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Anything they should know">
          {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Arriving late, needs airport pickup" />}
        </Field>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        The other hotel answers for its own rooms: it can take this or say it cannot. Nothing of this hotel's guests, bills or takings goes
        with it.
      </p>
    </Modal>
  )
}
