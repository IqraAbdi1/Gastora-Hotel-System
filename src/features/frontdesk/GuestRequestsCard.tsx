import { useState } from 'react'
import { Badge, Button, Card, Field, Input } from '../../components/ui'
import { stamp } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { chargeFor } from '../../lib/upsell'
import type { Offer, OfferKind } from '../../lib/upsell'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useGuestRequests } from '../portal/useGuestRequests'

/**
 * What guests have asked for from their own pages.
 *
 * Saying yes posts the money to the folio where it belongs, except for a room upgrade: that is a room
 * being moved, which a person does. The card says so rather than pretending the room moved itself.
 */
export default function GuestRequestsCard() {
  const { requests, update } = useGuestRequests()
  const { addCharge, reservations } = useHotel()
  const { options, features } = useFeatures()
  const { user } = useAuth()
  const [refusing, setRefusing] = useState<string | null>(null)
  const [why, setWhy] = useState('')

  const waiting = requests.filter((r) => r.state === 'new')
  // Agreed, costs money, and the bill was not open at the time. A folio opens at check-in, so the
  // money would otherwise be quietly lost between a guest asking and a guest arriving.
  const unposted = requests.filter(
    (r) => r.state === 'agreed' && !r.posted && !!r.price && r.offerKind && r.offerKind !== 'upgrade',
  )
  if (!features.guestPortal || (waiting.length === 0 && unposted.length === 0)) return null

  const by = user?.name ?? 'Front desk'

  const openFolio = (reservationId: string) =>
    reservations.find((x) => x.id === reservationId)?.status === 'in-house'

  /** Puts the money on the bill, where there is a bill to put it on. */
  function post(id: string) {
    const r = requests.find((x) => x.id === id)
    if (!r || !r.price || !r.offerKind || r.offerKind === 'upgrade') return false
    if (!openFolio(r.reservationId)) return false
    const offer = { id: r.offerId ?? '', kind: r.offerKind as OfferKind, title: r.title, blurb: '', price: r.price } as Offer
    const charge = chargeFor(offer, options.addOns ?? [])
    if (!charge) return false
    addCharge(r.reservationId, charge)
    update(id, { posted: true })
    return true
  }

  function agree(id: string) {
    const r = requests.find((x) => x.id === id)
    if (!r) return
    const posted = r.kind === 'offer' ? post(id) : false
    update(id, { state: 'agreed', by, decidedAt: stamp(), posted: posted || undefined })
  }

  function refuse(id: string) {
    update(id, { state: 'declined', by, decidedAt: stamp(), reason: why.trim() || undefined })
    setRefusing(null)
    setWhy('')
  }

  return (
    <Card
      icon="alert"
      title="Guests have asked for something"
      count={waiting.length}
      description="From their own pages. Nothing is charged until you agree to it."
      padded
    >
      <ul className="space-y-2">
        {waiting.map((r) => (
          <li key={r.id} className="rounded-xl border border-ink/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.guestName}</p>
                <p className="mt-0.5 text-sm text-ink/80">{r.detail ?? r.title}</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  {r.room ? `Room ${r.room} · ` : ''}
                  {r.reservationId} · {r.at}
                </p>
                {r.price && r.offerKind !== 'upgrade' && !openFolio(r.reservationId) && (
                  <p className="mt-1 text-xs text-ink/60">
                    Goes on their bill at check-in.
                  </p>
                )}
                {r.offerKind === 'upgrade' && (
                  <p className="mt-1 text-xs text-warn">
                    Agreeing records the price. The move is still to do.
                  </p>
                )}
              </div>
              <div className="text-right">
                {r.price ? <p className="font-bold tabular-nums text-ink">{ugx(r.price)}</p> : null}
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button size="sm" onClick={() => agree(r.id)}>
                    {r.price && r.offerKind !== 'upgrade' && openFolio(r.reservationId) ? 'Agree and charge' : 'Agree'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRefusing(r.id)}>
                    Cannot
                  </Button>
                </div>
              </div>
            </div>

            {refusing === r.id && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1">
                  <Field label="What should the guest be told?">
                    {(id) => (
                      <Input
                        id={id}
                        value={why}
                        onChange={(e) => setWhy(e.target.value)}
                        placeholder="Every Deluxe is taken that night"
                      />
                    )}
                  </Field>
                </div>
                <Button size="sm" variant="secondary" onClick={() => refuse(r.id)}>
                  Tell them
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {unposted.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Agreed, not yet on a bill</p>
          <ul className="mt-1.5 space-y-1.5">
            {unposted.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink/75">
                  {r.guestName} · {r.title} · <span className="tabular-nums">{ugx(r.price ?? 0)}</span>
                </span>
                {openFolio(r.reservationId) ? (
                  <Button size="sm" variant="secondary" onClick={() => post(r.id)}>
                    Put it on the bill
                  </Button>
                ) : (
                  <Badge tone="neutral">Waiting for check-in</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-1 text-xs text-ink/45">
        <Badge tone="neutral">Rule</Badge> Offers are only shown for rooms genuinely free on those nights.
      </p>
    </Card>
  )
}
