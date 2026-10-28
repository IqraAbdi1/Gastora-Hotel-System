import { useState } from 'react'
import { Badge, Button, Card, Field, Input } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { CATEGORY_LABEL, chargeOf } from '../../lib/services'
import type { ServiceBooking } from '../../lib/services'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useServiceBookings } from '../portal/useServiceBookings'

/**
 * Tables, treatments and trips guests booked from their own pages. The desk confirms or declines each
 * one (after a word with the restaurant, the spa or the guide), and a priced booking goes on the room
 * bill when there is a bill to put it on.
 */
export default function ServiceBookingsCard() {
  const { bookings, update } = useServiceBookings()
  const { reservations, addCharge } = useHotel()
  const { features } = useFeatures()
  const { user } = useAuth()
  const [refusing, setRefusing] = useState<string | null>(null)
  const [why, setWhy] = useState('')

  const waiting = bookings.filter((b) => b.state === 'requested')
  const inHouse = (b: ServiceBooking) => reservations.find((r) => r.id === b.reservationId)?.status === 'in-house'
  const unposted = bookings.filter((b) => b.state === 'confirmed' && b.price > 0 && !b.posted)
  const today = bookings
    .filter((b) => b.state === 'confirmed' && b.date === TODAY)
    .sort((a, b) => a.time.localeCompare(b.time))

  if (!features.serviceBookings || (waiting.length === 0 && unposted.length === 0 && today.length === 0)) return null

  const by = user?.staffName ?? user?.name ?? 'Front desk'

  function charge(b: ServiceBooking): boolean {
    const line = chargeOf(b)
    if (!line || !inHouse(b)) return false
    addCharge(b.reservationId, line)
    update(b.id, { posted: true })
    return true
  }

  function confirm(b: ServiceBooking, andCharge: boolean) {
    update(b.id, { state: 'confirmed', by, decidedAt: stamp() })
    if (andCharge) charge({ ...b, state: 'confirmed' })
  }

  function decline(id: string) {
    update(id, { state: 'declined', by, decidedAt: stamp(), reason: why.trim() || undefined })
    setRefusing(null)
    setWhy('')
  }

  const when = (b: ServiceBooking) => `${b.date === TODAY ? 'Today' : dayMonth(b.date)} at ${b.time}`

  return (
    <Card
      icon="calendar"
      title="Dining, spa and activities"
      count={waiting.length}
      description="Guest bookings to check and confirm."
      padded
    >
      {waiting.length > 0 ? (
        <ul className="space-y-2">
          {waiting.map((b) => (
            <li key={b.id} className="rounded-xl border border-ink/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {b.serviceName} <Badge tone="neutral">{CATEGORY_LABEL[b.category]}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-ink/80">
                    {when(b)} · {b.party} {b.party === 1 ? 'person' : 'people'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {b.guestName}
                    {b.room ? ` · Room ${b.room}` : ''} · {b.reservationId} · asked {b.at}
                  </p>
                  {b.notes && <p className="mt-1 text-xs text-ink/70">“{b.notes}”</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-ink">{b.price > 0 ? ugx(b.price) : 'Free'}</p>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {b.price > 0 && inHouse(b) ? (
                      <>
                        <Button size="sm" onClick={() => confirm(b, true)}>
                          Confirm and charge
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => confirm(b, false)}>
                          Confirm
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => confirm(b, false)}>
                        Confirm
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setRefusing(b.id)}>
                      Cannot
                    </Button>
                  </div>
                </div>
              </div>
              {refusing === b.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-[14rem] flex-1">
                    <Field label="What should the guest be told?">
                      {(id) => (
                        <Input id={id} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="The spa is fully booked; 15:00 is free" />
                      )}
                    </Field>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => decline(b.id)}>
                    Tell them
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/60">Nothing waiting for an answer.</p>
      )}

      {unposted.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Confirmed, not yet on a bill</p>
          <ul className="mt-1.5 space-y-1.5">
            {unposted.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink/75">
                  {b.guestName} · {b.serviceName} · {when(b)} · <span className="tabular-nums">{ugx(b.price)}</span>
                </span>
                {inHouse(b) ? (
                  <Button size="sm" variant="secondary" onClick={() => charge(b)}>
                    Charge to room
                  </Button>
                ) : (
                  <Badge tone="neutral">Bill opens at check-in</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {today.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Booked for today</p>
          <ul className="mt-1.5 space-y-1 text-sm text-ink/75">
            {today.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-semibold tabular-nums text-ink">{b.time}</span> {b.serviceName}
                </span>
                <span className="text-xs text-ink/60">
                  {b.guestName}
                  {b.room ? `, Room ${b.room}` : ''} · {b.party} {b.party === 1 ? 'person' : 'people'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-ink/45">
        <Badge tone="neutral">Rule</Badge> Places are held from the request. Declining frees them.
      </p>
    </Card>
  )
}
