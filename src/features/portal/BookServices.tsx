import { useState } from 'react'
import { Badge, Button, Field, Input, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import {
  bookingProblem,
  CATEGORY_LABEL,
  daysOfStay,
  newServiceBookingId,
  priceFor,
  slotsFor,
  STATE_LABEL,
} from '../../lib/services'
import type { BookableService, ServiceBooking } from '../../lib/services'
import type { Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import { useServiceBookings } from './useServiceBookings'

const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)
const priceLine = (s: BookableService) => (s.price > 0 ? `${ugx(s.price)}${s.per === 'person' ? ' each' : ''}` : 'Free to book')

const tone = (state: ServiceBooking['state']) =>
  state === 'confirmed' ? 'good' : state === 'requested' ? 'warn' : 'neutral'

/**
 * Booking a table, a treatment or a trip from the guest's page. Places are held while the hotel decides;
 * nothing is charged until the desk confirms it. See services.ts for the rules.
 */
export default function BookServices({ stay }: { stay: Reservation }) {
  const { options } = useFeatures()
  const { bookings, add, update } = useServiceBookings()
  const services = (options.services ?? []).filter((s) => s.on)
  const days = daysOfStay(stay.arrival, stay.departure, TODAY)
  const [picked, setPicked] = useState<string | null>(null)
  const [date, setDate] = useState(days[0] ?? '')
  const [time, setTime] = useState('')
  const [party, setParty] = useState(Math.min(stay.adults ?? 1, 2) || 1)
  const [notes, setNotes] = useState('')
  const [problem, setProblem] = useState('')

  const mine = bookings.filter((b) => b.reservationId === stay.id)
  if (services.length === 0 && mine.length === 0) return null

  const svc = services.find((s) => s.id === picked)
  const now = stamp().slice(11)
  const slots = svc && date ? slotsFor(svc, date, bookings, party, TODAY, now) : []

  function choose(id: string) {
    setPicked(id === picked ? null : id)
    setTime('')
    setProblem('')
    setNotes('')
    setDate(days[0] ?? '')
  }

  function send() {
    if (!svc) return
    const why = bookingProblem(svc, date, time, party, bookings, days)
    if (why) {
      setProblem(why)
      return
    }
    add({
      id: newServiceBookingId(bookings),
      at: stamp(),
      serviceId: svc.id,
      serviceName: svc.name,
      category: svc.category,
      reservationId: stay.id,
      guestName: stay.guest,
      room: stay.room ?? undefined,
      date,
      time,
      party,
      notes: notes.trim() || undefined,
      price: priceFor(svc, party),
      state: 'requested',
    })
    setPicked(null)
    setTime('')
    setNotes('')
    setProblem('')
  }

  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold text-ink">Book a table, a treatment or a trip</h2>
      <p className="mt-0.5 text-xs text-ink/60">
        Your place is held while the hotel confirms. Nothing is charged until they do.
      </p>

      {days.length > 0 && services.length > 0 && (
        <ul className="mt-3 space-y-2">
          {services.map((s) => (
            <li key={s.id} className={`rounded-xl border p-3.5 ${picked === s.id ? 'border-brand/40 bg-brand/[0.04]' : 'border-ink/10 bg-surface'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {s.name}
                    <Badge tone="neutral">{CATEGORY_LABEL[s.category]}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-ink/65">{s.blurb}</p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {minutes(s.durationMin)} · {priceLine(s)}
                  </p>
                </div>
                <Button size="sm" variant={picked === s.id ? 'ghost' : 'primary'} onClick={() => choose(s.id)}>
                  {picked === s.id ? 'Close' : 'Book'}
                </Button>
              </div>

              {picked === s.id && (
                <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Day">
                      {(id) => (
                        <Select
                          id={id}
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value)
                            setTime('')
                          }}
                        >
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {d === TODAY ? `Today, ${dayMonth(d)}` : dayMonth(d)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="How many people" hint={`Up to ${s.maxParty} on one booking.`}>
                      {(id) => (
                        <Input
                          id={id}
                          type="number"
                          min={1}
                          max={s.maxParty}
                          value={party}
                          onChange={(e) => {
                            setParty(Math.max(1, Math.min(s.maxParty, Number(e.target.value) || 1)))
                            setTime('')
                          }}
                        />
                      )}
                    </Field>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-ink/80">Time</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {slots.map((sl) => (
                        <button
                          key={sl.time}
                          type="button"
                          disabled={!sl.open}
                          onClick={() => setTime(sl.time)}
                          aria-pressed={time === sl.time}
                          className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            time === sl.time ? 'border-brand bg-brand text-white' : 'border-ink/15 bg-surface text-ink hover:border-brand/50'
                          }`}
                        >
                          <span className="font-semibold">{sl.time}</span>
                          <span className={`ml-1.5 text-xs ${time === sl.time ? 'text-white/80' : 'text-ink/55'}`}>
                            {sl.left === 0 ? 'full' : `${sl.left} left`}
                          </span>
                        </button>
                      ))}
                    </div>
                    {slots.length > 0 && slots.every((sl) => !sl.open) && (
                      <p className="mt-1.5 text-xs text-ink/60">No time left that day for {party}. Try another day.</p>
                    )}
                  </div>

                  <Field label="Anything we should know (optional)">
                    {(id) => (
                      <Textarea
                        id={id}
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={s.category === 'dining' ? 'A birthday, a high chair, by the window' : 'Allergies, a pickup from the room'}
                      />
                    )}
                  </Field>

                  {problem && <p className="text-sm font-medium text-bad">{problem}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" disabled={!time} onClick={send}>
                      Ask to book{priceFor(s, party) > 0 ? ` · ${ugx(priceFor(s, party))}` : ''}
                    </Button>
                    {priceFor(s, party) > 0 && (
                      <span className="text-xs text-ink/55">Goes on your room bill once confirmed.</span>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Your bookings</p>
          <ul className="mt-1.5 space-y-1.5">
            {mine.map((b) => (
              <li key={b.id} className="rounded-lg border border-ink/10 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{b.serviceName}</span>
                    <span className="ml-2 text-xs text-ink/55">
                      {dayMonth(b.date)} at {b.time} · {b.party} {b.party === 1 ? 'person' : 'people'}
                      {b.price > 0 ? ` · ${ugx(b.price)}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={tone(b.state)} dot={b.state === 'requested'}>
                      {STATE_LABEL[b.state]}
                    </Badge>
                    {(b.state === 'requested' || (b.state === 'confirmed' && !b.posted)) && b.date >= TODAY && (
                      <button type="button" className="text-xs font-semibold text-ink/55" onClick={() => update(b.id, { state: 'cancelled' })}>
                        Cancel
                      </button>
                    )}
                  </span>
                </div>
                {b.state === 'declined' && b.reason && <p className="mt-1 text-xs text-ink/60">{b.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
