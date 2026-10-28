import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Field, Modal, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { soldByNight } from '../../lib/availability'
import { folioOf, stamp } from '../../lib/folio'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { tokenFor } from '../../lib/preRegistration'
import { OFFER_LABEL, offersFor } from '../../lib/upsell'
import type { Offer } from '../../lib/upsell'
import GuestFeedbackForm from '../feedback/GuestFeedbackForm'
import { useFeatures } from '../platform/featuresContext'
import { slugOf } from '../../lib/bookingEngine'
import { canPayFor } from '../../lib/portalPay'
import type { GuestPayment } from '../../lib/portalPay'
import BookServices from './BookServices'
import CheckoutOnline from './CheckoutOnline'
import PayNow, { Receipt } from './PayNow'
import { usePortalPayments } from './usePortalPayments'
import { newRequestId, useGuestRequests } from './useGuestRequests'
import ConciergeWidget from '../automation/ConciergeWidget'

/**
 * The guest's own page for their stay.
 *
 * One link, sent by the hotel, that holds everything a guest would otherwise telephone the desk about:
 * when they are expected, what they owe, the form that saves time at check-in, anything they want to
 * ask for, and what the hotel can offer them.
 *
 * No sign-in, because a guest has none, and nothing on it about any other guest. Accepting an offer
 * asks the hotel; it does not charge anybody and does not move a room. A room free a moment ago may be
 * taken by the time the desk reads it, and only a person can say.
 */
export default function StayPage() {
  const { token = '' } = useParams()
  const { reservations, rooms, guests } = useHotel()
  const { tenant, options, features, stayTimes } = useFeatures()
  const { requests, add } = useGuestRequests()
  const [asking, setAsking] = useState('')
  const [said, setSaid] = useState('')
  const [paying, setPaying] = useState(false)
  const [showing, setShowing] = useState<GuestPayment | null>(null)
  const { payments } = usePortalPayments()

  const stay = useMemo(() => reservations.find((r) => tokenFor(r.id, r.arrival) === token), [reservations, token])

  const sold = useMemo(
    () => (stay ? soldByNight(rooms, reservations, stay.arrival, stay.departure) : {}),
    [stay, rooms, reservations],
  )

  const offers = useMemo(
    () =>
      stay && features.guestPortal
        ? offersFor(stay, rooms, reservations, options.rates, options.addOns ?? [], options.upsell, (d) => sold[d])
        : [],
    [stay, features.guestPortal, rooms, reservations, options.rates, options.addOns, options.upsell, sold],
  )

  if (!stay || stay.status === 'cancelled') {
    return (
      <Shell hotel={tenant.name}>
        <p className="text-sm text-ink/70">
          This link is no longer open. If you are expecting to stay with us, please telephone the hotel.
        </p>
      </Shell>
    )
  }

  const f = folioOf(stay)
  const nights = nightsBetween(stay.arrival, stay.departure)
  const guest = guests.find((g) => g.id === stay.guestId)
  const mine = requests.filter((r) => r.reservationId === stay.id)
  const already = (offerId: string) => mine.some((r) => r.offerId === offerId && r.state !== 'declined')
  const left = stay.status === 'checked-out'
  const paidHere = payments.filter((p) => p.reservationId === stay.id)
  const canPay = features.guestPortal && canPayFor(stay) && f.balance > 0

  function ask(offer: Offer) {
    add({
      id: newRequestId(requests),
      at: stamp(),
      reservationId: stay!.id,
      guestId: stay!.guestId,
      guestName: stay!.guest,
      room: stay!.room ?? undefined,
      kind: 'offer',
      offerId: offer.id,
      offerKind: offer.kind,
      title: offer.title,
      price: offer.price,
      state: 'new',
    })
  }

  function askFor() {
    if (asking.trim().length < 3) return
    add({
      id: newRequestId(requests),
      at: stamp(),
      reservationId: stay!.id,
      guestId: stay!.guestId,
      guestName: stay!.guest,
      room: stay!.room ?? undefined,
      kind: 'ask',
      title: 'Asked the desk for something',
      detail: asking.trim(),
      state: 'new',
    })
    setSaid(asking.trim())
    setAsking('')
  }

  return (
    <Shell hotel={tenant.name}>
      <section className="rounded-xl border border-ink/10 bg-linear-to-br from-brand/[0.07] to-surface p-4">
        <p className="text-sm font-semibold text-ink">
          {left ? 'Thank you for staying with us' : stay.status === 'in-house' ? 'You are with us now' : 'We are expecting you'}
        </p>
        <p className="mt-1 text-lg font-bold text-ink">
          {dayMonth(stay.arrival)} to {dayMonth(stay.departure)}
        </p>
        <p className="mt-0.5 text-sm text-ink/65">
          {nights} night{nights === 1 ? '' : 's'} · {stay.room ? `Room ${stay.room}` : stay.roomType}
          {stay.status === 'booked' && ` · check-in from ${stayTimes.checkInTime}`}
          {stay.status === 'in-house' && ` · check-out by ${stayTimes.checkOutTime}`}
        </p>
        {guest?.vip && (
          <p className="mt-2">
            <Badge tone="warn">We are glad to have you back</Badge>
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Box
          title="Your bill"
          value={f.balance > 0 ? ugx(f.balance) : 'Nothing to pay'}
          hint={f.balance > 0 ? `${ugx(f.paid)} paid so far` : 'Settled in full'}
          to={`/bill/${token}`}
          action="See the bill"
          extra={
            canPay ? (
              <Button size="sm" onClick={() => setPaying(true)}>
                Pay now
              </Button>
            ) : undefined
          }
        />
        {stay.status === 'booked' && (
          <Box
            title="Before you arrive"
            value="Save time at the desk"
            hint="Fill in your details and we will have them ready."
            to={`/arrive/${token}`}
            action="Fill it in"
          />
        )}
      </div>

      <CheckoutOnline stay={stay} token={token} onPay={() => setPaying(true)} />

      {!left && offers.length > 0 && (
        <section className="mt-5">
          <h2 className="text-base font-semibold text-ink">Would you like anything else?</h2>
          <p className="mt-0.5 text-xs text-ink/60">
            Ask for it here and the desk will confirm. Nothing is charged until they do.
          </p>
          <ul className="mt-3 space-y-2">
            {offers.map((o) => {
              const asked = already(o.id)
              return (
                <li
                  key={o.id}
                  className={`rounded-xl border p-3.5 ${asked ? 'border-good/30 bg-good/[0.06]' : 'border-ink/10 bg-surface'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {o.title}
                        <Badge tone="neutral">{OFFER_LABEL[o.kind]}</Badge>
                      </p>
                      <p className="mt-0.5 text-sm text-ink/65">{o.blurb}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-ink">{ugx(o.price)}</p>
                      {o.was && o.was > o.price && (
                        <p className="text-xs text-ink/50 line-through tabular-nums">{ugx(o.was)}</p>
                      )}
                      <div className="mt-2">
                        {asked ? (
                          <Badge tone="good" dot>
                            Asked for
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => ask(o)}>
                            Ask for this
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!left && features.serviceBookings && <BookServices stay={stay} />}

      {!left && (
        <section className="mt-5 rounded-xl border border-ink/10 bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Anything else we can do?</p>
          {said ? (
            <p className="mt-2 rounded-lg bg-good/[0.1] p-3 text-sm text-ink/80">
              We have your message: “{said}”. The desk will see it.
            </p>
          ) : (
            <>
              <Field label="Tell the desk">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={asking}
                    onChange={(e) => setAsking(e.target.value)}
                    placeholder="An extra pillow, a taxi at seven, a quiet table"
                  />
                )}
              </Field>
              <div className="mt-2">
                <Button size="sm" disabled={asking.trim().length < 3} onClick={askFor}>
                  Send it
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {mine.length > 0 && (
        <section className="mt-5">
          <h2 className="text-base font-semibold text-ink">What you have asked for</h2>
          <ul className="mt-2 space-y-1.5">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{r.detail ?? r.title}</span>
                  {r.price ? <span className="ml-2 text-xs text-ink/55">{ugx(r.price)}</span> : null}
                </span>
                <Badge tone={r.state === 'agreed' ? 'good' : r.state === 'declined' ? 'neutral' : 'warn'} dot={r.state === 'new'}>
                  {r.state === 'new' ? 'With the desk' : r.state === 'agreed' ? 'Arranged' : 'Not possible'}
                </Badge>
              </li>
            ))}
          </ul>
          {mine.some((r) => r.state === 'declined' && r.reason) && (
            <p className="mt-1.5 text-xs text-ink/55">
              {mine.find((r) => r.state === 'declined' && r.reason)?.reason}
            </p>
          )}
        </section>
      )}

      {paidHere.length > 0 && (
        <section className="mt-5">
          <h2 className="text-base font-semibold text-ink">Your payments</h2>
          <ul className="mt-2 space-y-1.5">
            {paidHere.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium tabular-nums text-ink">{ugx(p.amount)}</span>
                  <span className="ml-2 text-xs text-ink/55">
                    {p.method} · {p.at}
                  </span>
                </span>
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setShowing(p)}>
                  View receipt
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {left && <GuestFeedbackForm stay={stay} />}

      {features.bookingEngine && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Coming back?</p>
            <p className="text-xs text-ink/60">Book your next stay with us directly.</p>
          </div>
          <Link to={`/book/${slugOf(tenant.name)}`} className="text-sm font-semibold text-brand">
            Book another stay
          </Link>
        </section>
      )}

      {paying && <PayNow stay={stay} balance={f.balance} onClose={() => setPaying(false)} />}
      {showing && (
        <Modal title="Receipt" onClose={() => setShowing(null)} footer={<Button onClick={() => setShowing(null)}>Close</Button>}>
          <Receipt p={showing} />
        </Modal>
      )}

      <ConciergeWidget stay={stay} />

      <p className="mt-5 text-xs text-ink/50">
        This page is yours alone and shows nothing about any other guest. Shown as at {TODAY}.
      </p>
    </Shell>
  )
}

function Box({
  title,
  value,
  hint,
  to,
  action,
  extra,
}: {
  title: string
  value: string
  hint: string
  to: string
  action: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{title}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-ink/55">{hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {extra}
        <Link to={to} className="inline-block text-sm font-semibold text-brand">
          {action}
        </Link>
      </div>
    </div>
  )
}

function Shell({ hotel, children }: { hotel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand to-brand-deep px-5 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Your stay</p>
        <h1 className="text-xl font-bold">{hotel}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
    </div>
  )
}
