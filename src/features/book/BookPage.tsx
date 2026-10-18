import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Badge, Button, Field, Input, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { soldByNight } from '../../lib/availability'
import { nightsOf, planFor } from '../../lib/booking'
import {
  bookable,
  offersFor,
  PAY_FAILED,
  PAY_METHODS,
  PAY_PROMPT,
  reference,
  roomsNeeded,
  searchProblem,
  slugOf,
} from '../../lib/bookingEngine'
import type { Offer, PayMethod, PayState, Search } from '../../lib/bookingEngine'
import { dayMonth, ugx } from '../../lib/format'
import { stamp } from '../../lib/folio'
import { useHotel } from '../../lib/hotelContext'
import { DAY_SHORT, dayOf, priceNights, varies } from '../../lib/rateCalendar'
import { addOnsTotal, chargesFor, PER_LABEL, priceOf } from '../../lib/addOns'
import { findPromo, promoProblem, promoSaving, tidyCode } from '../../lib/promos'
import type { Promo } from '../../lib/promos'
import { useFeatures } from '../platform/featuresContext'

type Step = 'search' | 'rooms' | 'extras' | 'details' | 'pay' | 'done'

/**
 * The hotel's own booking page, as a guest meets it: no sign-in, no staff words, nothing about any
 * other guest. In a real deployment this sits behind the hotel's own address and carries its name.
 *
 * It sells under exactly the hotel's own rules - the rate calendar, the closed dates, the real count of
 * free rooms - and it will not oversell, because overbooking is a decision a person takes.
 */
export default function BookPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const { rooms, reservations, addReservation, addGuest } = useHotel()
  const { tenant, options, features, stayTimes, setOptions } = useFeatures()

  const [step, setStep] = useState<Step>('search')
  const [search, setSearch] = useState<Search>({ arrival: TODAY, departure: '', adults: 2, children: 0 })
  const [chosen, setChosen] = useState<Offer | null>(null)
  // One package chosen per room type, so each room reads as one thing to decide rather than nine.
  const [plans, setPlans] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requests, setRequests] = useState('')
  const [method, setMethod] = useState<PayMethod>('MTN MoMo')
  const [pay, setPay] = useState<PayState>('idle')
  const [bookingId, setBookingId] = useState('')
  const [codeText, setCodeText] = useState('')
  const [promo, setPromo] = useState<Promo | null>(null)
  const [codeSaid, setCodeSaid] = useState('')
  const [extras, setExtras] = useState<string[]>([])

  const rates = options.rates
  const problem = searchProblem(search, TODAY)
  const nights = problem ? 0 : nightsOf(search.arrival, search.departure)

  const sold = useMemo(
    () => (problem ? {} : soldByNight(rooms, reservations, search.arrival, search.departure)),
    [problem, rooms, reservations, search.arrival, search.departure],
  )
  const offers = useMemo(
    () => (problem ? [] : offersFor(search, rooms, reservations, rates, (d) => sold[d])),
    [problem, search, rooms, reservations, rates, sold],
  )
  const perNight = useMemo(
    () => (chosen && !problem ? priceNights(chosen.type, search.arrival, search.departure, rates, (d) => sold[d]) : []),
    [chosen, problem, search.arrival, search.departure, rates, sold],
  )

  // What the code takes off, if one has been accepted and still applies to what is now chosen.
  const saving = chosen && promo ? promoSaving(promo, chosen.total, nights) : 0
  // Extras are sold beside the room: the code is a room price, so it does not touch them.
  const offered = (options.addOns ?? []).filter((a) => a.on)
  const picked = offered.filter((a) => extras.includes(a.id))
  const extrasMoney = addOnsTotal(picked, nights, search.adults)
  const payable = chosen ? chosen.total - saving + extrasMoney : 0

  function tryCode() {
    const found = findPromo(rates.promos ?? [], codeText)
    if (!found) {
      setPromo(null)
      setCodeSaid('We do not know that code. Check the spelling, or leave it empty.')
      return
    }
    const why = chosen
      ? promoProblem(found, { arrival: search.arrival, departure: search.departure, type: chosen.type, planId: chosen.planId }, TODAY)
      : undefined
    if (why) {
      setPromo(null)
      setCodeSaid(why)
      return
    }
    setPromo(found)
    setCodeSaid('')
  }

  // The demonstration keeps one hotel's rooms, so another hotel's address cannot be served here.
  if (slug && slug !== slugOf(tenant.name)) {
    return (
      <Shell hotel={tenant.name}>
        <Note>
          This demonstration is showing <strong>{tenant.name}</strong>. Each hotel's booking page carries its own name
          and its own rooms; switch hotels on the platform admin page to see another one.
        </Note>
      </Shell>
    )
  }

  if (!features.bookingEngine) {
    return (
      <Shell hotel={tenant.name}>
        <Note>This hotel takes its bookings by telephone. Please call the front desk.</Note>
      </Shell>
    )
  }

  function book() {
    setPay('pending')
    // The provider takes a moment, and may say no. Nothing is confirmed until it answers.
    window.setTimeout(() => {
      if (params.get('fail') === '1') {
        setPay('failed')
        return
      }
      const guest = addGuest({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined })
      const made = addReservation({
        guest: guest.name,
        guestId: guest.id,
        roomType: chosen!.type,
        room: null,
        arrival: search.arrival,
        departure: search.departure,
        total: payable,
        paid: chosen!.deposit,
        plan: chosen!.planId,
        guarantee: 'deposit',
        source: 'online',
        adults: search.adults,
        children: search.children,
        details: { idType: 'NIN', idNumber: '', nationality: '', phone: phone.trim(), specialRequests: requests.trim() },
        ...(promo ? { promo: { code: tidyCode(promo.code), saved: saving } } : {}),
        // The reservation total always includes what is on the folio, so the room charge still reads
        // correctly once these lines are there.
        ...(picked.length > 0 ? { charges: chargesFor(picked, nights, search.adults, stamp()) } : {}),
      })
      // A code is counted when it is used, not when it is typed: a refused payment makes no booking.
      if (promo) {
        setOptions({
          rates: {
            ...rates,
            promos: (rates.promos ?? []).map((x) => (x.id === promo.id ? { ...x, used: x.used + 1 } : x)),
          },
        })
      }
      setBookingId(made.id)
      setPay('paid')
      setStep('done')
    }, 1600)
  }

  return (
    <Shell hotel={tenant.name}>
      {step !== 'done' && (
        <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
          {(offered.length > 0
            ? (['search', 'rooms', 'extras', 'details', 'pay'] as Step[])
            : (['search', 'rooms', 'details', 'pay'] as Step[])
          ).map((s, n, order) => {
            const at = order.indexOf(step)
            const label = (offered.length > 0
              ? ['Dates', 'Rooms', 'Extras', 'You', 'Payment']
              : ['Dates', 'Rooms', 'You', 'Payment'])[n]
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    n === at ? 'bg-brand text-white' : n < at ? 'bg-brand/15 text-brand' : 'bg-ink/5 text-ink/45'
                  }`}
                >
                  {label}
                </span>
                {n < order.length - 1 && <span className="text-ink/25">—</span>}
              </li>
            )
          })}
        </ol>
      )}

      {step === 'search' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">When are you coming?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Arrival">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  min={TODAY}
                  value={search.arrival}
                  onChange={(e) => e.target.value && setSearch({ ...search, arrival: e.target.value })}
                />
              )}
            </Field>
            <Field label="Departure">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  min={search.arrival}
                  value={search.departure}
                  onChange={(e) => e.target.value && setSearch({ ...search, departure: e.target.value })}
                />
              )}
            </Field>
            <Field label="Adults">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  value={String(search.adults)}
                  onChange={(e) => setSearch({ ...search, adults: Math.max(1, Number(e.target.value) || 1) })}
                />
              )}
            </Field>
            <Field label="Children">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={String(search.children)}
                  onChange={(e) => setSearch({ ...search, children: Math.max(0, Number(e.target.value) || 0) })}
                />
              )}
            </Field>
          </div>
          {problem ? (
            <p className="text-sm text-bad">{problem}</p>
          ) : (
            <p className="text-sm text-ink/60">
              {nights} night{nights === 1 ? '' : 's'} · check-in from {stayTimes.checkInTime}, check-out by{' '}
              {stayTimes.checkOutTime}
            </p>
          )}
          {!problem && roomsNeeded(search.adults) > 1 && (
            <Note>
              {search.adults} adults will not fit in one room. Please telephone the hotel so the rooms are put together
              properly.
            </Note>
          )}
          <Button disabled={!!problem || roomsNeeded(search.adults) > 1} onClick={() => setStep('rooms')}>
            See the rooms
          </Button>
        </section>
      )}

      {step === 'rooms' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">
              {dayMonth(search.arrival)} to {dayMonth(search.departure)}
            </h2>
            <button type="button" onClick={() => setStep('search')} className="text-sm font-semibold text-brand">
              Change the dates
            </button>
          </div>

          <ul className="space-y-3">
            {(['Standard', 'Deluxe', 'Suite'] as const).map((type) => {
              const forType = offers.filter((o) => o.type === type)
              if (forType.length === 0) return null
              const planId = plans[type] ?? rates.plans[0].id
              const o = forType.find((x) => x.planId === planId) ?? forType[0]
              const plan = planFor(o.planId, rates)
              const open = bookable(o)
              return (
                <li
                  key={type}
                  className={`rounded-xl border p-4 ${open ? 'border-ink/10 bg-surface shadow-sm' : 'border-ink/10 bg-ink/[0.03]'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-ink">{type}</p>
                      {o.refusal ? (
                        <p className="mt-1 text-sm text-bad">{o.refusal}</p>
                      ) : o.free < 1 ? (
                        <p className="mt-1 text-sm text-bad">Taken for these dates.</p>
                      ) : (
                        <div className="mt-1">
                          <Badge tone={o.free <= 2 ? 'warn' : 'good'} dot>
                            {o.free === 1 ? 'One room left' : `${o.free} rooms left`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-ink">{ugx(o.total)}</p>
                      <p className="text-xs text-ink/55">
                        {ugx(o.nightly)} a night · {nights} night{nights === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {forType.map((x) => {
                      const p = planFor(x.planId, rates)
                      const on = x.planId === o.planId
                      return (
                        <button
                          key={x.planId}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPlans({ ...plans, [type]: x.planId })}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                            on ? 'bg-brand/10 text-brand ring-brand/30' : 'bg-ink/5 text-ink/60 ring-ink/10 hover:ring-brand/30'
                          }`}
                        >
                          {p.name}
                          {x.total !== forType[0].total && (
                            <span className="ml-1.5 font-normal text-ink/45">+{ugx(x.total - forType[0].total)}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-ink/60">{plan.inclusions}</p>

                  {open && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          setChosen(o)
                          setStep(offered.length > 0 ? 'extras' : 'details')
                        }}
                      >
                        Choose {plan.name.toLowerCase()}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-ink/55">
            Prices are for the dates you chose and include every night of your stay. Nothing is held until the deposit
            is paid.
          </p>
        </section>
      )}

      {step === 'extras' && chosen && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Anything else?</h2>
          <Summary offer={chosen} search={search} nights={nights} rates={rates} perNight={perNight} />
          <ul className="space-y-2">
            {offered.map((a) => {
              const on = extras.includes(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setExtras(on ? extras.filter((x) => x !== a.id) : [...extras, a.id])}
                    className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                      on ? 'border-brand bg-brand/[0.07] ring-1 ring-brand/30' : 'border-ink/10 bg-surface hover:border-brand/40'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold ${
                            on ? 'border-brand bg-brand text-white' : 'border-ink/25 text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        {a.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink/60">{a.blurb}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums text-ink">{ugx(priceOf(a, nights, search.adults))}</span>
                      <span className="block text-xs text-ink/50">
                        {ugx(a.price)} {PER_LABEL[a.per]}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-ink/55">
            Extras are added to your bill at the hotel and are not part of the deposit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setStep('details')}>
              {picked.length === 0 ? 'No thank you' : `Continue with ${ugx(extrasMoney)} of extras`}
            </Button>
            <Button variant="ghost" onClick={() => setStep('rooms')}>
              Back to the rooms
            </Button>
          </div>
        </section>
      )}

      {step === 'details' && chosen && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Who is staying?</h2>
          <Summary offer={chosen} search={search} nights={nights} rates={rates} perNight={perNight} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Telephone" required>
              {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0772 000 000" />}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email" hint="Where the confirmation is sent.">
                {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Anything we should know" hint="A quiet room, a late arrival, a cot.">
                {(id) => <Textarea id={id} rows={2} value={requests} onChange={(e) => setRequests(e.target.value)} />}
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={name.trim().length < 3 || phone.trim().length < 7} onClick={() => setStep('pay')}>
              Continue to payment
            </Button>
            <Button variant="ghost" onClick={() => setStep(offered.length > 0 ? 'extras' : 'rooms')}>
              {offered.length > 0 ? 'Back to the extras' : 'Back to the rooms'}
            </Button>
          </div>
        </section>
      )}

      {step === 'pay' && chosen && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Hold the room with a deposit</h2>
          <Summary offer={chosen} search={search} nights={nights} rates={rates} perNight={perNight} />

          <div className="rounded-xl border border-ink/10 bg-surface p-4">
            <p className="text-sm font-semibold text-ink">Have a code?</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <Field label="Promotional code">
                  {(id) => (
                    <Input
                      id={id}
                      value={codeText}
                      onChange={(e) => setCodeText(e.target.value.toUpperCase())}
                      placeholder="EARLYBIRD"
                      disabled={pay === 'pending'}
                    />
                  )}
                </Field>
              </div>
              <Button variant="secondary" disabled={!codeText.trim() || pay === 'pending'} onClick={tryCode}>
                Use it
              </Button>
            </div>
            {codeSaid && <p className="mt-2 text-sm text-bad">{codeSaid}</p>}
            {promo && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-good">
                <Badge tone="good" dot>
                  {tidyCode(promo.code)}
                </Badge>
                {promo.name} · {ugx(saving)} off
                <button
                  type="button"
                  className="font-semibold text-ink/50"
                  onClick={() => {
                    setPromo(null)
                    setCodeText('')
                  }}
                >
                  Remove
                </button>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-ink/10 bg-surface p-4">
            {(saving > 0 || extrasMoney > 0) && (
              <dl className="mb-2 space-y-0.5 border-b border-ink/10 pb-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/60">The room</dt>
                  <dd className="tabular-nums text-ink/75">{ugx(chosen.total)}</dd>
                </div>
                {saving > 0 && (
                  <div className="flex justify-between gap-3 text-good">
                    <dt>{promo ? tidyCode(promo.code) : 'Code'}</dt>
                    <dd className="tabular-nums">− {ugx(saving)}</dd>
                  </div>
                )}
                {picked.map((a) => (
                  <div key={a.id} className="flex justify-between gap-3">
                    <dt className="text-ink/60">{a.name}</dt>
                    <dd className="tabular-nums text-ink/75">{ugx(priceOf(a, nights, search.adults))}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 pt-1 font-semibold text-ink">
                  <dt>Altogether</dt>
                  <dd className="tabular-nums">{ugx(payable)}</dd>
                </div>
              </dl>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-ink/70">Deposit now</p>
              <p className="text-xl font-bold tabular-nums text-ink">{ugx(chosen.deposit)}</p>
            </div>
            <p className="mt-0.5 text-xs text-ink/55">
              The rest, {ugx(Math.max(0, payable - chosen.deposit))}, is paid at the hotel.
            </p>

            <div className="mt-3">
              <Field label="Pay with">
                {(id) => (
                  <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} disabled={pay === 'pending'}>
                    {PAY_METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            {pay === 'pending' && (
              <p className="mt-3 rounded-lg bg-warn/[0.1] p-3 text-sm text-ink/80">{PAY_PROMPT[method]}</p>
            )}
            {pay === 'failed' && <p className="mt-3 rounded-lg bg-bad/10 p-3 text-sm text-bad">{PAY_FAILED[method]}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={pay === 'pending'} onClick={book}>
                {pay === 'pending' ? 'Waiting…' : pay === 'failed' ? 'Try again' : `Pay ${ugx(chosen.deposit)}`}
              </Button>
              <Button variant="ghost" disabled={pay === 'pending'} onClick={() => setStep('details')}>
                Back
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink/50">
              No money moves in this demonstration and no payment provider is contacted. The waiting is real, though:
              mobile money is approved on the handset and the hotel only confirms a booking once the provider answers.
            </p>
          </div>
        </section>
      )}

      {step === 'done' && chosen && (
        <section className="space-y-4">
          <div className="rounded-xl bg-good/[0.1] p-4">
            <p className="text-sm font-semibold text-good">Your room is booked.</p>
            <p className="mt-1 text-sm text-ink/80">
              Reference <strong className="font-mono">{reference(bookingId)}</strong>. We have sent the confirmation to{' '}
              {email.trim() || phone.trim()}.
            </p>
          </div>
          <Summary offer={chosen} search={search} nights={nights} rates={rates} perNight={perNight} />
          <div className="rounded-xl border border-ink/10 bg-surface p-4 text-sm text-ink/75">
            <p className="font-semibold text-ink">What happens next</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>
                Check in from {stayTimes.checkInTime} on {dayMonth(search.arrival)}. Bring the identification you will
                travel with.
              </li>
              <li>{ugx(Math.max(0, payable - chosen.deposit))} is paid at the hotel.</li>
              <li>The hotel may send you a form to fill in before you arrive, so the desk is quicker.</li>
            </ul>
          </div>
        </section>
      )}
    </Shell>
  )
}

function Summary({
  offer,
  search,
  nights,
  rates,
  perNight,
}: {
  offer: Offer
  search: Search
  nights: number
  rates: ReturnType<typeof planFor> extends never ? never : import('../../lib/rates').RatesPolicy
  perNight: ReturnType<typeof priceNights>
}) {
  const [open, setOpen] = useState(false)
  const plan = planFor(offer.planId, rates)
  return (
    <div className="rounded-xl border border-ink/10 bg-linear-to-br from-brand/[0.07] to-surface p-4">
      <p className="font-semibold text-ink">
        {offer.type} · {plan.name}
      </p>
      <p className="mt-0.5 text-sm text-ink/65">
        {dayMonth(search.arrival)} to {dayMonth(search.departure)} · {nights} night{nights === 1 ? '' : 's'} ·{' '}
        {search.adults} adult{search.adults === 1 ? '' : 's'}
        {search.children > 0 && `, ${search.children} child${search.children === 1 ? '' : 'ren'}`}
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums text-ink">{ugx(offer.total)}</p>
      {varies(perNight) && (
        <>
          <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-semibold text-brand">
            {open ? 'Hide the nights' : 'Not every night is the same price'}
          </button>
          {open && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-ink/70">
              {perNight.map((n) => (
                <li key={n.date} className="flex justify-between gap-3">
                  <span>
                    {DAY_SHORT[dayOf(n.date)]} {dayMonth(n.date)}
                  </span>
                  <span className="tabular-nums">{ugx(n.rate)}</span>
                </li>
              ))}
              <li className="pt-1 text-ink/50">Room only. {plan.name} is added on top of each night.</li>
            </ul>
          )}
        </>
      )}
    </div>
  )
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-xl bg-warn/[0.1] p-3 text-sm text-ink/80">{children}</p>
)

function Shell({ hotel, children }: { hotel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand to-brand-deep px-5 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Book a room</p>
        <h1 className="text-xl font-bold">{hotel}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
    </div>
  )
}
