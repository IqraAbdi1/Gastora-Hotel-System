import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Card, Segmented, inputClass } from '../../components/ui'
import { useHotel } from '../../lib/hotelContext'
import { TODAY } from '../../data/sample'
import { addDays } from '../../lib/availability'
import { dayMonth, ugx } from '../../lib/format'
import { floorLabel, floorOf } from '../../lib/rooms'
import { findMatches } from '../../lib/guests'
import { freeByType, freeRooms, nightsOf, planFor, roomTypes, stayTotal, suggestedDeposit } from '../../lib/booking'
import { benefitList, loyaltyDiscount, stayHistory, tierFor } from '../../lib/loyalty'
import { useFeatures } from '../platform/featuresContext'
import GuestRecognition from '../guests/GuestRecognition'
import ApprovalGate from '../approvals/ApprovalGate'
import { useApprovals } from '../approvals/approvalsContext'
import { guarantees, ratePlans, roomRate } from '../../data/rates'
import type { GuaranteeType, Guest, Reservation, Room } from '../../types'
import type { BookingPreset } from '../../lib/bookingContext'
import { companyBookingRecord, planCompanyBooking } from '../../lib/corporateBooking'
import type { CompanyInput } from '../../lib/corporateBooking'
import { BILL_TO_LABEL } from '../../lib/corporate'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import CheckInPanel from './CheckInPanel'
import CompanyBookingSection from './CompanyBookingSection'

const field = inputClass
const methods = ['MTN MoMo', 'Airtel Money', 'Card', 'Cash']

export function NewReservationForm({
  onAgain,
  onClose,
  preset,
}: {
  onAgain: () => void
  onClose?: () => void
  preset?: BookingPreset
}) {
  const { rooms, reservations, guests, addReservation, addGuest } = useHotel()
  const { byId, policy } = useCorporate()
  const { user } = useAuth()

  // Opened from a calendar cell or a top-bar button.
  const presetRoom = rooms.find((r) => r.number === preset?.room)
  const presetDate = preset?.date
  const startDate = presetDate && presetDate >= TODAY ? presetDate : TODAY

  const [walkin, setWalkin] = useState(preset?.walkin === true)
  const [arrival, setArrival] = useState(startDate)
  const [departure, setDeparture] = useState(addDays(startDate, 1))
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [type, setType] = useState<Room['type']>(presetRoom?.type ?? 'Standard')
  const [planId, setPlanId] = useState(ratePlans[0].id)
  const [room, setRoom] = useState(presetRoom?.number ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [guarantee, setGuarantee] = useState<GuaranteeType>('deposit')
  const [method, setMethod] = useState(methods[0])
  const [depositText, setDepositText] = useState('')
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [via, setVia] = useState<'front desk' | 'phone' | 'email'>('front desk')
  const [created, setCreated] = useState<Reservation | null>(null)
  const [checkInFor, setCheckInFor] = useState<Reservation | null>(null)
  const [company, setCompany] = useState<CompanyInput | null>(null)
  const { options, tenant } = useFeatures()
  const loyalty = options.loyalty
  const { record } = useApprovals()

  const from = walkin ? TODAY : arrival
  const nights = nightsOf(from, departure)
  const datesOk = nights >= 1 && from >= TODAY

  // Availability per room type for the whole stay, counted in one pass (FR-RMS-012).
  const free = useMemo(() => freeByType(rooms, reservations, from, departure), [rooms, reservations, from, departure])
  const typeFree = datesOk ? free[type] : 0
  const soldOut = datesOk && typeFree < 1

  // Specific rooms are only offered while the type still has room. Capped, so 400 rooms never build a long list.
  const roomChoices = useMemo(
    () => (datesOk && typeFree >= 1 ? freeRooms(rooms, reservations, type, from, departure) : []),
    [datesOk, typeFree, rooms, reservations, type, from, departure],
  )
  const roomValue = roomChoices.some((r) => r.number === room) ? room : ''

  // Company side: the account, the booker, who pays and any agreed price.
  const companyAccount = company?.accountId ? byId(company.accountId) : undefined
  const companyPlan = useMemo(
    () =>
      company && companyAccount && datesOk
        ? planCompanyBooking(company, companyAccount, policy, reservations, { roomType: type, planId, arrival: from, departure, nights })
        : null,
    [company, companyAccount, datesOk, policy, reservations, type, planId, from, departure, nights],
  )

  const beforeLoyalty = datesOk ? (companyPlan ? companyPlan.chargedTotal : stayTotal(type, planId, nights)) : 0

  // A returning guest's reward. The room only, never on top of a company price, and only on finished stays.
  const history = useMemo(() => (selectedGuest ? stayHistory(selectedGuest, reservations) : null), [selectedGuest, reservations])
  const tier = history ? tierFor(history, loyalty) : null
  const roomOnly = datesOk ? stayTotal(type, 'room-only', nights) : 0
  const earned = loyaltyDiscount(tier, roomOnly, !!companyPlan?.selected.length)
  const [useLoyalty, setUseLoyalty] = useState(true)
  const [loyaltyApproved, setLoyaltyApproved] = useState('')
  const discountOn = earned > 0 && useLoyalty && (loyalty.autoApply || loyaltyApproved !== '')
  const total = Math.max(0, beforeLoyalty - (discountOn ? earned : 0))
  const suggested = suggestedDeposit(total)
  const deposit = depositText === '' ? (guarantee === 'deposit' ? suggested : 0) : Math.max(0, Number(depositText) || 0)

  const matches = useMemo(
    () => (selectedGuest ? [] : findMatches(guests, name, phone)),
    [guests, name, phone, selectedGuest],
  )
  const likely = matches.filter((m) => m.likely)
  const others = matches.filter((m) => !m.likely)

  const nameOk = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9
  const depositOk = deposit <= total && (guarantee !== 'deposit' || deposit > 0)
  const overrideOk = !soldOut || (override && reason.trim().length >= 5)
  const companyOk = !company || (!!companyPlan && companyPlan.errors.length === 0)
  const valid = datesOk && nameOk && depositOk && overrideOk && adults >= 1 && companyOk

  const problems: string[] = []
  if (!datesOk) problems.push('Pick valid dates (today or later, at least one night).')
  if (!nameOk) problems.push('Enter the guest name and a phone number.')
  if (!depositOk) problems.push(guarantee === 'deposit' ? 'Enter a deposit above 0 and not above the total.' : 'The deposit cannot be above the total.')
  if (!overrideOk) problems.push('This room type is sold out. A manager override and a reason are needed.')
  if (company && !companyAccount) problems.push('Choose the company, or untick "Book for a company".')
  if (companyPlan) problems.push(...companyPlan.errors)

  function toggleWalkin(on: boolean) {
    setWalkin(on)
    if (on && departure <= TODAY) setDeparture(addDays(TODAY, 1))
  }

  // A company booking is not guaranteed by the company until billing is approved, so start with no guarantee.
  function changeCompany(next: CompanyInput | null) {
    if (next && !company) {
      setGuarantee('none')
      setDepositText('')
    }
    if (!next && company) setGuarantee('deposit')
    setCompany(next)
  }

  function pickGuest(g: Guest) {
    setName(g.name)
    setPhone(g.phone)
    setSelectedGuest(g)
  }

  function submit() {
    const profile = selectedGuest ?? addGuest({ name: name.trim(), phone: phone.trim() })
    const record = company && companyPlan ? companyBookingRecord(companyPlan, company, user?.name ?? 'Front desk') : null
    const made = addReservation({
      guest: profile.name,
      guestId: profile.id,
      roomType: type,
      room: roomValue || null,
      arrival: from,
      departure,
      total: record ? record.total : total,
      paid: deposit,
      plan: planId,
      guarantee: record?.guarantee ?? guarantee,
      ...(record ? { corporate: record.corporate } : {}),
      source: walkin ? 'walk-in' : via,
      adults,
      children,
      ...(soldOut ? { overrideReason: reason.trim() } : {}),
    })
    setCreated(made)
    if (walkin) setCheckInFor(made)
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="space-y-2 rounded-xl bg-surface p-4">
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            Reservation {created.id} created for {created.guest}.
          </p>
          <p className="text-sm">
            {created.roomType} · {dayMonth(created.arrival)} to {dayMonth(created.departure)} ·{' '}
            {created.room ? `Room ${created.room}` : 'room assigned at check-in'}
          </p>
          <p className="text-sm">
            Total {ugx(created.total)} · Deposit {ugx(created.paid)} · Balance {ugx(created.total - created.paid)}
          </p>
          {created.corporate && (
            <div className="space-y-1 rounded-lg bg-canvas p-3 text-sm">
              <p className="font-semibold">
                {created.corporate.accountName} · {BILL_TO_LABEL[created.corporate.billTo]}
              </p>
              <p className="text-ink/70">
                Booker {created.corporate.booker.status === 'verified' ? 'verified' : 'still to verify'} · billing{' '}
                {created.corporate.billing.status === 'approved'
                  ? 'approved'
                  : created.corporate.billing.status === 'not-required'
                    ? 'not needed'
                    : 'waiting for company approval'}
                {created.corporate.pricing?.status === 'pending' && ' · company price waiting for a manager'}
              </p>
            </div>
          )}
          {created.overrideReason && (
            <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">Overbooking override logged: {created.overrideReason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {created.arrival === TODAY && (
            <button
              type="button"
              onClick={() => setCheckInFor(created)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Check in now
            </button>
          )}
          <Link
            to="/desk/reservations"
            onClick={onClose}
            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
          >
            View reservations
          </Link>
          <button type="button" onClick={onAgain} className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold">
            Another booking
          </button>
        </div>
        {checkInFor && <CheckInPanel reservation={checkInFor} onClose={() => setCheckInFor(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{walkin ? 'Walk-in' : 'New reservation'}</h1>
          <p className="text-sm text-ink/60">
            {walkin ? 'The guest is here now. Book, then go straight to check-in.' : 'Dates, room type, guest and deposit.'}
          </p>
        </div>
        <Segmented
          label="Booking type"
          value={walkin ? 'walkin' : 'reservation'}
          onChange={(v) => toggleWalkin(v === 'walkin')}
          options={[
            { key: 'reservation', label: 'Reservation' },
            { key: 'walkin', label: 'Walk-in' },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Stay" padded>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="block text-sm font-medium">
                Arrival
                <input
                  type="date"
                  min={TODAY}
                  value={from}
                  disabled={walkin}
                  onChange={(e) => e.target.value && setArrival(e.target.value)}
                  className={`${field} mt-1 disabled:opacity-60`}
                />
              </label>
              <label className="block text-sm font-medium">
                Departure
                <input
                  type="date"
                  min={addDays(from, 1)}
                  value={departure}
                  onChange={(e) => e.target.value && setDeparture(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium">
                Adults
                <input type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} className={`${field} mt-1`} />
              </label>
              <label className="block text-sm font-medium">
                Children
                <input type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} className={`${field} mt-1`} />
              </label>
            </div>
            <p className="text-sm text-ink/60">
              {datesOk ? `${nights} night${nights === 1 ? '' : 's'}` : 'Departure must be after arrival, and arrival cannot be in the past.'}
            </p>
          </div>
          </Card>

          <Card title="Room type and rate" padded>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {roomTypes.map((t) => {
                const f = datesOk ? free[t] : 0
                const price = roomRate[t] + planFor(planId).extraPerNight
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      type === t
                        ? 'border-brand bg-linear-to-br from-brand/15 to-surface ring-2 ring-brand'
                        : 'border-ink/10 bg-surface shadow-sm hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md'
                    }`}
                  >
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-ink/60">{ugx(price)} per night</p>
                    <div className="mt-2">
                      <Badge tone={!datesOk ? 'neutral' : f < 1 ? 'bad' : f <= 2 ? 'warn' : 'good'} dot>
                        {!datesOk ? 'Pick dates' : f < 1 ? 'Sold out' : `${f} free`}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>

            <label className="block text-sm font-medium">
              Rate plan
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={`${field} mt-1`}>
                {ratePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-ink/60">Includes: {planFor(planId).inclusions}</span>
            </label>

            {!walkin && roomChoices.length > 0 && (
              <div>
                <p className="text-sm font-medium">Room</p>
                <div className="mt-1.5 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setRoom('')}
                    aria-pressed={roomValue === ''}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      roomValue === ''
                        ? 'border-brand bg-linear-to-br from-brand/15 to-surface ring-2 ring-brand'
                        : 'border-ink/10 bg-surface shadow-sm hover:border-brand/40'
                    }`}
                  >
                    <p className="font-bold text-ink">Assign later</p>
                    <p className="text-xs text-ink/60">At check-in (recommended)</p>
                  </button>
                  {roomChoices.map((r) => (
                    <button
                      key={r.number}
                      type="button"
                      onClick={() => setRoom(r.number)}
                      aria-pressed={roomValue === r.number}
                      className={`rounded-xl border p-3 text-left transition ${
                        roomValue === r.number
                          ? 'border-brand bg-linear-to-br from-brand/15 to-surface ring-2 ring-brand'
                          : 'border-ink/10 bg-surface shadow-sm hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md'
                      }`}
                    >
                      <p className="text-lg font-bold text-ink">{r.number}</p>
                      <p className="text-xs text-ink/60">
                        {floorLabel(floorOf(r))} · {r.type}
                      </p>
                      <div className="mt-1.5">
                        <Badge tone={r.status === 'clean' ? 'good' : 'warn'} dot>
                          {r.status === 'clean' ? 'Ready' : r.status === 'occupied' ? 'Free for these dates' : 'Needs cleaning'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {soldOut && (
              <div className="space-y-2 rounded-lg bg-bad/10 p-3 text-sm">
                <p className="font-semibold text-bad">No {type} room is free for these dates.</p>
                <p className="text-ink/70">Only a manager can book it anyway. The override and the reason are saved on the booking (FR-RES-005).</p>
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                  Manager override (simulated)
                </label>
                {override && (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Reason, for example: expecting a cancellation, guest moves to another hotel"
                    className={field}
                  />
                )}
              </div>
            )}
          </div>
          </Card>

          <CompanyBookingSection value={company} onChange={changeCompany} plan={companyPlan} />

          <Card title="Guest" padded>
          <div className="space-y-3">
                        {!walkin && (
              <label className="block text-sm font-medium">
                Booked via
                <select
                  value={via}
                  onChange={(e) => setVia(e.target.value as 'front desk' | 'phone' | 'email')}
                  className={`${field} mt-1`}
                >
                  <option value="front desk">Front desk (guest came in)</option>
                  <option value="phone">Phone call</option>
                  <option value="email">Email</option>
                </select>
              </label>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Full name
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSelectedGuest(null)
                  }}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium">
                Phone
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setSelectedGuest(null)
                  }}
                  placeholder="0772 000 000"
                  className={`${field} mt-1`}
                />
              </label>
            </div>

            {selectedGuest && (
              <p className="flex items-center justify-between rounded-lg bg-good/10 p-3 text-sm text-good">
                <span>
                  Using existing profile {selectedGuest.id} · {selectedGuest.name}
                </span>
                <button type="button" onClick={() => setSelectedGuest(null)} className="font-semibold">
                  Clear
                </button>
              </p>
            )}

            {likely.length > 0 && (
              <div className="space-y-2 rounded-lg bg-warn/10 p-3 text-sm">
                <p className="font-semibold text-warn">Possible duplicate. Rule check: same phone, same name or a very similar name.</p>
                {likely.map((m) => (
                  <div key={m.guest.id} className="flex items-center justify-between gap-3">
                    <span>
                      {m.guest.name} · {m.guest.phone} <span className="text-ink/60">({m.reason})</span>
                    </span>
                    <button type="button" onClick={() => pickGuest(m.guest)} className="font-semibold text-brand">
                      Use this guest
                    </button>
                  </div>
                ))}
                <p className="text-xs text-ink/60">If it is a different person, carry on and a new profile is created.</p>
              </div>
            )}

            {likely.length === 0 && others.length > 0 && (
              <div className="space-y-2 rounded-lg bg-canvas p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Existing guests</p>
                {others.map((m) => (
                  <div key={m.guest.id} className="flex items-center justify-between gap-3">
                    <span>
                      {m.guest.name} · {m.guest.phone}
                    </span>
                    <button type="button" onClick={() => pickGuest(m.guest)} className="font-semibold text-brand">
                      Use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </Card>

          <Card title="Guarantee and deposit" padded>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Guarantee
              <select value={guarantee} onChange={(e) => setGuarantee(e.target.value as GuaranteeType)} className={`${field} mt-1`}>
                {guarantees
                  .filter((g) => g.key !== 'company')
                  .map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-ink/60">{guarantees.find((g) => g.key === guarantee)?.rule}</span>
              <span className="mt-1 block text-xs font-normal text-ink/60">
                {company
                  ? 'The company guarantee is added by itself once billing to the company is approved.'
                  : 'A company guarantee needs a company booking, above.'}
              </span>
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Deposit (UGX)
                <input
                  type="number"
                  min={0}
                  value={depositText === '' ? (deposit === 0 ? '' : deposit) : depositText}
                  onChange={(e) => setDepositText(e.target.value)}
                  placeholder={suggested ? String(suggested) : '0'}
                  className={`${field} mt-1`}
                />
                <span className="mt-1 block text-xs font-normal text-ink/60">Suggested 30% of the total: {ugx(suggested)}</span>
              </label>
              <label className="block text-sm font-medium">
                Paid by
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} mt-1`}>
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-ink/60">
              Payment is simulated here. In the real system, mobile money and card bookings are confirmed only after the payment provider confirms (BR-FO-10).
              {deposit > 0 && ` Recorded as ${method}.`}
            </p>
          </div>
          </Card>
        </div>

        <aside className="h-fit lg:sticky lg:top-4">
          {selectedGuest && (
            <div className="mb-3">
              <GuestRecognition guest={selectedGuest} />
            </div>
          )}
          {earned > 0 && tier && (
            <div className="mb-3 space-y-2 rounded-xl border border-brand/25 bg-brand/[0.06] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{tier.name} reward: {ugx(earned)} off</p>
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={useLoyalty} onChange={(e) => setUseLoyalty(e.target.checked)} />
                  Give it
                </label>
              </div>
              <p className="text-xs text-ink/70">{benefitList(tier).join(' · ')}.</p>
              {useLoyalty && !loyalty.autoApply && (
                loyaltyApproved ? (
                  <p className="text-xs font-semibold text-good">Approved by {loyaltyApproved}.</p>
                ) : (
                  <ApprovalGate
                    amount={earned}
                    limits={options.limits}
                    plan={tenant.plan}
                    kind="charge-reversal"
                    what={`${tier.name} discount for ${selectedGuest?.name ?? 'the guest'}`}
                    onCancel={() => setUseLoyalty(false)}
                    onApproved={(approvers, photoSkipped) => {
                      const names = approvers.map((a) => a.name).join(' and ')
                      setLoyaltyApproved(names)
                      record({
                        kind: 'charge-reversal',
                        what: `${tier.name} discount · ${selectedGuest?.name ?? 'guest'}`,
                        amount: earned,
                        requestedBy: user?.name ?? 'Front desk',
                        reason: `Loyalty reward, ${history?.stays ?? 0} previous stays`,
                        approvers,
                        level: 'manager',
                        photoSkipped,
                      })
                    }}
                  />
                )
              )}
              {useLoyalty && loyalty.autoApply && (
                <p className="text-xs text-ink/60">Given automatically by the hotel's loyalty rules.</p>
              )}
              {companyPlan?.selected.length ? (
                <p className="text-xs text-warn">A company price already applies, so the loyalty discount is not added on top.</p>
              ) : null}
            </div>
          )}
          <Card title="Summary" icon="money" padded>
          <div className="space-y-3">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{type} · {planFor(planId).name}</p>
            <p className="text-ink/60">
              {datesOk ? `${dayMonth(from)} to ${dayMonth(departure)} · ${nights} night${nights === 1 ? '' : 's'}` : 'Dates not set'}
            </p>
            <p className="text-ink/60">
              {adults} adult{adults === 1 ? '' : 's'}
              {children > 0 && `, ${children} child${children === 1 ? '' : 'ren'}`}
            </p>
          </div>
          <div className="space-y-1 border-t border-ink/10 pt-3 text-sm">
            {companyPlan && companyPlan.selected.length > 0 && (
              <>
                <p className="flex justify-between text-ink/60"><span>Normal price</span><span>{ugx(companyPlan.quote.originalTotal)}</span></p>
                {companyPlan.quote.needsApproval ? (
                  <p className="text-xs text-warn">Company price {ugx(companyPlan.quote.finalTotal)} applies once a manager approves it.</p>
                ) : (
                  <p className="flex justify-between text-good"><span>Company discount</span><span>− {ugx(companyPlan.quote.discountTotal)}</span></p>
                )}
              </>
            )}
            {discountOn && (
              <p className="flex justify-between text-good"><span>{tier?.name} discount</span><span>− {ugx(earned)}</span></p>
            )}
            <p className="flex justify-between"><span>Total</span><span className="font-semibold">{ugx(total)}</span></p>
            <p className="flex justify-between"><span>Deposit</span><span>{ugx(deposit)}</span></p>
            <p className="flex justify-between"><span>Balance</span><span className="font-semibold">{ugx(Math.max(0, total - deposit))}</span></p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {walkin ? 'Create and check in' : 'Create reservation'}
          </button>
          {!valid && (
            <ul className="space-y-1 text-xs text-ink/60">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// Address fallback: /desk/new?room=101&date=2026-10-09&walkin=1
export default function NewReservationPage() {
  const [params] = useSearchParams()
  const [run, setRun] = useState(0)
  const preset: BookingPreset = {
    room: params.get('room') ?? undefined,
    date: params.get('date') ?? undefined,
    walkin: params.get('walkin') === '1',
  }
  return <NewReservationForm key={run} preset={preset} onAgain={() => setRun(run + 1)} />
}