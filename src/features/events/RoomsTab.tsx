import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, Field, Input, Select } from '../../components/ui'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { BILLING_LABEL, STATUS_LABEL, STATUS_TONE, blockCounts, defaultCovers, rateFor, roomsHeld } from '../../lib/groups'
import type { GroupBilling } from '../../lib/groups'
import { useHotel } from '../../lib/hotelContext'
import { nightlyRate } from '../../lib/rates'
import type { EventBooking } from '../../services/events/eventsTypes'
import type { Room } from '../../types'
import { useAuth } from '../auth/authContext'
import { useGroups } from '../groups/groupsContext'
import { useFeatures } from '../platform/featuresContext'
import { ErrorNote } from './ErrorNote'
import { addDays, num } from './eventsUi'
import { useEvents, useRun } from './useEvents'

const TYPES: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

// Bedrooms for the event live in Groups as an ordinary room block, so the rack, check-in and the
// group's master bill already understand them. This tab links one, or holds a new one.
export default function RoomsTab({ booking }: { booking: EventBooking }) {
  const { blocks, byId, create } = useGroups()
  const { reservations } = useHotel()
  const { features, options } = useFeatures()
  const { user } = useAuth()
  const { service, actor } = useEvents()
  const { busy, error, run, setError } = useRun()
  const [pick, setPick] = useState('')
  const [unlinking, setUnlinking] = useState(false)
  const [counts, setCounts] = useState<Record<Room['type'], string>>({ Standard: '', Deluxe: '', Suite: '' })
  const [rates, setRates] = useState<Record<Room['type'], string>>({ Standard: '', Deluxe: '', Suite: '' })
  const [billing, setBilling] = useState<GroupBilling>('master-room')
  const [arrival, setArrival] = useState(addDays(booking.startDate, -1))
  const [departure, setDeparture] = useState(addDays(booking.endDate, 1))

  if (!features.groups) return <Card><p className="text-sm text-ink/60">Room blocks need the Groups feature.</p></Card>

  const block = byId(booking.groupBlockId)
  if (block) {
    const c = blockCounts(reservations, block.id)
    const nights = Math.max(1, nightsBetween(block.arrival, block.departure))
    const value = block.rooms.reduce((s, r) => s + rateFor(block, r.type, nightlyRate(r.type, 0, options.rates)) * r.count * nights, 0)
    return (
      <Card
        title={block.name}
        icon="bed"
        actions={
          <>
            <Link to="/desk/groups" className="text-sm font-semibold text-brand hover:underline">
              Open in Groups
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setUnlinking(true)}>
              Unlink
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[block.status]} dot>
            {STATUS_LABEL[block.status]}
          </Badge>
          <span className="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-[11px] text-ink/70">{block.code}</span>
          <Badge tone="neutral">{BILLING_LABEL[block.billing]}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Rooms held" value={String(roomsHeld(block))} />
          <Stat label="Dates" value={`${dayMonth(block.arrival)} to ${dayMonth(block.departure)}`} />
          <Stat label="Named" value={`${c.named} of ${c.held}`} />
          <Stat label="Room value" value={ugx(value)} />
        </dl>
        <p className="mt-3 text-xs text-ink/55">{block.rooms.map((r) => `${r.count} ${r.type}`).join(' · ')}</p>
        <ErrorNote error={error} />
        {unlinking && (
          <ConfirmDialog
            title="Unlink the room block?"
            message="The rooms stay held in Groups. Only the link to this event is removed."
            confirmLabel="Unlink"
            onCancel={() => setUnlinking(false)}
            onConfirm={() => {
              setUnlinking(false)
              void run(() => service.linkGroupBlock(booking.id, null, actor))
            }}
          />
        )}
      </Card>
    )
  }

  const linkable = blocks.filter((b) => b.status !== 'cancelled' && b.status !== 'closed')
  const nights = Math.max(1, nightsBetween(arrival, departure))
  const total = TYPES.reduce((s, t) => s + (num(rates[t]) || nightlyRate(t, 0, options.rates)) * num(counts[t]) * nights, 0)

  const hold = async () => {
    const rooms = TYPES.filter((t) => num(counts[t]) > 0).map((t) => ({ type: t, count: num(counts[t]) }))
    if (rooms.length === 0) return setError('Say how many rooms of at least one type.')
    if (departure <= arrival) return setError('Departure must be after arrival.')
    const made = create(
      {
        name: booking.name,
        billing,
        accountId: booking.companyId,
        organiser: { name: booking.contactName || booking.clientName, phone: booking.contactPhone },
        arrival,
        departure,
        rooms,
        rates: Object.fromEntries(TYPES.filter((t) => num(rates[t]) > 0).map((t) => [t, num(rates[t])])),
        net: {},
        covers: defaultCovers(billing),
        cutOff: addDays(arrival, -7),
        note: `Event ${booking.id}`,
      },
      user?.name ?? actor.name,
    )
    await run(() => service.linkGroupBlock(booking.id, made.id, actor))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Link an existing block" icon="bed">
        {linkable.length === 0 ? (
          <p className="text-sm text-ink/60">No open room blocks in Groups.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Block">
                {(id) => (
                  <Select id={id} value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose…</option>
                    {linkable.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.code} · {roomsHeld(b)} rooms
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Button disabled={!pick || busy} onClick={() => run(() => service.linkGroupBlock(booking.id, pick, actor))}>
              Link
            </Button>
          </div>
        )}
      </Card>
      <Card title="Hold new rooms" icon="bed" description="Creates a block in Groups and links it here.">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Arrival">{(id) => <Input id={id} type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} />}</Field>
            <Field label="Departure">{(id) => <Input id={id} type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />}</Field>
          </div>
          {TYPES.map((t) => (
            <div key={t} className="grid grid-cols-[90px_1fr_1fr] items-end gap-2">
              <span className="pb-2 text-sm font-medium text-ink">{t}</span>
              <Field label="Rooms">{(id) => <Input id={id} inputMode="numeric" value={counts[t]} onChange={(e) => setCounts({ ...counts, [t]: e.target.value })} />}</Field>
              <Field label="Rate">
                {(id) => <Input id={id} inputMode="numeric" placeholder={String(nightlyRate(t, 0, options.rates))} value={rates[t]} onChange={(e) => setRates({ ...rates, [t]: e.target.value })} />}
              </Field>
            </div>
          ))}
          <Field label="Who pays">
            {(id) => (
              <Select id={id} value={billing} onChange={(e) => setBilling(e.target.value as GroupBilling)}>
                {(['master-all', 'master-room', 'each-guest'] as GroupBilling[]).map((b) => (
                  <option key={b} value={b}>
                    {BILLING_LABEL[b]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">
              {nights} night(s) · {ugx(total)}
            </span>
            <Button onClick={hold} disabled={busy}>
              Hold rooms
            </Button>
          </div>
          <ErrorNote error={error} />
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  )
}
